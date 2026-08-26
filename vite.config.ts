// @lovable.dev/vite-tanstack-config already includes the core plugin stack.
// We only add the PWA plugin here for installability + a controlled service worker.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      strategies: "generateSW",
      manifest: false, // served from public/manifest.webmanifest
      // The client bundle is emitted to dist/client — the service worker and
      // its precache manifest must land there too, otherwise /sw.js 404s in
      // production and offline mode never activates.
      outDir: "dist/client",
      workbox: {
        globDirectory: "dist/client",
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/~/],
        globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff2,html,webmanifest}"],
        // Keep the precache lean: huge syntax-highlighting/diagram chunks are
        // fetched on demand instead of blocking the install step.
        globIgnores: ["**/shikijs__*", "**/mermaid*", "**/cytoscape*", "**/node_modules/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "beacon-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              // Offline + never-visited route: show the offline shell instead
              // of the browser's network error page.
              precacheFallback: { fallbackURL: "/offline.html" },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              /\.(?:png|svg|webp|jpg|jpeg|woff2)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "beacon-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "beacon-google-fonts-stylesheets" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "beacon-google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
