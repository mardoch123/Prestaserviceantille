import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getEnv = (key: string): string | undefined => (globalThis as any)?.Deno?.env?.get?.(key);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

async function getAuthUser(supabaseAdmin: any, req: Request) {
  const auth = req.headers.get('authorization') || '';
  const parts = String(auth).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const accessToken = parts[1];
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error) return null;
  return data?.user || null;
}

async function isAdminUser(supabaseAdmin: any, authUser: any) {
  if (String(authUser?.email || '').toLowerCase() === 'contact@prestaservicesantilles.com') return true;
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error) return false;
  const role = String((data as any)?.role || '').toLowerCase();
  return role === 'admin' || role === 'super_admin';
}

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

    const caller = await getAuthUser(supabaseAdmin, req);
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const canProvision = await isAdminUser(supabaseAdmin, caller);
    if (!canProvision) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { email, password, name, role, relatedEntityId } = await req.json();

    if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let authUserId: string | null = null;
    let created = false;

    const createRes = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        relatedEntityId
      }
    });

    if (!createRes.error && createRes.data?.user?.id) {
      authUserId = String(createRes.data.user.id);
      created = true;
    }

    if (!authUserId) {
      const msg = String((createRes.error as any)?.message || '').toLowerCase();
      const mayExist = msg.includes('already') || msg.includes('exists') || msg.includes('duplicate');
      if (!mayExist) {
        console.error("Error creating user:", createRes.error);
        throw createRes.error;
      }

      let found: any = null;
      let page = 1;
      const perPage = 200;
      while (!found && page <= 20) {
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (listError) break;
        const users = (listData as any)?.users;
        if (Array.isArray(users)) {
          found = users.find((u: any) => String(u?.email || '').toLowerCase() === String(email).toLowerCase()) || null;
        }
        if (found) break;
        if (!Array.isArray(users) || users.length < perPage) break;
        page += 1;
      }

      if (!found?.id) {
        throw new Error('User already exists, but cannot resolve auth user id');
      }

      authUserId = String(found.id);
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: {
          name,
          role,
          relatedEntityId
        }
      });
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

    if (authUserId) {
      try {
        await supabaseAdmin
          .from('users')
          .upsert({
            id: authUserId,
            email,
            name: name || String(email || '').split('@')[0] || 'Utilisateur',
            role,
            related_entity_id: relatedEntityId || null,
          } as any, { onConflict: 'id' } as any);
      } catch {
        // ignore
      }
    }

    return new Response(JSON.stringify({ ok: true, id: authUserId, created }), {
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
