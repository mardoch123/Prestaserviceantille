
import { createClient } from '@supabase/supabase-js';

// Résolution des variables d'environnement (Vite, Vercel…)
const getEnvVar = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
      // @ts-ignore
      return import.meta.env[key] as string;
    }
  } catch { /* ignoré */ }

  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.[key]) {
      // @ts-ignore
      return process.env[key] as string;
    }
  } catch { /* ignoré */ }

  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans le fichier .env. ' +
    "L'application ne pourra pas se connecter à la base de données."
  );
}

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
