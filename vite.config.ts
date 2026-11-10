import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
const nativeBuild = process.env.VITE_NATIVE === "true";
export default defineConfig({
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        entryFileNames: "background/[name]-[hash].js",
        chunkFileNames: "background/[name]-[hash].js",
        assetFileNames: "background/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      disable: nativeBuild,
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Personal OS",
        short_name: "Personal OS",
        description: "Your everyday tools. Your own space.",
        theme_color: "#10121b",
        background_color: "#10121b",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globIgnores: ["background/**"],
        runtimeCaching: [
          {
            urlPattern: /\/background\/.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "personal-os-background-code-v1",
              expiration: { maxEntries: 30 },
            },
          },
        ],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/download(?:\/|$)/],
        maximumFileSizeToCacheInBytes: 5000000,
      },
    }),
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: { "/api": "http://127.0.0.1:8003" },
  },
  build: {
    outDir: nativeBuild ? "dist-native" : "dist",
    chunkSizeWarningLimit: 1100,
  },
});
