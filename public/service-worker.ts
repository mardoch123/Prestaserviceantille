/**
 * Service Worker avec Workbox
 * Stratégie ultra-fiable pour les connexions lentes et offline
 * @ts-nocheck - Service Worker utilise des APIs non typées
 */

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { 
  StaleWhileRevalidate, 
  CacheFirst, 
  NetworkFirst,
  NetworkOnly 
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim, skipWaiting } from 'workbox-core';

// Déclaration pour TypeScript
declare const self: any;

// ============ CONFIGURATION ============

// Pre-cache tous les assets de build
precacheAndRoute(self.__WB_MANIFEST);

// Prendre le contrôle immédiatement
clientsClaim();
skipWaiting();

// ============ STRATÉGIES DE CACHE ============

// 1. API Supabase - NetworkFirst avec fallback cache
// Essaie le réseau d'abord, utilise le cache si offline
registerRoute(
  ({ url }) => url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/'),
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 24 * 60 * 60, // 24 heures
      }),
    ],
  })
);

// 2. Images - CacheFirst avec expiration
// Images rarement modifiées, cache long
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// 3. Fonts - CacheFirst
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 an
      }),
    ],
  })
);

// 4. CSS et JS - StaleWhileRevalidate
// Sert du cache immédiatement, met à jour en arrière-plan
registerRoute(
  ({ request }) => 
    request.destination === 'style' || 
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 jours
      }),
    ],
  })
);

// 5. API avec Background Sync pour mutations offline
// Sauvegarde les requêtes POST/PUT/DELETE quand offline
registerRoute(
  ({ url, request }) => {
    const isApi = url.pathname.includes('/rest/v1/');
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    return isApi && isMutation;
  },
  new NetworkOnly({
    plugins: [
      new BackgroundSyncPlugin('supabase-mutations', {
        maxRetentionTime: 24 * 60, // 24 heures en minutes
        onSync: async ({ queue }) => {
          let entry;
          while ((entry = await queue.shiftRequest())) {
            try {
              await fetch(entry.request);
              console.log('[Workbox] Sync réussi pour:', entry.request.url);
            } catch (error) {
              await queue.unshiftRequest(entry);
              console.error('[Workbox] Échec sync:', error);
              throw error;
            }
          }
        },
      }),
    ],
  })
);

// 6. Fallback pour toutes les autres requêtes
registerRoute(
  ({ url }) => url.origin === location.origin,
  new NetworkFirst({
    cacheName: 'fallback-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
      }),
    ],
  })
);

// ============ GESTION DES ÉVÉNEMENTS ============

// Écouter les messages du client
self.addEventListener('message', (event: MessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'PING') {
    event.ports[0]?.postMessage('PONG');
  }
  
  // Forcer le rafraîchissement complet du cache
  if (event.data && event.data.type === 'REFRESH_CACHE') {
    console.log('[Service Worker] Rafraîchissement du cache demandé');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Ne pas supprimer le cache API
          if (!cacheName.includes('supabase-api')) {
            console.log('[Service Worker] Suppression:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Informer le client que le cache est nettoyé
        event.source?.postMessage({ type: 'CACHE_CLEARED' });
      });
    });
  }
  
  // Vérifier les mises à jour
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    console.log('[Service Worker] Vérification des mises à jour...');
    self.registration.update();
  }
});

// Gestion de l'installation
self.addEventListener('install', (event: any) => {
  console.log('[Service Worker] Installation...');
  event.waitUntil(self.skipWaiting());
});

// Gestion de l'activation
self.addEventListener('activate', (event: any) => {
  console.log('[Service Worker] Activation...');
  
  // Nettoyer TOUS les vieux caches (sauf celui de l'API Supabase pour les données)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Garder uniquement le cache API Supabase et le nouveau cache d'assets
            const validCaches = [
              'supabase-api-cache',
              'workbox-precache-v2-' + self.registration.scope,
            ];
            return !validCaches.some(valid => cacheName.startsWith(valid) || cacheName === valid);
          })
          .map((cacheName) => {
            console.log('[Service Worker] Suppression du cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  
  // Prendre le contrôle immédiatement de toutes les pages
  event.waitUntil(self.clients.claim());
  
  // Informer tous les clients que le SW est activé
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients: any[]) => {
      clients.forEach((client: any) => {
        client.postMessage({ type: 'SW_ACTIVATED', version: new Date().toISOString() });
      });
    })
  );
});

// Gestion des erreurs de fetch avec fallback
self.addEventListener('fetch', (event: any) => {
  const { request } = event;
  
  // Fallback pour les images qui timeout
  if (request.destination === 'image') {
    event.respondWith(
      fetch(request).catch(() => {
        // Retourner une image placeholder si offline/timeout
        return new Response(
          `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <rect width="100" height="100" fill="#f0f0f0"/>
            <text x="50" y="50" text-anchor="middle" dy=".3em" fill="#999">Image offline</text>
          </svg>`,
          {
            headers: { 'Content-Type': 'image/svg+xml' },
            status: 200,
          }
        );
      })
    );
  }
});

// Sync périodique pour rafraîchir les données (quand l'app revient online)
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'refresh-data') {
    event.waitUntil(
      self.clients.matchAll().then((clients: any[]) => {
        clients.forEach((client: any) => {
          client.postMessage({ type: 'REFRESH_DATA' });
        });
      })
    );
  }
});

// Notification push (pour futures fonctionnalités)
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Presta Services Antilles';
  const options: NotificationOptions = {
    body: data.body || 'Nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: data.data || {},
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

export {};
