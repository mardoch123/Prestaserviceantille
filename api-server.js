const http = require('http');
const fs = require('fs');
const path = require('path');

const SMSMODE_API_KEY = 'rxzmFfUisI0TyvC5FTmwJOwQa5xVchIz';
const SMSMODE_BASE_URL = 'https://rest.smsmode.com';
const SMSMODE_ENDPOINT = '/sms/v1/messages';

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
  
  const response = await fetch(`${SMSMODE_BASE_URL}${SMSMODE_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Api-Key': SMSMODE_API_KEY
    },
    body: JSON.stringify({
      msisdn: formattedPhone,
      message: message,
      sender: 'PrestaService'
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

async function handleSendSMS(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  try {
    const data = JSON.parse(body);
    const { phones, message } = data;

    console.log('[api/send-sms] Received:', { phones, message: message?.substring(0, 50) });

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'phones (array) is required' }));
      return;
    }

    if (!message || typeof message !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'message is required' }));
      return;
    }

    if (message.length > 500) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'message too long (max 500 chars)' }));
      return;
    }

    const results = [];
    for (const phone of phones) {
      try {
        await sendSMS(phone, message);
        results.push({ phone, success: true });
        console.log('[api/send-sms] SMS sent to:', phone);
      } catch (error) {
        console.error('[api/send-sms] Error:', error.message);
        results.push({ phone, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sent: successCount, failed: failureCount, results }));
  } catch (e) {
    console.error('[api/send-sms] error', e);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sent: 0, failed: 0, results: [], warning: 'SMS sending may have failed' }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3001`);

  if (url.pathname === '/api/send-sms') {
    await handleSendSMS(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(3001, () => {
  console.log('✅ SMS API server running on port 3001');
});
