import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : "/fanfou_backup/",
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "饭否备份",
        short_name: "饭否备份",
        description: "饭否历史内容浏览与备份",
        lang: "zh-CN",
        start_url: "/fanfou_backup/",
        scope: "/fanfou_backup/",
        display: "standalone",
        background_color: "#111827",
        theme_color: "#111827",
        icons: [
          {
            src: "icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
