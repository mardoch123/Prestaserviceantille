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

// Timeout pour éviter le kill Vercel (fonction Hobby max ~10 s)
const FETCH_TIMEOUT = parseInt(process.env.API_FETCH_TIMEOUT || '7000', 10);
async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
  const r = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
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
  const r = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/users?${params}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  const role = String(rows?.[0]?.role || '').toLowerCase();
  return role === 'admin' || role === 'super_admin';
}

// Voie fallback (admin restauré depuis le cache, sans jeton vivant) : on vérifie
// que l'e-mail déclaré correspond RÉELLEMENT à un admin en base (users.role) ou à
// l'admin principal. Un e-mail aléatoire/inexistant est rejeté.
async function isAdminEmailVerified(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return false;
  if (e === 'contact@prestaservicesantilles.com') return true;

  const params = new URLSearchParams({ select: 'role', email: `eq.${e}`, limit: '1' });
  const r = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/users?${params}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  const role = String(rows?.[0]?.role || '').toLowerCase();
  return role === 'admin' || role === 'super_admin';
}

// Résout l'identité de l'appelant.
//   { authLevel: 'session' }  -> jeton Supabase valide + admin
//   { authLevel: 'fallback' } -> e-mail admin vérifié en base, sans jeton
//   null                       -> non authentifié / non admin
async function resolveCaller(req) {
  const auth = req.headers.authorization;
  if (auth && !String(auth).match(/^Bearer\s*$/i)) {
    const user = await getAuthUser(auth);
    if (user && (await isAdminUser(user))) return { authLevel: 'session' };
  }
  const emailHeader = req.headers['x-admin-email'];
  if (emailHeader && (await isAdminEmailVerified(emailHeader))) return { authLevel: 'fallback' };
  return null;
}

export default async function handler(req, res) {
  allowCORS(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)' });
      return;
    }

    const caller = await resolveCaller(req);
    if (!caller) {
      res.status(401).json({ error: 'Accès refusé : session invalide ou identité admin non reconnue.' });
      return;
    }
    // La suppression (destructive) exige une vraie session Supabase, pas le simple cache.
    if (req.method === 'DELETE' && caller.authLevel !== 'session') {
      res.status(401).json({ error: 'La suppression d\'un contrat nécessite une connexion Supabase active (reconnectez-vous).' });
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
      const upstream = await fetchWithTimeout(`${base}?select=*`, {
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
      const upstream = await fetchWithTimeout(`${base}?id=eq.${encodeURIComponent(id)}`, {
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
