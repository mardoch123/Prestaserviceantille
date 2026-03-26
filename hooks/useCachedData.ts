/**
 * Hook pour utiliser les données en cache
 * Permet aux composants de récupérer immédiatement des données du cache
 * pendant que les données fraîches se chargent en arrière-plan
 */

import { useState, useEffect, useCallback } from 'react';
import { dataCache } from '../utils/dataCache';

interface UseCachedDataOptions<T> {
    maxAge?: number; // Durée max du cache en ms (défaut: 5 minutes)
    enabled?: boolean; // Activer le cache (défaut: true)
}

interface UseCachedDataResult<T> {
    data: T | null;
    isLoading: boolean;
    isCached: boolean;
    error: Error | null;
    refresh: () => void;
}

/**
 * Hook pour récupérer des données depuis le cache immédiatement
 * @param key - Clé de cache
 * @param options - Options de configuration
 * @returns Données en cache et état de chargement
 */
export function useCachedData<T>(
    key: string,
    options: UseCachedDataOptions<T> = {}
): UseCachedDataResult<T> {
    const { maxAge = 5 * 60 * 1000, enabled = true } = options;

    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCached, setIsCached] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const loadFromCache = useCallback(() => {
        if (!enabled) {
            setIsLoading(false);
            return;
        }

        try {
            const cached = dataCache.get<T>(key, undefined, maxAge);
            if (cached) {
                setData(cached);
                setIsCached(true);
                setIsLoading(false);
            } else {
                // Essayer avec une durée plus longue (données périmées)
                const staleCached = dataCache.get<T>(key, undefined, 24 * 60 * 60 * 1000);
                if (staleCached) {
                    setData(staleCached);
                    setIsCached(true);
                    setIsLoading(false);
                } else {
                    setIsLoading(false);
                }
            }
        } catch (e) {
            setError(e as Error);
            setIsLoading(false);
        }
    }, [key, maxAge, enabled]);

    const refresh = useCallback(() => {
        setIsLoading(true);
        setError(null);
        loadFromCache();
    }, [loadFromCache]);

    useEffect(() => {
        loadFromCache();
    }, [loadFromCache]);

    return {
        data,
        isLoading,
        isCached,
        error,
        refresh
    };
}

/**
 * Hook pour les données de table spécifique
 * Pré-configuré pour les tables communes de Presta Services
 */
export function useCachedTable<T>(table: string, maxAge?: number) {
    return useCachedData<T[]>(table, { maxAge: maxAge || 5 * 60 * 1000 });
}

export default useCachedData;
