/**
 * Service de fetch intelligent avec retry et backoff exponentiel
 * Optimisé pour les connexions lentes et instables
 */

import { dataCache } from './dataCache';

interface FetchOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    priority?: 'high' | 'normal' | 'low';
    useCache?: boolean;
    cacheMaxAge?: number;
    etag?: string;
}

interface FetchResult<T> {
    data: T | null;
    fromCache: boolean;
    error: Error | null;
    stale: boolean;
    etag?: string;
}

class SmartFetchService {
    private pendingRequests: Map<string, Promise<any>> = new Map();
    private offlineQueue: Array<() => Promise<void>> = [];
    private isOnline: boolean = true;

    constructor() {
        // Écouter les changements de connexion
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.processOfflineQueue();
            });
            window.addEventListener('offline', () => {
                this.isOnline = false;
            });
        }
    }

    /**
     * Vérifie si une requête similaire est déjà en cours (dédoublonnage)
     */
    private getPendingKey(table: string, query?: string): string {
        return `${table}:${query || 'default'}`;
    }

    /**
     * Exécute une requête Supabase avec toutes les optimisations
     */
    async fetchWithSmartRetry<T>(
        table: string,
        fetchFn: () => Promise<{ data: T | null; error: any }>,
        options: FetchOptions = {}
    ): Promise<FetchResult<T>> {
        const {
            timeout = 30000,
            retries = 3,
            retryDelay = 1000,
            useCache = true,
            cacheMaxAge = 5 * 60 * 1000, // 5 minutes par défaut
        } = options;

        const cacheKey = this.getPendingKey(table);

        // 1. Essayer le cache d'abord pour un affichage immédiat
        if (useCache) {
            const cached = dataCache.get<T>(table, undefined, cacheMaxAge);
            if (cached) {
                // Lancer la requête en arrière-plan pour rafraîchir
                this.backgroundRefresh(table, fetchFn, options);
                return { data: cached, fromCache: true, error: null, stale: false };
            }
        }

        // 2. Vérifier si une requête identique est déjà en cours
        const pending = this.pendingRequests.get(cacheKey);
        if (pending) {
            const data = await pending;
            return { data, fromCache: false, error: null, stale: false };
        }

        // 3. Exécuter la requête avec retry intelligent
        const fetchPromise = this.executeWithRetry(fetchFn, { timeout, retries, retryDelay });
        this.pendingRequests.set(cacheKey, fetchPromise.then(r => r.data));

        try {
            const result = await fetchPromise;
            this.pendingRequests.delete(cacheKey);

            if (result.error) {
                // En cas d'erreur, essayer le cache même s'il est périmé
                if (useCache) {
                    const staleCached = dataCache.get<T>(table, undefined, 24 * 60 * 60 * 1000); // 24h
                    if (staleCached) {
                        return { data: staleCached, fromCache: true, error: null, stale: true };
                    }
                }
                return { data: null, fromCache: false, error: new Error(result.error.message || 'Unknown error'), stale: false };
            }

            // Sauvegarder dans le cache
            if (useCache && result.data) {
                dataCache.set(table, result.data);
            }

            return { data: result.data, fromCache: false, error: null, stale: false };
        } catch (error) {
            this.pendingRequests.delete(cacheKey);

            // En cas d'erreur réseau, essayer le cache
            if (useCache) {
                const staleCached = dataCache.get<T>(table, undefined, 24 * 60 * 60 * 1000);
                if (staleCached) {
                    return { data: staleCached, fromCache: true, error: null, stale: true };
                }
            }

            return { data: null, fromCache: false, error: error as Error, stale: false };
        }
    }

    /**
     * Exécute une requête avec retry et backoff exponentiel
     */
    private async executeWithRetry<T>(
        fetchFn: () => Promise<{ data: T | null; error: any }>,
        options: { timeout: number; retries: number; retryDelay: number }
    ): Promise<{ data: T | null; error: any }> {
        const { timeout, retries, retryDelay } = options;
        let lastError: any = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Timeout avec AbortController si disponible
                const result = await this.fetchWithTimeout(fetchFn, timeout);
                return result;
            } catch (error: any) {
                lastError = error;

                // Ne pas retry sur les erreurs 4xx (client errors)
                if (error.status && error.status >= 400 && error.status < 500) {
                    return { data: null, error };
                }

                // Backoff exponentiel avec jitter
                if (attempt < retries) {
                    const backoffDelay = retryDelay * Math.pow(2, attempt);
                    const jitter = Math.random() * 1000;
                    await this.delay(backoffDelay + jitter);
                }
            }
        }

        return { data: null, error: lastError };
    }

    /**
     * Exécute une requête avec timeout
     */
    private async fetchWithTimeout<T>(
        fetchFn: () => Promise<{ data: T | null; error: any }>,
        timeout: number
    ): Promise<{ data: T | null; error: any }> {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);

            try {
                const result = await fetchFn();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Rafraîchissement en arrière-plan (pas de blocage UI)
     */
    private async backgroundRefresh<T>(
        table: string,
        fetchFn: () => Promise<{ data: T | null; error: any }>,
        options: FetchOptions
    ): Promise<void> {
        // Utiliser requestIdleCallback si disponible, sinon setTimeout
        const schedule = typeof window !== 'undefined' && (window as any).requestIdleCallback
            ? (window as any).requestIdleCallback
            : (fn: () => void) => setTimeout(fn, 100);

        schedule(async () => {
            try {
                const result = await this.executeWithRetry(fetchFn, {
                    timeout: options.timeout || 30000,
                    retries: 2,
                    retryDelay: 2000
                });

                if (!result.error && result.data) {
                    dataCache.set(table, result.data);
                }
            } catch (e) {
                // Ignorer les erreurs en arrière-plan
            }
        });
    }

    /**
     * Attendre un délai
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Traiter la file d'attente hors ligne
     */
    private async processOfflineQueue(): Promise<void> {
        while (this.offlineQueue.length > 0 && this.isOnline) {
            const operation = this.offlineQueue.shift();
            if (operation) {
                try {
                    await operation();
                } catch (e) {
                    console.warn('[SmartFetch] Offline queue operation failed:', e);
                }
            }
        }
    }

    /**
     * Annuler toutes les requêtes en cours
     */
    cancelAll(): void {
        this.pendingRequests.clear();
    }

    /**
     * Vider le cache
     */
    clearCache(): void {
        dataCache.clearAll();
    }
}

// Instance singleton
export const smartFetch = new SmartFetchService();

export default smartFetch;
