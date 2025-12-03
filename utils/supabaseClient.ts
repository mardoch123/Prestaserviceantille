import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables to prevent crashes if import.meta is not defined in some contexts
const getEnvVar = (key: string) => {
  try {
    const meta = import.meta as any;
    if (meta && meta.env) {
      return meta.env[key] || '';
    }
  } catch (e) {
    console.warn(`Error accessing environment variable ${key}:`, e);
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Prevent crash if variables are missing.
// We provide a fallback URL to avoid immediate crash during module load.
// Note: Requests will fail if the URL is invalid, but the app won't white-screen on load.
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your environment variables.');
}

export const supabase = createClient(validUrl, validKey);