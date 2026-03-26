/**
 * Configuration Workbox pour le build
 * Génère un service worker optimisé pour Presta Services Antilles
 */

module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,png,jpg,jpeg,svg,gif,woff,woff2,ttf,json}',
  ],
  swDest: 'dist/service-worker.js',
  swSrc: 'public/service-worker.ts',
  
  // Mode injection des assets pré-cachés
  injectionPoint: 'self.__WB_MANIFEST',
  
  // Configuration des pages
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [
    /\/api\//,
    /\/rest\/v1\//,
    /\/auth\/v1\//,
  ],
  
  // Runtime caching
  runtimeCaching: [
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-runtime-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\.(?:woff|woff2|ttf|otf)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts-runtime-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 an
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/myzbkbqkjykdsaymujvl\.supabase\.co\/rest\/v1\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api-cache',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 24 * 60 * 60, // 24 heures
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /^https:\/\/myzbkbqkjykdsaymujvl\.supabase\.co\/auth\/v1\/.*/,
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'auth-background-sync',
          options: {
            maxRetentionTime: 24 * 60,
          },
        },
      },
    },
    {
      urlPattern: /^https:\/\/anciens\.prestaservicesantilles\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'legacy-assets-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
  
  // Skip waiting pour activation immédiate
  skipWaiting: true,
  clientsClaim: true,
  
  // Mode dev
  mode: 'production',
  
  // Source maps
  sourcemap: true,
};
