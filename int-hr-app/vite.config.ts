import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

const startShim = path.resolve(__dirname, "src/lib/start-shim.ts");

// Standard Vite SPA config — no SSR, no Cloudflare Workers, no external wrappers.
// Outputs a single JS bundle + single CSS file into dist/.
export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: false }),
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "INT-HR App — Employee Attendance Management",
        short_name: "INT-HR App",
        description: "Secure mobile attendance with GPS geo-fencing and authorized network validation.",
        theme_color: "#EA7A2C",
        background_color: "#0F1117",
        display: "standalone",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ],
  resolve: {
    alias: {
      // Replace the TanStack Start server runtime with a browser-safe shim.
      "@tanstack/react-start/server": startShim,
      "@tanstack/react-start": startShim,
    },
  },
  optimizeDeps: {
    exclude: ["cloudflare:sockets"],
  },
  build: {
    rollupOptions: {
      external: ["cloudflare:sockets"],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
