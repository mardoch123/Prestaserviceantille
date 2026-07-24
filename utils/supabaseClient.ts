
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
const DEFAULT_URL = 'https://prestaservicesantilles.com/api';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA';

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
    
    // Allow VPS/self-hosted Supabase at /api (like outremerfermetures.com/api or prestaservicesantilles.com/api)
    const isVpsSupabase = looksLikeApiProxyPath && !isProxySupabase;
    
    // If it looks like a random API path (not /api/supabase and not a known VPS), fallback
    if (!isLikelySupabaseHosted && looksLikeApiProxyPath && !isProxySupabase && !isVpsSupabase) {
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
      const hostname = window.location.hostname;
      // Do not default to local origin /api on localhost if local proxy is not running
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return '';
      }
      const origin = window.location.origin.replace(/\/+$/, '');
      return `${origin}/api`;
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
const rawUrl = envUrl || preferProxyBase() || DEFAULT_URL;
const supabaseUrl = normalizeSupabaseUrl(rawUrl) || DEFAULT_URL;
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || DEFAULT_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use localStorage explicitly for session persistence across tabs/sessions
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Keep session alive across browser tabs
    storageKey: 'sb-presta-auth-token',
  }
});
