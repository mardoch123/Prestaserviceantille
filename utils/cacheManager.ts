/**
 * Gestionnaire de cache pour l'application
 * Gère le vidage automatique des caches lors des mises à jour
 */

const CACHE_VERSION_KEY = 'presta_cache_version';
const APP_VERSION_KEY = 'presta_app_version';

/**
 * Récupère la version actuelle de l'application depuis le build
 */
export function getCurrentAppVersion(): string {
  // Vite injecte la version via import.meta.env
  return (import.meta.env.VITE_APP_VERSION as string) || 
         (import.meta.env.VITE_BUILD_TIME as string) || 
         new Date().toISOString();
}

/**
 * Récupère la version stockée localement
 */
export function getStoredAppVersion(): string | null {
  try {
    return localStorage.getItem(APP_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Stocke la version actuelle de l'application
 */
export function setStoredAppVersion(version: string): void {
  try {
    localStorage.setItem(APP_VERSION_KEY, version);
  } catch {
    // Ignore
  }
}

/**
 * Vérifie si une nouvelle version est disponible
 */
export function isNewVersionAvailable(): boolean {
  const current = getCurrentAppVersion();
  const stored = getStoredAppVersion();
  
  if (!stored) {
    // Première visite, stocker la version actuelle
    setStoredAppVersion(current);
    return false;
  }
  
  return current !== stored;
}

/**
 * Nettoie tous les caches du navigateur
 */
export async function clearBrowserCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log('[CacheManager] Suppression du cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
      console.log('[CacheManager] Tous les caches ont été nettoyés');
    } catch (error) {
      console.error('[CacheManager] Erreur lors du nettoyage des caches:', error);
    }
  }
}

/**
 * Nettoie le localStorage (sauf les données utilisateur importantes)
 */
export function clearLocalStorage(): void {
  try {
    // Conserver les données utilisateur essentielles
    const keysToPreserve = [
      'supabase.auth.token',
      'presta_user_session',
      'presta_demo_mode',
      'presta_service_type_filter',
      'presta_ui_sober_mode'
    ];
    
    const preserved: Record<string, string> = {};
    
    // Sauvegarder les valeurs à préserver
    keysToPreserve.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        preserved[key] = value;
      }
    });
    
    // Nettoyer tout le localStorage
    localStorage.clear();
    
    // Restaurer les valeurs préservées
    Object.entries(preserved).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    
    console.log('[CacheManager] localStorage nettoyé (données utilisateur préservées)');
  } catch (error) {
    console.error('[CacheManager] Erreur lors du nettoyage du localStorage:', error);
  }
}

/**
 * Nettoie le sessionStorage
 */
export function clearSessionStorage(): void {
  try {
    sessionStorage.clear();
    console.log('[CacheManager] sessionStorage nettoyé');
  } catch (error) {
    console.error('[CacheManager] Erreur lors du nettoyage du sessionStorage:', error);
  }
}

/**
 * Envoie un message au service worker pour nettoyer les caches
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const controller = navigator.serviceWorker.controller;
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data?.type === 'CACHE_CLEARED') {
          console.log('[CacheManager] Service Worker a nettoyé les caches');
          resolve();
        }
      };
      
      controller.postMessage(
        { type: 'REFRESH_CACHE' },
        [messageChannel.port2]
      );
      
      // Timeout de sécurité
      setTimeout(resolve, 3000);
    });
  }
}

/**
 * Nettoie tous les caches de l'application (navigateur + service worker + storage)
 * À appeler lors d'une mise à jour de version
 */
export async function clearAllAppCaches(): Promise<void> {
  console.log('[CacheManager] Début du nettoyage complet des caches...');
  
  await Promise.all([
    clearBrowserCaches(),
    clearServiceWorkerCaches(),
    clearSessionStorage(),
  ]);
  
  // Nettoyer le localStorage après les autres opérations
  clearLocalStorage();
  
  // Mettre à jour la version stockée
  setStoredAppVersion(getCurrentAppVersion());
  
  console.log('[CacheManager] Nettoyage complet terminé');
}

/**
 * Fonction principale à appeler au démarrage de l'application
 * Vérifie si une nouvelle version est disponible et nettoie les caches si nécessaire
 * @returns true si un nettoyage a été effectué (nécessite potentiellement un reload)
 */
export async function checkAndClearCacheOnUpdate(): Promise<boolean> {
  if (isNewVersionAvailable()) {
    console.log('[CacheManager] Nouvelle version détectée, nettoyage des caches...');
    await clearAllAppCaches();
    return true;
  }
  return false;
}

/**
 * Force le rechargement de la page après nettoyage des caches
 */
export function reloadPage(hardReload: boolean = true): void {
  if (hardReload) {
    // Force un hard reload sans utiliser le cache
    window.location.href = window.location.href + '?nocache=' + Date.now();
  } else {
    window.location.reload();
  }
}

/**
 * Déclencheur manuel de mise à jour
 * À utiliser pour un bouton "Mettre à jour l'application"
 */
export async function triggerAppUpdate(): Promise<void> {
  await clearAllAppCaches();
  
  // Mettre à jour la version stockée
  setStoredAppVersion(getCurrentAppVersion());
  
  // Recharger la page
  reloadPage(true);
}

export default {
  getCurrentAppVersion,
  getStoredAppVersion,
  isNewVersionAvailable,
  clearBrowserCaches,
  clearLocalStorage,
  clearSessionStorage,
  clearServiceWorkerCaches,
  clearAllAppCaches,
  checkAndClearCacheOnUpdate,
  reloadPage,
  triggerAppUpdate,
};
