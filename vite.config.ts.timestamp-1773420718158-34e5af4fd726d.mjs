// vite.config.ts
import { defineConfig } from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/@vitejs/plugin-react/dist/index.js";
import { nodePolyfills } from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/vite-plugin-node-polyfills/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const isCapacitor = mode === "capacitor";
  return {
    // En mode Android (Capacitor), on force des chemins relatifs pour charger correctement depuis file://
    base: isCapacitor ? "./" : void 0,
    plugins: [
      react(),
      nodePolyfills({
        // To exclude specific polyfills, add them to this list.
        exclude: [],
        // Whether to polyfill `global`.
        globals: {
          global: true
        },
        // Whether to polyfill `process`.
        protocolImports: true
      })
    ],
    build: {
      outDir: "dist"
    },
    server: {
      port: 3e3,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false
        }
      }
    },
    optimizeDeps: {
      include: ["simple-peer"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNQVJET0NIRUVcXFxcRG9jdW1lbnRzXFxcXFByZXN0YSAtIENvcHlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXE1BUkRPQ0hFRVxcXFxEb2N1bWVudHNcXFxcUHJlc3RhIC0gQ29weVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvTUFSRE9DSEVFL0RvY3VtZW50cy9QcmVzdGElMjAtJTIwQ29weS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHsgbm9kZVBvbHlmaWxscyB9IGZyb20gJ3ZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGlzQ2FwYWNpdG9yID0gbW9kZSA9PT0gJ2NhcGFjaXRvcic7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICAvLyBFbiBtb2RlIEFuZHJvaWQgKENhcGFjaXRvciksIG9uIGZvcmNlIGRlcyBjaGVtaW5zIHJlbGF0aWZzIHBvdXIgY2hhcmdlciBjb3JyZWN0ZW1lbnQgZGVwdWlzIGZpbGU6Ly9cclxuICAgIGJhc2U6IGlzQ2FwYWNpdG9yID8gJy4vJyA6IHVuZGVmaW5lZCxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgcmVhY3QoKSxcclxuICAgICAgbm9kZVBvbHlmaWxscyh7XHJcbiAgICAgICAgLy8gVG8gZXhjbHVkZSBzcGVjaWZpYyBwb2x5ZmlsbHMsIGFkZCB0aGVtIHRvIHRoaXMgbGlzdC5cclxuICAgICAgICBleGNsdWRlOiBbXSxcclxuICAgICAgICAvLyBXaGV0aGVyIHRvIHBvbHlmaWxsIGBnbG9iYWxgLlxyXG4gICAgICAgIGdsb2JhbHM6IHtcclxuICAgICAgICAgIGdsb2JhbDogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8vIFdoZXRoZXIgdG8gcG9seWZpbGwgYHByb2Nlc3NgLlxyXG4gICAgICAgIHByb3RvY29sSW1wb3J0czogdHJ1ZSxcclxuICAgICAgfSlcclxuICAgIF0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcG9ydDogMzAwMCxcbiAgICAgIHByb3h5OiB7XG4gICAgICAgICcvYXBpJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGluY2x1ZGU6IFsnc2ltcGxlLXBlZXInXVxyXG4gICAgfVxyXG4gIH07XHJcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThULFNBQVMsb0JBQW9CO0FBQzNWLE9BQU8sV0FBVztBQUNsQixTQUFTLHFCQUFxQjtBQUc5QixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLGNBQWMsU0FBUztBQUU3QixTQUFPO0FBQUE7QUFBQSxJQUVMLE1BQU0sY0FBYyxPQUFPO0FBQUEsSUFDM0IsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sY0FBYztBQUFBO0FBQUEsUUFFWixTQUFTLENBQUM7QUFBQTtBQUFBLFFBRVYsU0FBUztBQUFBLFVBQ1AsUUFBUTtBQUFBLFFBQ1Y7QUFBQTtBQUFBLFFBRUEsaUJBQWlCO0FBQUEsTUFDbkIsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxJQUNWO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsUUFDVjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWixTQUFTLENBQUMsYUFBYTtBQUFBLElBQ3pCO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
