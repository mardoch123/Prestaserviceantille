/**
 * Cache Layer pour Presta Services Antilles
 * Stocke les données localement pour un affichage instantané
 * même avec une connexion lente ou instable
 */

const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'presta_cache_';
const CACHE_META_PREFIX = 'presta_cache_meta_';

interface CacheMeta {
    version: string;
    timestamp: number;
    etag?: string;
}

interface CacheEntry<T> {
    data: T;
    meta: CacheMeta;
}

class DataCache {
    private memoryCache: Map<string, any> = new Map();
    private readonly maxMemoryItems = 50;

    /**
     * Génère une clé de cache unique
     */
    private getKey(table: string, query?: string): string {
        const queryHash = query ? this.hashString(query) : 'all';
        return `${CACHE_PREFIX}${table}_${queryHash}_${CACHE_VERSION}`;
    }

    /**
     * Génère une clé pour les métadonnées
     */
    private getMetaKey(table: string, query?: string): string {
        const queryHash = query ? this.hashString(query) : 'all';
        return `${CACHE_META_PREFIX}${table}_${queryHash}_${CACHE_VERSION}`;
    }

    /**
     * Hash simple pour les requêtes
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Sauvegarde des données dans le cache
     */
    set<T>(table: string, data: T, query?: string, etag?: string): void {
        const key = this.getKey(table, query);
        const metaKey = this.getMetaKey(table, query);
        const timestamp = Date.now();

        const entry: CacheEntry<T> = {
            data,
            meta: {
                version: CACHE_VERSION,
                timestamp,
                etag
            }
        };

        // Cache en mémoire pour accès ultra-rapide
        this.memoryCache.set(key, entry);
        this.cleanupMemoryCache();

        // Cache dans localStorage pour persistance
        try {
            localStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(metaKey, JSON.stringify(entry.meta));
        } catch (e) {
            // Si localStorage est plein, nettoyer les anciennes entrées
            this.cleanupOldEntries();
            try {
                localStorage.setItem(key, JSON.stringify(data));
                localStorage.setItem(metaKey, JSON.stringify(entry.meta));
            } catch (e2) {
                console.warn('[DataCache] Unable to cache data:', e2);
            }
        }
    }

    /**
     * Récupère des données du cache
     */
    get<T>(table: string, query?: string, maxAge?: number): T | null {
        const key = this.getKey(table, query);

        // Essayer d'abord le cache mémoire (plus rapide)
        const memoryEntry = this.memoryCache.get(key);
        if (memoryEntry) {
            if (!maxAge || (Date.now() - memoryEntry.meta.timestamp) < maxAge) {
                return memoryEntry.data as T;
            }
        }

        // Sinon, essayer localStorage
        try {
            const data = localStorage.getItem(key);
            const metaStr = localStorage.getItem(this.getMetaKey(table, query));

            if (data && metaStr) {
                const meta: CacheMeta = JSON.parse(metaStr);

                // Vérifier la version
                if (meta.version !== CACHE_VERSION) {
                    this.remove(table, query);
                    return null;
                }

                // Vérifier l'âge si maxAge spécifié
                if (maxAge && (Date.now() - meta.timestamp) > maxAge) {
                    return null;
                }

                const parsed = JSON.parse(data) as T;

                // Mettre à jour le cache mémoire
                this.memoryCache.set(key, { data: parsed, meta });

                return parsed;
            }
        } catch (e) {
            console.warn('[DataCache] Error reading cache:', e);
        }

        return null;
    }

    /**
     * Récupère les métadonnées du cache
     */
    getMeta(table: string, query?: string): CacheMeta | null {
        try {
            const metaStr = localStorage.getItem(this.getMetaKey(table, query));
            if (metaStr) {
                return JSON.parse(metaStr) as CacheMeta;
            }
        } catch (e) {
            console.warn('[DataCache] Error reading cache meta:', e);
        }
        return null;
    }

    /**
     * Vérifie si des données en cache sont valides
     */
    isValid(table: string, query?: string, maxAge?: number): boolean {
        const meta = this.getMeta(table, query);
        if (!meta) return false;
        if (meta.version !== CACHE_VERSION) return false;
        if (maxAge && (Date.now() - meta.timestamp) > maxAge) return false;
        return true;
    }

    /**
     * Supprime une entrée du cache
     */
    remove(table: string, query?: string): void {
        const key = this.getKey(table, query);
        const metaKey = this.getMetaKey(table, query);

        this.memoryCache.delete(key);

        try {
            localStorage.removeItem(key);
            localStorage.removeItem(metaKey);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Supprime toutes les entrées d'une table
     */
    clearTable(table: string): void {
        const prefix = `${CACHE_PREFIX}${table}_`;
        const metaPrefix = `${CACHE_META_PREFIX}${table}_`;

        // Supprimer du cache mémoire
        for (const key of this.memoryCache.keys()) {
            if (key.startsWith(prefix)) {
                this.memoryCache.delete(key);
            }
        }

        // Supprimer de localStorage
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(prefix) || key.startsWith(metaPrefix))) {
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.warn('[DataCache] Error clearing table cache:', e);
        }
    }

    /**
     * Nettoie tout le cache
     */
    clearAll(): void {
        this.memoryCache.clear();

        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_META_PREFIX))) {
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.warn('[DataCache] Error clearing all cache:', e);
        }
    }

    /**
     * Nettoie les vieilles entrées du cache localStorage
     */
    private cleanupOldEntries(): void {
        const entries: Array<{ key: string; metaKey: string; timestamp: number }> = [];

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    const metaKey = key.replace(CACHE_PREFIX, CACHE_META_PREFIX);
                    const metaStr = localStorage.getItem(metaKey);
                    if (metaStr) {
                        const meta: CacheMeta = JSON.parse(metaStr);
                        entries.push({ key, metaKey, timestamp: meta.timestamp });
                    }
                }
            }

            // Trier par ancienneté et supprimer les 20% les plus vieux
            entries.sort((a, b) => a.timestamp - b.timestamp);
            const toDelete = Math.ceil(entries.length * 0.2);

            for (let i = 0; i < toDelete; i++) {
                localStorage.removeItem(entries[i].key);
                localStorage.removeItem(entries[i].metaKey);
            }
        } catch (e) {
            console.warn('[DataCache] Error during cleanup:', e);
        }
    }

    /**
     * Nettoie le cache mémoire si trop grand
     */
    private cleanupMemoryCache(): void {
        if (this.memoryCache.size > this.maxMemoryItems) {
            const entries = Array.from(this.memoryCache.entries());
            const toRemove = entries.slice(0, entries.length - this.maxMemoryItems);
            toRemove.forEach(([key]) => this.memoryCache.delete(key));
        }
    }

    /**
     * Récupère toutes les données d'une table depuis le cache
     */
    getTableData<T>(table: string): T[] | null {
        return this.get<T[]>(table, undefined, 24 * 60 * 60 * 1000); // 24h max
    }

    /**
     * Sauvegarde toutes les données d'une table dans le cache
     */
    setTableData<T>(table: string, data: T[]): void {
        this.set(table, data, undefined);
    }
}

// Instance singleton
export const dataCache = new DataCache();

export default dataCache;
