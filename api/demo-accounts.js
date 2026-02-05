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
  // Same rule as notify.js
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

function randomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'client' || r === 'provider') return r;
  return null;
}

export default async function handler(req, res) {
  try {
    const adminClient = getSupabaseAdminClient();
    const user = await getUserFromAuthHeader(req);

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const okAdmin = await isAdminUser(adminClient, user);
    if (!okAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (req.method === 'GET') {
      const { data, error } = await adminClient
        .from('demo_accounts')
        .select('id, auth_user_id, email, role, created_at, created_by')
        .order('created_at', { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ accounts: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const role = normalizeRole(body.role);
      if (!role) {
        res.status(400).json({ error: 'role is required (admin|client|provider)' });
        return;
      }

      const suffix = randomSuffix();
      const email = String(body.email || `demo.${role}.${suffix}@presta.demo`).toLowerCase();
      const password = String(body.password || randomPassword(12));

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        res.status(500).json({ error: createError.message });
        return;
      }

      const authUserId = created?.user?.id;
      if (!authUserId) {
        res.status(500).json({ error: 'Auth user not created' });
        return;
      }

      // Ensure we have a profile row compatible with the app
      const displayName = role === 'admin'
        ? 'Admin Démo'
        : role === 'provider'
          ? 'Prestataire Démo'
          : 'Client Démo';

      const { error: profileError } = await adminClient
        .from('users')
        .upsert({
          id: authUserId,
          email,
          name: displayName,
          role,
          related_entity_id: null,
          is_demo: true,
        });

      if (profileError) {
        // Rollback auth user (best effort)
        try {
          await adminClient.auth.admin.deleteUser(authUserId);
        } catch { }
        res.status(500).json({ error: profileError.message });
        return;
      }

      const { data: row, error: insertError } = await adminClient
        .from('demo_accounts')
        .insert({
          auth_user_id: authUserId,
          email,
          role,
          created_by: user.id,
        })
        .select('id, auth_user_id, email, role, created_at, created_by')
        .maybeSingle();

      if (insertError) {
        try {
          await adminClient.from('users').delete().eq('id', authUserId);
          await adminClient.auth.admin.deleteUser(authUserId);
        } catch { }
        res.status(500).json({ error: insertError.message });
        return;
      }

      res.status(201).json({ account: row, email, password });
      return;
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || (req.body && req.body.id) || '');
      if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
      }

      const { data: existing, error: fetchError } = await adminClient
        .from('demo_accounts')
        .select('id, auth_user_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        res.status(500).json({ error: fetchError.message });
        return;
      }

      if (!existing?.auth_user_id) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const authUserId = existing.auth_user_id;

      // Delete DB row first
      const { error: deleteError } = await adminClient
        .from('demo_accounts')
        .delete()
        .eq('id', id);

      if (deleteError) {
        res.status(500).json({ error: deleteError.message });
        return;
      }

      // Best-effort cleanup
      try {
        await adminClient.from('users').delete().eq('id', authUserId);
      } catch { }
      try {
        await adminClient.auth.admin.deleteUser(authUserId);
      } catch { }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[api/demo-accounts] error', e);
    const message = typeof e?.message === 'string' && e.message.trim() ? e.message.trim() : 'Internal error';
    res.status(500).json({ error: message });
  }
}
