// =====================================================================
// api/employment-contracts.js
// Passerelle serveur pour les contrats de travail (employment_contracts).
//
// Pourquoi : la base Supabase du VPS (outremerfermetures.com) n'a pas de
// privilèges par défaut sur le schéma public ; le rôle `authenticated` du
// navigateur reçoit donc « permission denied for table employment_contracts »
// faute de GRANT applicables sans accès SSH au VPS. Cet endpoint utilise la
// clé service_role (JAMAIS exposée au navigateur), exactement comme
// device-tokens.js / notify.js, et refuse tout accès sans session valide.
//
// Routes :
//   POST   /api/employment-contracts          -> insert (corps = ligne snake_case)
//   PATCH  /api/employment-contracts?id=<id>  -> update
//   DELETE /api/employment-contracts?id=<id>  -> delete
// =====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://outremerfermetures.com/api';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function allowCORS(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getAuthUser(authorization) {
  const token = String(authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    // apikey : clé anon si disponible, sinon le JWT lui-même (accepté par GoTrue)
    headers: { apikey: process.env.SUPABASE_ANON_KEY || token, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

// Même règle que notify.js / demo-accounts.js (lecture users avec la clé admin,
// l'utilisateur authentifié vient déjà de /auth/v1/user, non falsifiable)
async function isAdminUser(user) {
  if (!user) return false;
  if (String(user.email || '').toLowerCase() === 'contact@prestaservicesantilles.com') return true;

  const params = new URLSearchParams({ select: 'role', id: `eq.${user.id}`, limit: '1' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/users?${params}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  const role = String(rows?.[0]?.role || '').toLowerCase();
  return role === 'admin' || role === 'super_admin';
}

export default async function handler(req, res) {
  allowCORS(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)' });
      return;
    }

    const user = await getAuthUser(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Session invalide ou expirée, veuillez vous reconnecter.' });
      return;
    }
    if (!(await isAdminUser(user))) {
      res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      return;
    }

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    const base = `${SUPABASE_URL}/rest/v1/employment_contracts`;

    if (req.method === 'POST') {
      const record = req.body;
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        res.status(400).json({ error: 'Corps de requête invalide' });
        return;
      }
      const upstream = await fetch(`${base}?select=*`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(record),
      });
      const data = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: data?.message || 'Erreur base de données (insert)' });
        return;
      }
      res.status(201).json({ data });
      return;
    }

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const id = String(req.query?.id || '');
      if (!id) {
        res.status(400).json({ error: 'id requis' });
        return;
      }
      const upstream = await fetch(`${base}?id=eq.${encodeURIComponent(id)}`, {
        method: req.method,
        headers: { ...headers, Prefer: 'return=minimal' },
        body: req.method === 'PATCH' ? JSON.stringify(req.body || {}) : undefined,
      });
      if (!upstream.ok) {
        const data = await upstream.json().catch(() => null);
        res.status(upstream.status).json({ error: data?.message || 'Erreur base de données' });
        return;
      }
      res.status(200).json({ data: null });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[api/employment-contracts] error', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
}
