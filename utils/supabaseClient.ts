
import { createClient } from '@supabase/supabase-js';

// Robust way to get environment variables in different environments (Vite, Vercel, etc.)
const getEnvVar = (key: string) => {
  // Priority 1: Vite import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    console.warn(`Error accessing import.meta.env for ${key}`);
  }

  // Priority 2: Standard process.env (sometimes available in build/runtime)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // ignore
  }

  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Check if we have valid credentials
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co';

// Fallback to prevent crash during initialization, but requests will fail if used
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder';

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing. The app will start in offline/demo mode and network requests will fail.');
}

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
