
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

// Valeurs du projet Supabase principal (fallback si pas de .env)
const DEFAULT_URL = 'https://myzbkbqkjykdsaymujvl.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzk1NjcsImV4cCI6MjA3OTYxNTU2N30.LFFKlGHjC6hfCQynUDCZp_2XdZLDrxAuK9D4NNFYbKI';

const normalizeSupabaseUrl = (raw: string): string => {
  const value = String(raw || '').trim().replace(/\/+$/, '');
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const host = parsed.host.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '');

    const isLikelySupabaseHosted = host.endsWith('.supabase.co');
    const looksLikeApiProxyPath = pathname === '/api' || pathname.startsWith('/api/');

    // Allow proxy base like https://localhost:3000/api/supabase for local/dev
    const isProxySupabase = looksLikeApiProxyPath && /\/api\/supabase(\/|$)/i.test(pathname);
    if (!isLikelySupabaseHosted && looksLikeApiProxyPath && !isProxySupabase) {
      return DEFAULT_URL;
    }
  } catch {
    return '';
  }

  return value;
};

const preferProxyBase = () => {
  try {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/+$/, '');
      return `${origin}/api/supabase`;
    }
  } catch {}
  return '';
};

const envUrl = getEnvVar('VITE_SUPABASE_URL');
const isDev = (() => {
  try {
    // @ts-ignore
    return typeof import.meta !== 'undefined' && !!((import.meta as any)?.env?.DEV);
  } catch {
    return false;
  }
})();
const rawUrl = envUrl || (isDev ? preferProxyBase() : '') || DEFAULT_URL;
const supabaseUrl = normalizeSupabaseUrl(rawUrl) || DEFAULT_URL;
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || DEFAULT_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
