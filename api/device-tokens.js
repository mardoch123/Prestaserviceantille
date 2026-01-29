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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { token, platform } = req.body || {};

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    const normalizedPlatform = String(platform || '').toLowerCase();
    const finalPlatform = normalizedPlatform === 'ios' ? 'ios' : 'android';

    const admin = getSupabaseAdminClient();

    const payload = {
      user_id: user.id,
      platform: finalPlatform,
      token,
      last_seen_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from('device_tokens')
      .upsert(payload, { onConflict: 'user_id,token' });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (e) {
    console.error('[api/device-tokens] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
}
