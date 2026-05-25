// vite.config.ts
import { defineConfig } from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/@vitejs/plugin-react/dist/index.js";
import { nodePolyfills } from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { VitePWA } from "file:///C:/Users/MARDOCHEE/Documents/Presta%20-%20Copy/node_modules/vite-plugin-pwa/dist/index.js";

// scripts/version-plugin.ts
import fs from "fs";
import path from "path";
function versionInjectorPlugin() {
  return {
    name: "version-injector",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => {
        try {
          const versionPath = path.resolve(process.cwd(), "public", "version.json");
          const versionData = JSON.parse(fs.readFileSync(versionPath, "utf8"));
          const metaTags = `
    <meta name="app-version" content="${versionData.version}">
    <meta name="app-build-number" content="${versionData.buildNumber}">
    <meta name="app-build-date" content="${versionData.buildDate}">
`;
          return html.replace("<head>", `<head>${metaTags}`);
        } catch (error) {
          console.warn("[version-injector] Could not inject version meta tags:", error);
          return html;
        }
      }
    }
  };
}

// vite.config.ts
var vite_config_default = defineConfig(({ mode }) => {
  const isCapacitor = mode === "capacitor";
  const buildTime = (/* @__PURE__ */ new Date()).toISOString();
  const appVersion = process.env.npm_package_version || "1.0.0";
  return {
    // En mode Android (Capacitor), on force des chemins relatifs pour charger correctement depuis file://
    base: isCapacitor ? "./" : void 0,
    // Injecter la version et le build time comme variables d'environnement
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime)
    },
    plugins: [
      react(),
      versionInjectorPlugin(),
      // Inject version meta tags
      nodePolyfills({
        exclude: [],
        globals: {
          global: true
        },
        protocolImports: true
      }),
      // PWA Plugin avec Workbox intégré
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        filename: "service-worker.js",
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,svg,gif,woff,woff2,ttf,json}"],
          maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
          // 7 MB
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//, /^\/rest\/v1\//, /^\/auth\/v1\//, /^\/service-worker\.js$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/myzbkbqkjykdsaymujvl\.supabase\.co\/rest\/v1\/.*/,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api-cache",
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                networkTimeoutSeconds: 10
              }
            },
            {
              urlPattern: /^https:\/\/anciens\.prestaservicesantilles\.com\/.*/,
              handler: "CacheFirst",
              options: {
                cacheName: "legacy-assets-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ],
          skipWaiting: true,
          clientsClaim: true
        },
        manifest: {
          name: "Presta Services Antilles",
          short_name: "Presta",
          description: "Application de gestion pour Presta Services Antilles",
          theme_color: "#0d9488",
          background_color: "#fafaf9",
          display: "standalone",
          scope: "/",
          start_url: "/",
          orientation: "portrait",
          icons: [
            {
              src: "/icons/icon-72x72.png",
              sizes: "72x72",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-96x96.png",
              sizes: "96x96",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-128x128.png",
              sizes: "128x128",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-144x144.png",
              sizes: "144x144",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-152x152.png",
              sizes: "152x152",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-384x384.png",
              sizes: "384x384",
              type: "image/png",
              purpose: "maskable any"
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable any"
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: "module"
        }
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
      include: ["simple-peer", "localforage", "@tanstack/react-query"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic2NyaXB0cy92ZXJzaW9uLXBsdWdpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXE1BUkRPQ0hFRVxcXFxEb2N1bWVudHNcXFxcUHJlc3RhIC0gQ29weVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcTUFSRE9DSEVFXFxcXERvY3VtZW50c1xcXFxQcmVzdGEgLSBDb3B5XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9NQVJET0NIRUUvRG9jdW1lbnRzL1ByZXN0YSUyMC0lMjBDb3B5L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBub2RlUG9seWZpbGxzIH0gZnJvbSAndml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHMnXHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXHJcbmltcG9ydCB7IHZlcnNpb25JbmplY3RvclBsdWdpbiB9IGZyb20gJy4vc2NyaXB0cy92ZXJzaW9uLXBsdWdpbidcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBpc0NhcGFjaXRvciA9IG1vZGUgPT09ICdjYXBhY2l0b3InO1xyXG5cclxuICAvLyBHXHUwMEU5blx1MDBFOXJlciB1biBpZGVudGlmaWFudCB1bmlxdWUgZGUgYnVpbGQgYmFzXHUwMEU5IHN1ciBsYSBkYXRlL2hldXJlXHJcbiAgLy8gQ2Ugc2VyYSB1dGlsaXNcdTAwRTkgcG91ciBkXHUwMEU5dGVjdGVyIGxlcyBtaXNlcyBcdTAwRTAgam91ciBldCB2aWRlciBsZSBjYWNoZVxyXG4gIGNvbnN0IGJ1aWxkVGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcclxuICBjb25zdCBhcHBWZXJzaW9uID0gcHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbiB8fCAnMS4wLjAnO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgLy8gRW4gbW9kZSBBbmRyb2lkIChDYXBhY2l0b3IpLCBvbiBmb3JjZSBkZXMgY2hlbWlucyByZWxhdGlmcyBwb3VyIGNoYXJnZXIgY29ycmVjdGVtZW50IGRlcHVpcyBmaWxlOi8vXHJcbiAgICBiYXNlOiBpc0NhcGFjaXRvciA/ICcuLycgOiB1bmRlZmluZWQsXHJcblxyXG4gICAgLy8gSW5qZWN0ZXIgbGEgdmVyc2lvbiBldCBsZSBidWlsZCB0aW1lIGNvbW1lIHZhcmlhYmxlcyBkJ2Vudmlyb25uZW1lbnRcclxuICAgIGRlZmluZToge1xyXG4gICAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBQX1ZFUlNJT04nOiBKU09OLnN0cmluZ2lmeShhcHBWZXJzaW9uKSxcclxuICAgICAgJ2ltcG9ydC5tZXRhLmVudi5WSVRFX0JVSUxEX1RJTUUnOiBKU09OLnN0cmluZ2lmeShidWlsZFRpbWUpLFxyXG4gICAgfSxcclxuXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIHJlYWN0KCksXHJcbiAgICAgIHZlcnNpb25JbmplY3RvclBsdWdpbigpLCAvLyBJbmplY3QgdmVyc2lvbiBtZXRhIHRhZ3NcclxuICAgICAgbm9kZVBvbHlmaWxscyh7XHJcbiAgICAgICAgZXhjbHVkZTogW10sXHJcbiAgICAgICAgZ2xvYmFsczoge1xyXG4gICAgICAgICAgZ2xvYmFsOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcHJvdG9jb2xJbXBvcnRzOiB0cnVlLFxyXG4gICAgICB9KSxcclxuICAgICAgLy8gUFdBIFBsdWdpbiBhdmVjIFdvcmtib3ggaW50XHUwMEU5Z3JcdTAwRTlcclxuICAgICAgVml0ZVBXQSh7XHJcbiAgICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgICAgaW5qZWN0UmVnaXN0ZXI6ICdhdXRvJyxcclxuICAgICAgICBmaWxlbmFtZTogJ3NlcnZpY2Utd29ya2VyLmpzJyxcclxuICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwscG5nLGpwZyxqcGVnLHN2ZyxnaWYsd29mZix3b2ZmMix0dGYsanNvbn0nXSxcclxuICAgICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA3ICogMTAyNCAqIDEwMjQsIC8vIDcgTUJcclxuICAgICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICcvaW5kZXguaHRtbCcsXHJcbiAgICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL2FwaVxcLy8sIC9eXFwvcmVzdFxcL3YxXFwvLywgL15cXC9hdXRoXFwvdjFcXC8vLCAvXlxcL3NlcnZpY2Utd29ya2VyXFwuanMkL10sXHJcbiAgICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9teXpia2Jxa2p5a2RzYXltdWp2bFxcLnN1cGFiYXNlXFwuY29cXC9yZXN0XFwvdjFcXC8uKi8sXHJcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXHJcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnc3VwYWJhc2UtYXBpLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiAyNCAqIDYwICogNjAsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMTAsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvYW5jaWVuc1xcLnByZXN0YXNlcnZpY2VzYW50aWxsZXNcXC5jb21cXC8uKi8sXHJcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2xlZ2FjeS1hc3NldHMtY2FjaGUnLFxyXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMDAsXHJcbiAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDMwICogMjQgKiA2MCAqIDYwLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcclxuICAgICAgICAgIGNsaWVudHNDbGFpbTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgICBuYW1lOiAnUHJlc3RhIFNlcnZpY2VzIEFudGlsbGVzJyxcclxuICAgICAgICAgIHNob3J0X25hbWU6ICdQcmVzdGEnLFxyXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdBcHBsaWNhdGlvbiBkZSBnZXN0aW9uIHBvdXIgUHJlc3RhIFNlcnZpY2VzIEFudGlsbGVzJyxcclxuICAgICAgICAgIHRoZW1lX2NvbG9yOiAnIzBkOTQ4OCcsXHJcbiAgICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI2ZhZmFmOScsXHJcbiAgICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgICBzY29wZTogJy8nLFxyXG4gICAgICAgICAgc3RhcnRfdXJsOiAnLycsXHJcbiAgICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0JyxcclxuICAgICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi03Mng3Mi5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnNzJ4NzInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZSBhbnknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi05Nng5Ni5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnOTZ4OTYnLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZSBhbnknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi0xMjh4MTI4LnBuZycsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxMjh4MTI4JyxcclxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUgYW55J1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTQ0eDE0NC5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnMTQ0eDE0NCcsXHJcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogJ21hc2thYmxlIGFueSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogJy9pY29ucy9pY29uLTE1MngxNTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzE1MngxNTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZSBhbnknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi0xOTJ4MTkyLnBuZycsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUgYW55J1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMzg0eDM4NC5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnMzg0eDM4NCcsXHJcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogJ21hc2thYmxlIGFueSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogJy9pY29ucy9pY29uLTUxMng1MTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZSBhbnknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICB0eXBlOiAnbW9kdWxlJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9KSxcclxuICAgIF0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcG9ydDogMzAwMCxcclxuICAgICAgcHJveHk6IHtcclxuICAgICAgICAnL2FwaSc6IHtcclxuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIG9wdGltaXplRGVwczoge1xyXG4gICAgICBpbmNsdWRlOiBbJ3NpbXBsZS1wZWVyJywgJ2xvY2FsZm9yYWdlJywgJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddXHJcbiAgICB9XHJcbiAgfTtcclxufSlcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNQVJET0NIRUVcXFxcRG9jdW1lbnRzXFxcXFByZXN0YSAtIENvcHlcXFxcc2NyaXB0c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcTUFSRE9DSEVFXFxcXERvY3VtZW50c1xcXFxQcmVzdGEgLSBDb3B5XFxcXHNjcmlwdHNcXFxcdmVyc2lvbi1wbHVnaW4udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL01BUkRPQ0hFRS9Eb2N1bWVudHMvUHJlc3RhJTIwLSUyMENvcHkvc2NyaXB0cy92ZXJzaW9uLXBsdWdpbi50c1wiOy8qKlxuICogUGx1Z2luIFZpdGUgcG91ciBpbmplY3RlciBsZXMgbWV0YSB0YWdzIGRlIHZlcnNpb24gZGFucyBsJ0hUTUxcbiAqIFV0aWxpc2UgbGVzIGRvbm5cdTAwRTllcyBkZSBwdWJsaWMvdmVyc2lvbi5qc29uXG4gKi9cblxuaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBmdW5jdGlvbiB2ZXJzaW9uSW5qZWN0b3JQbHVnaW4oKTogUGx1Z2luIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiAndmVyc2lvbi1pbmplY3RvcicsXG4gICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbDoge1xuICAgICAgICAgICAgb3JkZXI6ICdwcmUnLFxuICAgICAgICAgICAgaGFuZGxlcjogKGh0bWw6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlYWQgdmVyc2lvbiBmcm9tIHB1YmxpYy92ZXJzaW9uLmpzb25cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvblBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgJ3B1YmxpYycsICd2ZXJzaW9uLmpzb24nKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbkRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh2ZXJzaW9uUGF0aCwgJ3V0ZjgnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIG1ldGEgdGFnc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXRhVGFncyA9IGBcbiAgICA8bWV0YSBuYW1lPVwiYXBwLXZlcnNpb25cIiBjb250ZW50PVwiJHt2ZXJzaW9uRGF0YS52ZXJzaW9ufVwiPlxuICAgIDxtZXRhIG5hbWU9XCJhcHAtYnVpbGQtbnVtYmVyXCIgY29udGVudD1cIiR7dmVyc2lvbkRhdGEuYnVpbGROdW1iZXJ9XCI+XG4gICAgPG1ldGEgbmFtZT1cImFwcC1idWlsZC1kYXRlXCIgY29udGVudD1cIiR7dmVyc2lvbkRhdGEuYnVpbGREYXRlfVwiPlxuYDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJbnNlcnQgYWZ0ZXIgPGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoJzxoZWFkPicsIGA8aGVhZD4ke21ldGFUYWdzfWApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW3ZlcnNpb24taW5qZWN0b3JdIENvdWxkIG5vdCBpbmplY3QgdmVyc2lvbiBtZXRhIHRhZ3M6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaHRtbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4VCxTQUFTLG9CQUFvQjtBQUMzVixPQUFPLFdBQVc7QUFDbEIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxlQUFlOzs7QUNHeEIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBRVYsU0FBUyx3QkFBZ0M7QUFDNUMsU0FBTztBQUFBLElBQ0gsTUFBTTtBQUFBLElBQ04sb0JBQW9CO0FBQUEsTUFDaEIsT0FBTztBQUFBLE1BQ1AsU0FBUyxDQUFDLFNBQWlCO0FBQ3ZCLFlBQUk7QUFFQSxnQkFBTSxjQUFjLEtBQUssUUFBUSxRQUFRLElBQUksR0FBRyxVQUFVLGNBQWM7QUFDeEUsZ0JBQU0sY0FBYyxLQUFL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
