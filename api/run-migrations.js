import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (pool) return pool;

  // Connection string from env or construct from parts
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (connectionString) {
    pool = new Pool({ connectionString, max: 1, idle_timeout_ms: 5000 });
    return pool;
  }

  // Fallback: construct from individual env vars
  const host = process.env.DB_HOST || process.env.POSTGRES_HOST || '';
  const port = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
  const user = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres';

  if (!host) return null;

  pool = new Pool({ host, port, user, password, database, max: 1, idle_timeout_ms: 5000 });
  return pool;
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const dbPool = getPool();
    if (!dbPool) {
      res.status(500).json({
        error: 'No database connection configured. Set DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME env vars.',
        hint: 'Add DATABASE_URL to your .env file pointing to your PostgreSQL instance.'
      });
      return;
    }

    const results = {};

    // Migration 1: Add scheduled_unavailabilities column to providers
    try {
      const colCheck = await dbPool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'providers' AND column_name = 'scheduled_unavailabilities'
      `);

      if (colCheck.rows.length === 0) {
        await dbPool.query(`
          ALTER TABLE providers
          ADD COLUMN scheduled_unavailabilities JSONB DEFAULT '[]'::jsonb
        `);
        results.scheduled_unavailabilities = 'created';
      } else {
        results.scheduled_unavailabilities = 'already_exists';
      }
    } catch (err) {
      results.scheduled_unavailabilities = `error: ${err.message}`;
    }

    // Migration 2: Update company email from .rh@gmail.com to prestaservicesantilles@gmail.com
    try {
      const oldEmail = 'prestashservicesantilles.rh@gmail.com';
      const newEmail = 'prestaservicesantilles@gmail.com';
      const emailCheck = await dbPool.query(`
        SELECT id, email FROM company_settings WHERE email = $1 LIMIT 1
      `, [oldEmail]);

      if (emailCheck.rows.length > 0) {
        await dbPool.query(`
          UPDATE company_settings SET email = $1 WHERE email = $2
        `, [newEmail, oldEmail]);
        results.company_email = `updated from ${oldEmail} to ${newEmail}`;
      } else {
        // Check if already correct
        const correctCheck = await dbPool.query(`
          SELECT id, email FROM company_settings WHERE email = $1 LIMIT 1
        `, [newEmail]);
        if (correctCheck.rows.length > 0) {
          results.company_email = 'already_correct';
        } else {
          results.company_email = 'no_company_settings_row_found';
        }
      }
    } catch (err) {
      results.company_email = `error: ${err.message}`;
    }

    // Migration 3: Add provider2_id and provider2_name to missions
    try {
      const p2Check = await dbPool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'missions' AND column_name = 'provider2_id'
      `);
      if (p2Check.rows.length === 0) {
        await dbPool.query(`
          ALTER TABLE missions
          ADD COLUMN provider2_id UUID REFERENCES providers(id),
          ADD COLUMN provider2_name TEXT
        `);
        results.provider2_columns = 'created';
      } else {
        results.provider2_columns = 'already_exists';
      }
    } catch (err) {
      results.provider2_columns = `error: ${err.message}`;
    }

    // Migration 4: Add one_time_unavailabilities to providers
    try {
      const otuCheck = await dbPool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'providers' AND column_name = 'one_time_unavailabilities'
      `);
      if (otuCheck.rows.length === 0) {
        await dbPool.query(`
          ALTER TABLE providers
          ADD COLUMN one_time_unavailabilities JSONB DEFAULT '[]'::jsonb
        `);
        results.one_time_unavailabilities = 'created';
      } else {
        results.one_time_unavailabilities = 'already_exists';
      }
    } catch (err) {
      results.one_time_unavailabilities = `error: ${err.message}`;
    }

    res.status(200).json({
      success: true,
      message: 'Migrations exécutées',
      results
    });
  } catch (e) {
    console.error('[api/run-migrations] error', e);
    res.status(500).json({ error: e?.message || 'Migration failed' });
  }
}