const SMSMODE_API_KEY = 'rxzmFfUisI0TyvC5FTmwJOwQa5xVchIz';
const SMSMODE_BASE_URL = 'https://api.smsmode.com';

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

function formatMartiniqueNumber(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    const prefix = cleaned.substring(0, 2);
    if (['06', '07'].includes(prefix)) {
      return '+262' + cleaned.substring(1);
    }
  }
  if (cleaned.length === 9 && ['693', '694', '695', '696'].some(p => cleaned.startsWith(p))) {
    return '+262' + cleaned;
  }
  if (cleaned.startsWith('262')) {
    return '+' + cleaned;
  }
  return cleaned;
}

async function sendSMS(phone, message) {
  const formattedPhone = formatMartiniqueNumber(phone);
  
  const response = await fetch(`${SMSMODE_BASE_URL}/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': SMSMODE_API_KEY
    },
    body: new URLSearchParams({
      'numero': formattedPhone,
      'message': message,
      'emetteur': 'PrestaService'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SMSMode error: ${response.status} - ${errorText}`);
  }

  const text = await response.text();
  if (!text) {
    return { success: true };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true };
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', getAllowOrigin(origin));
  res.setHeader('Vary', 'Origin');
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
    const body = req.body || {};
    console.log('[api/send-sms] Received request:', JSON.stringify(body).substring(0, 200));
    
    const { phones, message } = body;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      res.status(400).json({ error: 'phones (array) is required' });
      return;
    }

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    if (message.length > 500) {
      res.status(400).json({ error: 'message too long (max 500 chars)' });
      return;
    }

    const results = [];
    for (const phone of phones) {
      try {
        await sendSMS(phone, message);
        results.push({ phone, success: true });
      } catch (error) {
        results.push({ phone, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({ 
      ok: true, 
      sent: successCount, 
      failed: failureCount,
      results 
    });
  } catch (e) {
    console.error('[api/send-sms] error', e);
    res.status(200).json({ ok: true, sent: 0, failed: 0, results: [], warning: 'SMS sending may have failed' });
  }
}
