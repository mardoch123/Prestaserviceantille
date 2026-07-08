import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const getEnv = (key: string): string | undefined => (globalThis as any)?.Deno?.env?.get?.(key);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Simple auth: require service role key
  const authHeader = req.headers.get('authorization') || req.headers.get('apikey') || '';
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || '';
  const providedKey = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!serviceKey || providedKey !== serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results: Record<string, string> = {};

  try {
    // Build DB connection URL
    // For self-hosted Supabase, the DB is typically at host 'db' on port 5432
    const dbUrl = getEnv('SUPABASE_DB_URL')
      || getEnv('DATABASE_URL')
      || `postgres://postgres:${getEnv('POSTGRES_PASSWORD') || ''}@${getEnv('POSTGRES_HOST') || 'db'}:${getEnv('POSTGRES_PORT') || '5432'}/${getEnv('POSTGRES_DB') || 'postgres'}`;

    const sql = postgres(dbUrl);

    // Migration 1: Add scheduled_unavailabilities column to providers
    try {
      const colCheck = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'providers' AND column_name = 'scheduled_unavailabilities'
      `;

      if (colCheck.length === 0) {
        await sql`
          ALTER TABLE providers
          ADD COLUMN scheduled_unavailabilities JSONB DEFAULT '[]'::jsonb
        `;
        results.scheduled_unavailabilities = 'created';
      } else {
        results.scheduled_unavailabilities = 'already_exists';
      }
    } catch (err: any) {
      results.scheduled_unavailabilities = `error: ${err.message}`;
    }

    // Migration 2: Update company email from .rh@gmail.com to prestaservicesantilles@gmail.com
    try {
      const oldEmail = 'prestashservicesantilles.rh@gmail.com';
      const newEmail = 'prestaservicesantilles@gmail.com';
      const emailCheck = await sql`
        SELECT id, email FROM company_settings WHERE email = ${oldEmail} LIMIT 1
      `;

      if (emailCheck.length > 0) {
        await sql`
          UPDATE company_settings SET email = ${newEmail} WHERE email = ${oldEmail}
        `;
        results.company_email = `updated from ${oldEmail} to ${newEmail}`;
      } else {
        const correctCheck = await sql`
          SELECT id, email FROM company_settings WHERE email = ${newEmail} LIMIT 1
        `;
        if (correctCheck.length > 0) {
          results.company_email = 'already_correct';
        } else {
          results.company_email = 'no_company_settings_row_found';
        }
      }
    } catch (err: any) {
      results.company_email = `error: ${err.message}`;
    }

    // Migration 3: Add provider2_id and provider2_name to missions
    try {
      const p2Check = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'missions' AND column_name = 'provider2_id'
      `;
      if (p2Check.length === 0) {
        await sql`
          ALTER TABLE missions
          ADD COLUMN provider2_id UUID REFERENCES providers(id),
          ADD COLUMN provider2_name TEXT
        `;
        results.provider2_columns = 'created';
      } else {
        results.provider2_columns = 'already_exists';
      }
    } catch (err: any) {
      results.provider2_columns = `error: ${err.message}`;
    }

    // Migration 4: Add one_time_unavailabilities to providers
    try {
      const otuCheck = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'providers' AND column_name = 'one_time_unavailabilities'
      `;
      if (otuCheck.length === 0) {
        await sql`
          ALTER TABLE providers
          ADD COLUMN one_time_unavailabilities JSONB DEFAULT '[]'::jsonb
        `;
        results.one_time_unavailabilities = 'created';
      } else {
        results.one_time_unavailabilities = 'already_exists';
      }
    } catch (err: any) {
      results.one_time_unavailabilities = `error: ${err.message}`;
    }

    await sql.end();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migrations exécutées avec succès',
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        results,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
