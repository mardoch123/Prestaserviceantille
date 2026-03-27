import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import { versionInjectorPlugin } from './scripts/version-plugin'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor';

  return {
    // En mode Android (Capacitor), on force des chemins relatifs pour charger correctement depuis file://
    base: isCapacitor ? './' : undefined,
    plugins: [
      react(),
      versionInjectorPlugin(), // Inject version meta tags
      nodePolyfills({
        exclude: [],
        globals: {
          global: true,
        },
        protocolImports: true,
      }),
      // PWA Plugin avec Workbox intégré
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        filename: 'service-worker.js',
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,gif,woff,woff2,ttf,json}'],
          maximumFileSizeToCacheInBytes: 7 * 1024 * 1024, // 7 MB
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/rest\/v1\//, /^\/auth\/v1\//, /^\/service-worker\.js$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/myzbkbqkjykdsaymujvl\.supabase\.co\/rest\/v1\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https:\/\/anciens\.prestaservicesantilles\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'legacy-assets-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: 'Presta Services Antilles',
          short_name: 'Presta',
          description: 'Application de gestion pour Presta Services Antilles',
          theme_color: '#0d9488',
          background_color: '#fafaf9',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: '/icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png',
              purpose: 'maskable any'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable any'
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    optimizeDeps: {
      include: ['simple-peer', 'localforage', '@tanstack/react-query']
    }
  };
})
