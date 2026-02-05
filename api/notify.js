import { getFirebaseMessaging } from './_lib/firebaseAdmin.js';
import { getSupabaseAdminClient } from './_lib/supabaseAdmin.js';

async function getUserFromAuthHeader(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const parts = String(auth).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const accessToken = parts[1];

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error) return null;
  return data?.user || null;
}

async function isAdminUser(adminClient, authUser) {
  // Keep the same admin rule as the app: primary admin email
  if (String(authUser?.email || '').toLowerCase() === 'contact@prestaservicesantilles.com') return true;

  const { data, error } = await adminClient
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) return false;
  const role = String(data?.role || '').toLowerCase();
  return role === 'admin' || role === 'super_admin';
}

async function resolveAuthUserIdFromTarget(adminClient, targetUserType, targetUserId) {
  // In the app, notifications store target_user_type = client/provider/admin
  // and target_user_id = relatedEntityId for client/provider OR null/unused for admin.
  if (targetUserType === 'admin' || targetUserType === 'super_admin') {
    // Default: notify the main admin
    const { data, error } = await adminClient
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data?.id || null;
  }

  if (!targetUserId) return null;

  const { data, error } = await adminClient
    .from('users')
    .select('id')
    .eq('related_entity_id', targetUserId)
    .eq('role', targetUserType)
    .maybeSingle();

  if (error) return null;
  return data?.id || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const adminClient = getSupabaseAdminClient();
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { targetUserType, targetUserId, title, body, data } = req.body || {};

    if (!targetUserType || typeof targetUserType !== 'string') {
      res.status(400).json({ error: 'targetUserType is required' });
      return;
    }

    const normalizedTargetType = String(targetUserType).toLowerCase();
    if (!['admin', 'super_admin', 'client', 'provider'].includes(normalizedTargetType)) {
      res.status(400).json({ error: 'Invalid targetUserType' });
      return;
    }

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    const isAdmin = await isAdminUser(adminClient, user);

    const resolvedTargetAuthUserId = await resolveAuthUserIdFromTarget(
      adminClient,
      normalizedTargetType,
      targetUserId
    );

    if (!resolvedTargetAuthUserId) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    // Authorization:
    // - admins can send to anyone
    // - non-admin can only send to themselves (defensive)
    if (!isAdmin && resolvedTargetAuthUserId !== user.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { data: rows, error } = await adminClient
      .from('device_tokens')
      .select('token')
      .eq('user_id', resolvedTargetAuthUserId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const tokens = (rows || []).map(r => r.token).filter(Boolean);
    if (tokens.length === 0) {
      res.status(200).json({ ok: true, sent: 0, message: 'No device tokens' });
      return;
    }

    const messaging = getFirebaseMessaging();

    const message = {
      tokens,
      notification: {
        title,
        body,
      },
      data: data && typeof data === 'object' ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
      if (r.success) return;
      // Mark invalid/unregistered tokens for deletion
      const code = r.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      ) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length) {
      await adminClient.from('device_tokens').delete().in('token', invalidTokens);
    }

    res.status(200).json({ ok: true, sent: response.successCount, failed: response.failureCount, purged: invalidTokens.length });
  } catch (e) {
    console.error('[api/notify] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
}
