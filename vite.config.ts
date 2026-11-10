import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  define: {
    "import.meta.env.VITE_PREVIEW_BOOT_HASH": JSON.stringify(
      createHash("sha256")
        .update(
          readFileSync(new URL("./src/preview-bootstrap.js", import.meta.url)),
        )
        .digest("base64"),
    ),
  },
  plugins: [
    {
      name: "isolated-preview-bootstrap",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "preview-bootstrap.js",
          source: readFileSync(
            new URL("./src/preview-bootstrap.js", import.meta.url),
          ),
        });
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const boot = readFileSync(
            new URL("./src/preview-bootstrap.js", import.meta.url),
          );
          const hash = createHash("sha256").update(boot).digest("base64");
          if (req.url?.startsWith("/playground-preview.html"))
            res.setHeader(
              "Content-Security-Policy",
              "sandbox allow-scripts;frame-ancestors 'self';default-src 'none';script-src 'unsafe-inline' 'unsafe-eval' blob: https:;style-src 'unsafe-inline' https:;img-src data: blob: https:;connect-src https:",
            );
          else
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'self';script-src 'self' 'unsafe-eval' blob: 'sha256-" +
                hash +
                "';style-src 'self' 'unsafe-inline';img-src 'self' data: blob:;connect-src 'self' ws: wss: https://staticimgly.com;worker-src 'self' blob:",
            );
          next();
        });
      },
    },
    react(),
    VitePWA({
      disable: nativeBuild,
      registerType: "prompt",
      includeAssets: [
        "playground-preview.html",
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
      ],
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
        navigateFallbackDenylist: [
          /^\/playground-preview[.]html$/,
          /^\/api\//,
          /^\/download(?:\/|$)/,
        ],
        maximumFileSizeToCacheInBytes: 5000000,
      },
    }),
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: { "/api": { target: "http://127.0.0.1:8003", ws: true } },
  },
  build: {
    outDir: nativeBuild ? "dist-native" : "dist",
    chunkSizeWarningLimit: 1100,
  },
});
