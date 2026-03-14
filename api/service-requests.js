import { getSupabaseAdminClient } from './_lib/supabaseAdmin.js';

const ALLOWED_ORIGINS = [
  'https://prestaservicesantilles.com',
  'https://www.prestaservicesantilles.com',
  'https://anciens.prestaservicesantilles.com',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getAllowOrigin(origin) {
  if (!origin) return ALLOWED_ORIGINS[0];
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default async function handler(req, res) {
  try {
    console.log('[api/service-requests] request received', {
      method: req.method,
      origin: req.headers.origin,
      bodyKeys: Object.keys(req.body || {})
    });
    
    const origin = req.headers.origin || '';
    res.setHeader('Access-Control-Allow-Origin', getAllowOrigin(origin));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Supabase-Auth');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = req.body || {};
    const { input, clientInfo, packName } = body;

    console.log('[api/service-requests] parsed body', { input, clientInfo, packName });

    if (!input || !clientInfo) {
      res.status(400).json({ error: 'Missing required fields: input, clientInfo' });
      return;
    }

    console.log('[api/service-requests] getting supabase admin client');
    const adminClient = getSupabaseAdminClient();
    console.log('[api/service-requests] got admin client');
    const id = generateUUID();
    const now = new Date().toISOString();

    const dbData = {
      id,
      client_id: input.clientId,
      client_name: clientInfo.name,
      client_email: clientInfo.email,
      client_phone: clientInfo.phone || null,
      client_address: clientInfo.address || null,
      client_city: clientInfo.city || null,
      service_type: input.serviceType,
      pack_id: input.packId || null,
      pack_name: packName || null,
      custom_service_description: input.customServiceDescription || null,
      requested_slots: input.requestedSlots || [],
      signature_data_url: input.signatureDataUrl || null,
      estimated_price: input.estimatedPrice || null,
      status: 'pending',
      admin_seen_at: null,
      validated_at: null,
      validated_by: null,
      generated_devis_id: null,
      generated_mission_ids: [],
      created_at: now,
      updated_at: now,
    };

    console.log('[api/service-requests] inserting data', dbData);
    
    const { data, error } = await adminClient
      .from('customer_service_requests')
      .insert(dbData)
      .select()
      .single();

    console.log('[api/service-requests] insert result', { data: !!data, error: !!error });

    if (error) {
      console.error('Error creating customer service request:', error);
      res.status(500).json({ error: error.message, code: error.code });
      return;
    }

    // Map DB response to frontend type
    const serviceRequest = {
      id: data.id,
      clientId: data.client_id,
      clientName: data.client_name,
      clientEmail: data.client_email,
      clientPhone: data.client_phone,
      clientAddress: data.client_address,
      clientCity: data.client_city,
      serviceType: data.service_type,
      packId: data.pack_id,
      packName: data.pack_name,
      customServiceDescription: data.custom_service_description,
      requestedSlots: data.requested_slots || [],
      signatureDataUrl: data.signature_data_url,
      estimatedPrice: data.estimated_price,
      status: data.status,
      adminSeenAt: data.admin_seen_at,
      validatedAt: data.validated_at,
      validatedBy: data.validated_by,
      generatedDevisId: data.generated_devis_id,
      generatedMissionIds: data.generated_mission_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    res.status(201).json({ serviceRequest });
  } catch (e) {
    console.error('[api/service-requests] error', e);
    console.error('[api/service-requests] error stack', e?.stack);
    const message = typeof e?.message === 'string' && e.message.trim() ? e.message.trim() : 'Internal error';
    res.status(500).json({ error: message, details: e?.stack || 'No stack trace' });
  }
}
