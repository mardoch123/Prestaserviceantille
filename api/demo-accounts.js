import { getSupabaseAdminClient } from './_lib/supabaseAdmin.js';

function extractSupabaseRefFromUrl(url) {
  try {
    const u = new URL(String(url || ''));
    // https://<ref>.supabase.co
    const host = String(u.host || '');
    const first = host.split('.')[0];
    return first || '';
  } catch {
    return '';
  }
}

function decodeJwtIssuerRef(accessToken) {
  try {
    const parts = String(accessToken || '').split('.');
    if (parts.length < 2) return '';
    const payloadB64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    const iss = String(payload?.iss || '');
    // iss: https://<ref>.supabase.co/auth/v1
    return extractSupabaseRefFromUrl(iss);
  } catch {
    return '';
  }
}

async function getUserFromAuthHeader(req) {
  const auth = req.headers.authorization || req.headers.Authorization || req.headers['x-supabase-auth'] || '';
  const raw = String(auth || '');
  // Support either full header "Bearer <token>" or raw token via x-supabase-auth
  const match = raw.match(/Bearer\s+([^,\s]+)/i);
  const accessToken = match && match[1] ? match[1] : (req.headers['x-supabase-auth'] ? raw : '');
  if (!accessToken) return null;

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

const ALLOWED_ORIGINS = [
  'https://prestaservicesantilles.com',
  'https://www.prestaservicesantilles.com',
  'https://anciens.prestaservicesantilles.com',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getAllowOrigin(origin) {
  if (!origin) return ALLOWED_ORIGINS[0];
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin || '';
    res.setHeader('Access-Control-Allow-Origin', getAllowOrigin(origin));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Supabase-Auth');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

  const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['x-supabase-auth'] || '';
    const rawAuth = String(authHeader || '');
  const hasBearer = /Bearer\s+/i.test(rawAuth) || !!req.headers['x-supabase-auth'];
  if (!hasBearer) {
    res.status(401).json({ error: 'Unauthorized', details: 'Missing Authorization: Bearer <token>' });
      return;
    }

    const adminClient = getSupabaseAdminClient();
    const user = await getUserFromAuthHeader(req);

    if (!user) {
      const authHeader = req.headers.authorization || req.headers.Authorization || '';
      const raw = String(authHeader || '');
      const m = raw.match(/Bearer\s+([^,\s]+)/i);
      const token = m && m[1] ? m[1] : '';
      const tokenRef = decodeJwtIssuerRef(token);
      const envRef = extractSupabaseRefFromUrl(process.env.SUPABASE_URL);
      const refHint = tokenRef && envRef && tokenRef !== envRef
        ? ` (token ref: ${tokenRef}, env ref: ${envRef})`
        : (tokenRef || envRef) ? ` (token ref: ${tokenRef || 'unknown'}, env ref: ${envRef || 'unknown'})` : '';
      res.status(401).json({
        error: 'Unauthorized',
        details: `Invalid or expired token (or wrong Supabase project)${refHint}`
      });
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
