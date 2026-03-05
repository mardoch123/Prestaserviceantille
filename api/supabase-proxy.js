const SUPABASE_URL = process.env.SUPABASE_URL || 'https://myzbkbqkjykdsaymujvl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzk1NjcsImV4cCI6MjA3OTYxNTU2N30.LFFKlGHjC6hfCQynUDCZp_2XdZLDrxAuK9D4NNFYbKI';

function allowCORS(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  try {
    allowCORS(req, res);
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const path = String(req.query?.path || '').replace(/^\/+/, '');
    if (!path) {
      res.status(400).json({ error: 'Missing path' });
      return;
    }

    const url = `${SUPABASE_URL}/${path}`;

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['x-supabase-auth'];
    if (authHeader) headers['Authorization'] = String(authHeader).startsWith('Bearer') ? authHeader : `Bearer ${authHeader}`;

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method || 'GET') ? undefined : req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined,
    });

    const buf = await upstream.arrayBuffer();
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase().startsWith('access-control-')) return; // override with ours
      if (k.toLowerCase() === 'content-length') return; // will be reset
      res.setHeader(k, v);
    });
    res.end(Buffer.from(buf));
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Proxy error' });
  }
}
