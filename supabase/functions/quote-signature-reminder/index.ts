import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getEnv = (key: string): string | undefined => (globalThis as any)?.Deno?.env?.get?.(key);

const EMAIL_BRAND_NAME = 'Presta Services Antilles';
const COMPANY_NAME = 'PRESTA SERVICES ANTILLES';
const COMPANY_EMAIL = 'prestaservicesantilles.rh@gmail.com';
const COMPANY_PHONE = '0696 06 15 94';
const COMPANY_ADDRESS = "31 Résidence L'Autre Bord – 97220 La Trinité";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  docId?: string;
  mode?: 'single' | 'batch';
  force?: boolean;
};

const LOGIN_LINK = 'https://presta-antilles.app/login';

async function sendEmailViaEmailJS(params: {
  to: string;
  subject: string;
  message: string;
}) {
  const serviceId = getEnv('EMAILJS_SERVICE_ID');
  const templateId = getEnv('EMAILJS_TEMPLATE_ID') || getEnv('EMAILJS_TEMPLATE_ID_QUOTE_SIGNATURE_REMINDER');
  const userId = getEnv('EMAILJS_PUBLIC_KEY') || getEnv('EMAILJS_USER_ID');

  if (!serviceId || !templateId || !userId) {
    throw new Error('EmailJS env vars missing. Required: EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID (or EMAILJS_TEMPLATE_ID_QUOTE_SIGNATURE_REMINDER), EMAILJS_PUBLIC_KEY');
  }

  const normalizedSubject = `${EMAIL_BRAND_NAME} - ${String(params.subject || '').trim()}`.trim();

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: userId,
      template_params: {
        to_email: params.to,
        name: EMAIL_BRAND_NAME,
        subject: normalizedSubject,
        message: params.message,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`EmailJS send failed: ${res.status} ${txt}`);
  }
}

function formatRemainingMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function buildEmailMessage(params: {
  clientName: string;
  quoteRef: string;
  remainingText: string;
  login: string;
  password?: string;
}): string {
  const createTextEmail = (title: string, content: string): string => {
    return `
${COMPANY_NAME.toUpperCase()}
==================================================

${title}

--------------------------------------------------

${content}

--------------------------------------------------
${COMPANY_NAME}
${COMPANY_ADDRESS}
Email: ${COMPANY_EMAIL} | Tél: ${COMPANY_PHONE}
    `.trim();
  };

  const passwordText = params.password ? params.password : 'Non disponible';

  return createTextEmail(
    'Rappel signature devis',
    `Bonjour ${params.clientName},

Un rappel concernant votre devis ${params.quoteRef}.

Temps restant avant expiration : ${params.remainingText}

VOS IDENTIFIANTS DE CONNEXION :
- Email : ${params.login}
- Mot de passe : ${passwordText}

Accédez à votre espace ici : ${LOGIN_LINK}

Si vous avez déjà signé votre devis, vous pouvez ignorer ce message.`,
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = getEnv('SUPABASE_URL') ?? '';
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration', hint: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      body = {};
    }
    const mode = body.mode || (body.docId ? 'single' : 'batch');
    const force = Boolean(body.force);

    const now = Date.now();
    const expirationMs = 24 * 60 * 60 * 1000;

    const fetchDocs = async () => {
      if (mode === 'single') {
        if (!body.docId) throw new Error('docId is required for single mode');
        const { data, error } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('id', body.docId)
          .maybeSingle();
        if (error) throw error;
        return data ? [data] : [];
      }

      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('type', 'Devis')
        .eq('status', 'sent');
      if (error) throw error;
      return data || [];
    };

    const docs = await fetchDocs();

    let sent = 0;
    let skipped = 0;
    const results: Array<{ docId: string; status: 'sent' | 'skipped' | 'error'; reason?: string }> = [];

    for (const doc of docs) {
      try {
        const docId = String(doc.id);
        const docStatus = String(doc.status || '');
        const quoteRef = String(doc.ref || docId);

        if (docStatus === 'signed') {
          skipped++;
          results.push({ docId, status: 'skipped', reason: 'already_signed' });
          continue;
        }

        const createdAtRaw = doc.created_at || doc.createdAt || null;
        const createdAtMs = createdAtRaw ? new Date(createdAtRaw).getTime() : NaN;
        if (!Number.isFinite(createdAtMs)) {
          skipped++;
          results.push({ docId, status: 'skipped', reason: 'missing_created_at' });
          continue;
        }

        const expiresAtMs = createdAtMs + expirationMs;
        const remainingMs = expiresAtMs - now;
        if (remainingMs <= 0) {
          skipped++;
          results.push({ docId, status: 'skipped', reason: 'expired' });
          continue;
        }

        const clientId = String(doc.client_id || doc.clientId || '');
        if (!clientId) {
          skipped++;
          results.push({ docId, status: 'skipped', reason: 'missing_client_id' });
          continue;
        }

        const { data: client, error: clientError } = await supabaseAdmin
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle();

        if (clientError) throw clientError;
        if (!client) {
          skipped++;
          results.push({ docId, status: 'skipped', reason: 'client_not_found' });
          continue;
        }

        const clientEmail = String(client.email || '');
        const clientName = String(client.name || doc.client_name || doc.clientName || '');
        const initialPassword = (client as any).initial_password ? String((client as any).initial_password) : undefined;

        if (!clientEmail) {
          skipped++;
          results.push({ docId, status: 'skipped', reason: 'missing_client_email' });
          continue;
        }

        // Detect login since quote creation (best-effort)
        if (!force) {
          const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('id, role, related_entity_id')
            .eq('role', 'client')
            .eq('related_entity_id', clientId)
            .maybeSingle();

          if (profileError) {
            // If profile table is unavailable, ignore and proceed.
          } else if (userProfile?.id) {
            const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userProfile.id);
            if (!authUserError && authUserData?.user?.last_sign_in_at) {
              const lastSignInMs = new Date(authUserData.user.last_sign_in_at).getTime();
              if (Number.isFinite(lastSignInMs) && lastSignInMs > createdAtMs) {
                skipped++;
                results.push({ docId, status: 'skipped', reason: 'client_logged_in_since_creation' });
                continue;
              }
            }
          }
        }

        const subject = `Rappel - Signature de votre devis ${quoteRef}`;
        await sendEmailViaEmailJS({
          to: clientEmail,
          subject,
          message: buildEmailMessage({
            clientName,
            quoteRef,
            remainingText: formatRemainingMs(remainingMs),
            login: clientEmail,
            password: initialPassword,
          }),
        });
        sent++;
        results.push({ docId, status: 'sent' });
      } catch (e: any) {
        const docId = String((doc as any)?.id || 'unknown');
        results.push({ docId, status: 'error', reason: e?.message || 'unknown_error' });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, mode, sent, skipped, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: any) {
    console.error('[quote-signature-reminder] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
