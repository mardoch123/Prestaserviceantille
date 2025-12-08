
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

// Clés par défaut fournies
const DEFAULT_URL = 'https://myzbkbqkjykdsaymujvl.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzk1NjcsImV4cCI6MjA3OTYxNTU2N30.LFFKlGHjC6hfCQynUDCZp_2XdZLDrxAuK9D4NNFYbKI';

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || DEFAULT_URL;
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || DEFAULT_KEY;

// Check if we have valid credentials
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Warn only if truly missing, not if using defaults
if ((!supabaseUrl || !supabaseAnonKey) && supabaseUrl !== DEFAULT_URL) {
  console.warn('Supabase URL or Anon Key is missing. The app will start in offline/demo mode and network requests will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
