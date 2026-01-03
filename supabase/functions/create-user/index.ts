import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getEnv = (key: string): string | undefined => (globalThis as any)?.Deno?.env?.get?.(key);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = getEnv('SUPABASE_URL') ?? '';
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!url || !serviceKey) {
      return new Response(JSON.stringify({
        error: 'Server misconfiguration',
        hint: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, password, name, role, relatedEntityId } = await req.json();

    if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Create the user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirm email immediately
      user_metadata: {
        name,
        role,
        relatedEntityId
      }
    });

    if (error) {
        console.error("Error creating user:", error);
        throw error;
    }

    // Persist the initial password in DB (best-effort)
    try {
      if (role === 'client' && relatedEntityId) {
        await supabaseAdmin
          .from('clients')
          .update({ initial_password: password })
          .eq('id', relatedEntityId);
      }
      if (role === 'provider' && relatedEntityId) {
        await supabaseAdmin
          .from('providers')
          .update({ initial_password: password })
          .eq('id', relatedEntityId);
      }
    } catch (e) {
      console.warn('[create-user] Unable to persist initial_password (ignored):', e);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
