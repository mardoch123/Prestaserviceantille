import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error('[supabaseAdmin] Missing environment variables:', {
      hasUrl: !!url,
      hasServiceRoleKey: !!serviceRoleKey
    });
    throw new Error('Missing Supabase env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Please check your .env file or environment configuration.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
