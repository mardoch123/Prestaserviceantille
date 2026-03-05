import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor';

  return {
    // En mode Android (Capacitor), on force des chemins relatifs pour charger correctement depuis file://
    base: isCapacitor ? './' : undefined,
    plugins: [
      react(),
      nodePolyfills({
        // To exclude specific polyfills, add them to this list.
        exclude: [],
        // Whether to polyfill `global`.
        globals: {
          global: true,
        },
        // Whether to polyfill `process`.
        protocolImports: true,
      })
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
      include: ['simple-peer']
    }
  };
})
