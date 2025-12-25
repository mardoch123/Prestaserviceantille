import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
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
    port: 3000
  },
  optimizeDeps: {
    include: ['simple-peer']
  }
})