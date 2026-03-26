/**
 * Gestionnaire d'erreurs réseau robuste
 * Retry intelligent avec backoff exponentiel
 */

import { supabase } from './supabaseClient';

interface FetchOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Fetch avec retry et timeout
 * @param fetchFn Fonction de fetch à exécuter
 * @param options Options de configuration
 * @returns Résultat du fetch
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeout = 15000,
    retries = 3,
    retryDelay = 1000,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });

      const result = await Promise.race([fetchFn(), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Ne pas retry sur les erreurs 4xx (client errors)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          throw lastError;
        }
      }

      // Toujours retry sur ERR_CONNECTION_CLOSED même si status est 200
      const isConnectionClosed = lastError.message?.includes('ERR_CONNECTION_CLOSED') ||
                                  lastError.message?.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
                                  lastError.message?.includes('net::ERR_CONNECTION');

      // Dernière tentative échouée
      if (attempt === retries && !isConnectionClosed) {
        break;
      }

      // Pour les erreurs de connexion, on fait plus de retries
      if (isConnectionClosed && attempt < retries + 2) {
        console.warn(`[networkRetry] Connection error, retry ${attempt + 1}/${retries + 2}...`);
        onRetry?.(attempt + 1, lastError);
        const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Notifier le retry
      onRetry?.(attempt + 1, lastError);

      // Backoff exponentiel avec jitter
      const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error');
}

/**
 * Wrapper Supabase avec retry
 * @param table Nom de la table
 * @param query Query builder function
 * @param options Options de fetch
 */
export async function supabaseWithRetry<T>(
  table: string,
  query: (qb: any) => any,
  options: FetchOptions = {}
): Promise<T | null> {
  return fetchWithRetry(
    async () => {
      const { data, error } = await query(supabase.from(table));
      
      if (error) {
        // Transformer l'erreur Supabase en Error standard
        throw Object.assign(new Error(error.message), { status: error.status, code: error.code });
      }
      
      return data as T;
    },
    {
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      ...options,
    }
  );
}

/**
 * Auth Supabase avec retry
 * @param authFn Fonction d'authentification
 * @param options Options de fetch
 */
export async function supabaseAuthWithRetry<T>(
  authFn: () => Promise<{ data: T; error: any }>,
  options: FetchOptions = {}
): Promise<T> {
  return fetchWithRetry(
    async () => {
      const { data, error } = await authFn();
      
      if (error) {
        throw Object.assign(new Error(error.message), { status: error.status, code: error.code });
      }
      
      return data;
    },
    {
      timeout: 15000,
      retries: 2,
      retryDelay: 1000,
      ...options,
    }
  );
}

/**
 * Vérifier si l'erreur est récupérable (peut être retry)
 * @param error Erreur à vérifier
 */
export function isRecoverableError(error: any): boolean {
  if (!error) return false;
  
  // Erreurs réseau récupérables
  if (error.message?.includes('timeout')) return true;
  if (error.message?.includes('network')) return true;
  if (error.message?.includes('fetch')) return true;
  if (error.message?.includes('Failed to fetch')) return true;
  if (error.message?.includes('ERR_TIMED_OUT')) return true;
  if (error.message?.includes('ERR_CONNECTION')) return true;
  if (error.message?.includes('net::ERR')) return true;
  
  // Erreurs HTTP récupérables (5xx ou 429 Too Many Requests)
  if (error.status >= 500) return true;
  if (error.status === 429) return true;
  
  return false;
}

/**
 * Attendre que la connexion soit rétablie
 * @param maxWaitSeconds Temps maximum d'attente
 */
export async function waitForConnection(maxWaitSeconds: number = 30): Promise<boolean> {
  if (navigator.onLine) return true;
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), maxWaitSeconds * 1000);
    
    const handleOnline = () => {
      clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      resolve(true);
    };
    
    window.addEventListener('online', handleOnline);
  });
}

/**
 * Queue pour les requêtes offline
 * Sauvegarde les requêtes qui échouent pour les rejouer plus tard
 */
class OfflineQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  add(operation: () => Promise<void>) {
    this.queue.push(operation);
    
    if (navigator.onLine && !this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && navigator.onLine) {
      const operation = this.queue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('[OfflineQueue] Operation failed:', error);
          // Remettre dans la queue pour retry plus tard
          this.queue.unshift(operation);
          break;
        }
      }
    }
    
    this.isProcessing = false;
  }
}

export const offlineQueue = new OfflineQueue();
