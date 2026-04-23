/**
 * Module d'enregistrement du Service Worker
 * Gère l'installation et la communication avec Workbox
 */

import { Workbox } from 'workbox-window';

let wb: Workbox | null = null;

// Enregistrer le service worker
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    wb = new Workbox('/service-worker.js');

    // Événement: Nouvelle version disponible
    wb.addEventListener('waiting', (event) => {
      console.log('[SW] Nouvelle version disponible');
      
      // Afficher une notification à l'utilisateur
      const updateAccepted = window.confirm(
        'Une nouvelle version de l\'application est disponible. Mettre à jour maintenant ?'
      );
      
      if (updateAccepted) {
        wb?.messageSkipWaiting();
      }
    });

    // Événement: Controlling - le SW prend le contrôle
    wb.addEventListener('controlling', (event) => {
      console.log('[SW] Service Worker prend le contrôle - rechargement...');
      // Forcer le rechargement pour utiliser les nouveaux caches
      window.location.reload();
    });

    // Événement: Activé
    wb.addEventListener('activated', (event) => {
      console.log('[SW] Service Worker activé');
      
      // Vérifier si on est en mode offline
      if (!navigator.onLine) {
        console.log('[SW] Application fonctionne en mode offline');
      }
    });

    // Enregistrer le SW
    wb.register()
      .then((registration) => {
        console.log('[SW] Enregistré avec succès:', registration);
      })
      .catch((error) => {
        console.error('[SW] Échec de l\'enregistrement:', error);
      });

    // Écouter les messages du SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'REFRESH_DATA') {
        console.log('[SW] Rafraîchissement des données demandé');
        // Déclencher un refresh des données via React Query
        window.dispatchEvent(new CustomEvent('sw-refresh-data'));
      }

      // Quand le cache est nettoyé via message
      if (event.data?.type === 'CACHE_CLEARED') {
        console.log('[SW] Cache nettoyé via message');
        // Option: recharger la page après nettoyage
        // window.location.reload();
      }

      // Quand le SW est activé (nouvelle version déployée)
      if (event.data?.type === 'SW_ACTIVATED') {
        console.log('[SW] Nouveau SW activé:', event.data.version);

        // Si le cache a été nettoyé lors de l'activation, informer l'application
        if (event.data?.cacheCleared) {
          console.log('[SW] Cache automatiquement nettoyé lors de la mise à jour');
          window.dispatchEvent(new CustomEvent('sw-cache-cleared', {
            detail: { version: event.data.version }
          }));
        }
      }
    });

    // Gérer les changements de connexion
    window.addEventListener('online', () => {
      console.log('[SW] Connexion rétablie');
      wb?.messageSW({ type: 'PING' });
    });

    window.addEventListener('offline', () => {
      console.log('[SW] Mode offline activé');
    });

    // Vérifier les mises à jour toutes les 5 minutes et à chaque reprise de connexion
    setInterval(() => {
      console.log('[SW] Vérification périodique des mises à jour...');
      wb?.update();
    }, 5 * 60 * 1000); // 5 minutes

    return wb;
  }

  return null;
}

// Désenregistrer le service worker (pour le développement)
export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.unregister();
    console.log('[SW] Service Worker désenregistré');
  }
}

// Forcer la mise à jour du service worker
export async function updateServiceWorker() {
  if (wb) {
    await wb.update();
    console.log('[SW] Mise à jour forcée');
  }
}

// Vérifier si le SW est actif
export function isServiceWorkerActive(): boolean {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
}

// Envoyer un message au service worker
export async function messageServiceWorker(type: string, data?: any) {
  if (wb) {
    const response = await wb.messageSW({ type, data });
    return response;
  }
  return null;
}

// Nettoyer tous les caches
export async function clearAllCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );
    console.log('[SW] Tous les caches nettoyés');
  }
}

export default registerServiceWorker;
