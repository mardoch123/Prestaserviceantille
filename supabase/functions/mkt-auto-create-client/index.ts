import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getEnv = (key: string): string | undefined => (globalThis as any)?.Deno?.env?.get?.(key);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  full_name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  since?: string | null;
};

const randomPassword = () => Math.random().toString(36).slice(-10);

const normalizeEmailValue = (value: any) => {
  const v = String(value || '').trim().toLowerCase();
  return v || null;
};

const normalizePhoneDigits = (value: any) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return null;
  const digits = raw.replace(/\D/g, '');
  return digits || null;
};

const digitsToFuzzyIlike = (digits: string) => {
  const safe = String(digits || '').replace(/\D/g, '');
  if (!safe) return null;
  return `%${safe.split('').join('%')}%`;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = body.phone ? String(body.phone).trim() : null;
    const address = body.address ? String(body.address).trim() : null;
    const city = body.city ? String(body.city).trim() : null;
    const since = body.since ? String(body.since).trim() : new Date().toISOString().slice(0, 10);

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailLower = normalizeEmailValue(email);
    const phoneDigits = normalizePhoneDigits(phone);
    const phonePattern = phoneDigits ? digitsToFuzzyIlike(phoneDigits) : null;

    if (emailLower) {
      const { data: existingProviderByEmail } = await supabaseAdmin
        .from('providers')
        .select('id,first_name,last_name,email')
        .ilike('email', emailLower)
        .limit(1)
        .maybeSingle();

      if (existingProviderByEmail?.id) {
        const label = `${String((existingProviderByEmail as any)?.first_name || '').trim()} ${String((existingProviderByEmail as any)?.last_name || '').trim()}`.trim() || 'Prestataire';
        return new Response(
          JSON.stringify({ ok: false, error: 'duplicate_contact', message: `Cet email est déjà utilisé par un compte prestataire (${label}).` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const { data: existingClient, error: existingClientError } = await supabaseAdmin
      .from('clients')
      .select('id, email')
      .ilike('email', emailLower || email)
      .order('since', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingClientError) {
      return new Response(JSON.stringify({ ok: false, error: existingClientError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let clientId = existingClient?.id ? String((existingClient as any).id) : null;

    if (phonePattern) {
      const { data: existingClientByPhone } = await supabaseAdmin
        .from('clients')
        .select('id,name,phone,email')
        .ilike('phone', phonePattern)
        .limit(1)
        .maybeSingle();

      if (existingClientByPhone?.id && (!clientId || String(existingClientByPhone.id) !== String(clientId))) {
        const label = String((existingClientByPhone as any)?.name || 'Client');
        return new Response(
          JSON.stringify({ ok: false, error: 'duplicate_contact', message: `Ce numéro de téléphone est déjà utilisé par un compte client (${label}).` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: existingProviderByPhone } = await supabaseAdmin
        .from('providers')
        .select('id,first_name,last_name,phone,email')
        .ilike('phone', phonePattern)
        .limit(1)
        .maybeSingle();

      if (existingProviderByPhone?.id) {
        const label = `${String((existingProviderByPhone as any)?.first_name || '').trim()} ${String((existingProviderByPhone as any)?.last_name || '').trim()}`.trim() || 'Prestataire';
        return new Response(
          JSON.stringify({ ok: false, error: 'duplicate_contact', message: `Ce numéro de téléphone est déjà utilisé par un compte prestataire (${label}).` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    if (!clientId) {
      const { data: created, error: createClientError } = await supabaseAdmin
        .from('clients')
        .insert({
          name: fullName || email.split('@')[0] || 'Client',
          city: city || '-',
          address: address || '-',
          phone: phone || '-',
          email,
          pack: '-',
          status: 'active',
          since,
          packs_consumed: 0,
          loyalty_hours_available: 0,
          has_left_review: false,
        })
        .select('id')
        .single();

      if (createClientError || !created) {
        return new Response(JSON.stringify({ ok: false, error: createClientError?.message || 'create_client_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      clientId = String((created as any).id);
    }

    const password = randomPassword();
    let authUserId: string | null = null;

    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: fullName || email.split('@')[0] || 'Client',
          role: 'client',
          relatedEntityId: clientId,
        },
      });

      if (!authErr && authData?.user?.id) {
        authUserId = String(authData.user.id);
      }
    } catch {
      authUserId = null;
    }

    if (authUserId) {
      try {
        await supabaseAdmin.from('users').upsert(
          {
            id: authUserId,
            email,
            name: fullName || email.split('@')[0] || 'Client',
            role: 'client',
            related_entity_id: clientId,
          } as any,
          { onConflict: 'id' } as any,
        );
      } catch {
        // ignore
      }
    }

    try {
      await supabaseAdmin.from('clients').update({ initial_password: password }).eq('id', clientId);
    } catch {
      // ignore
    }

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { data: emailData, error: emailInvokeError } = await supabaseAdmin.functions.invoke('send-email', {
        body: {
          to: email,
          subject: 'Bienvenue - Accès Espace Client',
          template: 'welcome_client_panel',
          context: {
            name: fullName || email.split('@')[0] || 'Client',
            login: email,
            password,
            link: 'https://www.prestaservicesantilles.com/',
          },
        },
      });

      if (emailInvokeError) {
        emailSent = false;
        emailError = emailInvokeError.message;
      } else {
        const returnedError = emailData && typeof emailData === 'object' ? (emailData as any).error : null;
        if (returnedError) {
          emailSent = false;
          emailError = String(returnedError);
        } else {
          emailSent = true;
        }
      }
    } catch (e: any) {
      emailSent = false;
      emailError = e?.message || 'send_email_failed';
    }

    return new Response(JSON.stringify({ ok: true, clientId, authUserId, password, emailSent, emailError }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
