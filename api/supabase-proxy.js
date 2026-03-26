const SUPABASE_URL = process.env.SUPABASE_URL || 'https://outremerfermetures.com/api';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA';

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
