import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import { versionInjectorPlugin } from './scripts/version-plugin'
import fs from 'fs'
import path from 'path'

// Plugin pour servir src/assets/cacheTetsSignature.jpg à l'URL /assets/cacheTetsSignature.jpg
// (référence codée en dur dans components/DevisFactures.tsx et NewServiceRequestPage.tsx)
function cacheTetsSignaturePlugin() {
  const SRC = path.resolve(__dirname, 'src/assets/cacheTetsSignature.jpg')
  const URL_PATH = '/assets/cacheTetsSignature.jpg'
  return {
    name: 'vite:cacheTetsSignature',
    configureServer(server: any) {
      server.middlewares.use(URL_PATH, (_req: any, res: any, next: any) => {
        if (!fs.existsSync(SRC)) return next()
        res.setHeader('Content-Type', 'image/jpeg')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        fs.createReadStream(SRC).pipe(res)
      })
    },
    apply: 'build' as const,
    enforce: 'pre' as const,
    generateBundle(this: any, _options: any, bundle: any) {
      if (!fs.existsSync(SRC)) return
      const fileName = 'assets/cacheTetsSignature.jpg'
      if (bundle[fileName]) return
      this.emitFile({ type: 'file', fileName, source: fs.readFileSync(SRC) })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const isCapacitor = mode === 'capacitor';

  // Générer un identifiant unique de build basé sur la date/heure
  // Ce sera utilisé pour détecter les mises à jour et vider le cache
  const buildTime = new Date().toISOString();
  const appVersion = process.env.npm_package_version || '1.0.0';

  return {
    // En mode Android (Capacitor), on force des chemins relatifs pour charger correctement depuis file://
    base: isCapacitor ? './' : undefined,

    // Injecter la version et le build time comme variables d'environnement
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
    },

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
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB (chunk main si le code-splitting saute)
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
      cacheTetsSignaturePlugin(),
    ],
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          // Chemins relatifs uniquement en mode capacitor
          ...(isCapacitor ? {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          } : {}),
          // Code-splitting : TOUJOURS actif pour toute commande de build (`vite build`),
          // quel que soit NODE_ENV. L'ancien garde process.env.NODE_ENV==='production'
          // désactivait le splitting sur le VPS (NODE_ENV=y production) → chunk unique
          // > 7 MB et échec du precache Workbox.
          // IMPORTANT (éprouvé) : ne jamais isoler un paquet dont les ré-exports ou
          // dépendances partagées restent dans le chunk principal → cycle entre chunks
          // et erreur runtime « Cannot access 'X' before initialization » (écran blanc).
          // Sont donc INTERDITS de splitting : @supabase/realtime-js, @supabase/storage-js
          // (cycles avec supabase-js) et recharts/d3/victory-vendor (cycles via les
          // ré-exports). Seuls les packages réellement feuillus sont extraits.
          manualChunks: command === 'build' ? (id: string) => {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            const normalized = id.replace(/\\/g, '/');
            const vendorRules: Array<[RegExp, string]> = [
              [/react-router|@remix-run/, 'router'],
              [/@react-spring/, 'react-spring'],
              [/jspdf|html2canvas/, 'pdf'],
              [/@tanstack\/(react-)?query/, 'query'],
              [/@dnd-kit/, 'dnd'],
              [/@capacitor/, 'capacitor'],
              [/@react-google-maps/, 'gmaps'],
              [/(^|\/)(react-dom|react|scheduler)(\/|\.|$)/, 'react'],
              [/(^|\/)date-fns(\/|\.|$)/, 'date-fns'],
              [/@supabase\/supabase-js/, 'supabase'],
              [/@simplewebauthn/, 'webauthn'],
              [/localforage/, 'localforage'],
            ];
            for (const [regex, name] of vendorRules) {
              if (regex.test(normalized)) return `vendor-${name}`;
            }
            // Le reste de node_modules : on le laisse dans le bundle principal par défaut
            // pour éviter de splitter finement des paquets potentiellement cycliques.
            return undefined;
          } : undefined,
        },
      },
      chunkSizeWarningLimit: 700,
      sourcemap: false,
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
