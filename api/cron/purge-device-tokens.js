import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';

function isAuthorizedCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow if not configured
  const header = req.headers['x-cron-secret'] || req.headers['X-Cron-Secret'] || '';
  return String(header) === String(secret);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorizedCron(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const admin = getSupabaseAdminClient();

    const days = Number(process.env.TOKEN_TTL_DAYS || 90);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { error, count } = await admin
      .from('device_tokens')
      .delete({ count: 'exact' })
      .lt('last_seen_at', cutoff);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true, cutoff, deleted: count ?? null });
  } catch (e) {
    console.error('[api/cron/purge-device-tokens] error', e);
    res.status(500).json({ error: 'Internal error' });
  }
}
