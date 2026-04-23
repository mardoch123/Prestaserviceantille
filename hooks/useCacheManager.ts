/**
 * Hook React pour gérer le cache de l'application
 * Gère le vidage automatique des caches lors des mises à jour
 */

import { useEffect, useState, useCallback } from 'react';
import {
  checkAndClearCacheOnUpdate,
  isNewVersionAvailable,
  triggerAppUpdate,
  clearAllAppCaches,
  getCurrentAppVersion,
  getStoredAppVersion,
} from '../utils/cacheManager';

interface UseCacheManagerReturn {
  /** Indique si une nouvelle version est disponible */
  isUpdateAvailable: boolean;
  /** Version actuelle de l'application */
  currentVersion: string;
  /** Version stockée localement */
  storedVersion: string | null;
  /** Déclenche la mise à jour de l'application */
  updateApp: () => Promise<void>;
  /** Nettoie tous les caches manuellement */
  clearCaches: () => Promise<void>;
  /** Vérifie si une mise à jour est disponible */
  checkForUpdate: () => boolean;
  /** Indique si le cache est en cours de nettoyage */
  isClearing: boolean;
}

/**
 * Hook pour gérer le cache de l'application
 * @param options Options de configuration
 * @returns Méthodes et états pour gérer le cache
 */
export function useCacheManager(options: {
  /** Si true, vérifie et nettoie le cache au montage du composant */
  checkOnMount?: boolean;
  /** Si true, recharge la page automatiquement après nettoyage */
  autoReload?: boolean;
  /** Intervalle de vérification des mises à jour en ms (0 pour désactiver) */
  checkInterval?: number;
} = {}): UseCacheManagerReturn {
  const {
    checkOnMount = true,
    autoReload = false,
    checkInterval = 0,
  } = options;

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [storedVersion, setStoredVersion] = useState<string | null>(null);

  // Initialiser les versions
  useEffect(() => {
    setCurrentVersion(getCurrentAppVersion());
    setStoredVersion(getStoredAppVersion());
  }, []);

  // Vérifier les mises à jour
  const checkForUpdate = useCallback((): boolean => {
    const hasUpdate = isNewVersionAvailable();
    setIsUpdateAvailable(hasUpdate);
    setCurrentVersion(getCurrentAppVersion());
    setStoredVersion(getStoredAppVersion());
    return hasUpdate;
  }, []);

  // Nettoyer les caches
  const clearCaches = useCallback(async (): Promise<void> => {
    setIsClearing(true);
    try {
      await clearAllAppCaches();
      checkForUpdate();
    } finally {
      setIsClearing(false);
    }
  }, [checkForUpdate]);

  // Mettre à jour l'application
  const updateApp = useCallback(async (): Promise<void> => {
    setIsClearing(true);
    try {
      await triggerAppUpdate();
    } finally {
      setIsClearing(false);
    }
  }, []);

  // Vérifier au montage
  useEffect(() => {
    if (checkOnMount) {
      const init = async () => {
        const cleared = await checkAndClearCacheOnUpdate();
        if (cleared && autoReload) {
          window.location.reload();
        } else {
          checkForUpdate();
        }
      };
      init();
    }
  }, [checkOnMount, autoReload, checkForUpdate]);

  // Vérification périodique
  useEffect(() => {
    if (checkInterval > 0) {
      const intervalId = setInterval(() => {
        checkForUpdate();
      }, checkInterval);

      return () => clearInterval(intervalId);
    }
  }, [checkInterval, checkForUpdate]);

  return {
    isUpdateAvailable,
    currentVersion,
    storedVersion,
    updateApp,
    clearCaches,
    checkForUpdate,
    isClearing,
  };
}

export default useCacheManager;
