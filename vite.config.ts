import path from "path";
import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const startShim = path.resolve(__dirname, "src/lib/start-shim.ts");

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // autoCodeSplitting splits each route's component/loader into a lazy chunk
    // so visiting /admin no longer eagerly loads every admin sub-route's
    // heavy deps (xlsx, jspdf, leaflet, recharts, etc.) — which used to
    // freeze the dev page after sign-in.
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    viteReact(),
  ],
  resolve: {
    alias: {
      // Replace the TanStack Start server runtime with a browser-safe shim.
      "@tanstack/react-start/server": startShim,
      "@tanstack/react-start": startShim,
    },
  },
  build: {
    rollupOptions: {
      external: ["cloudflare:sockets"],
    },
  },
  optimizeDeps: {
    exclude: ["cloudflare:sockets"],
    esbuildOptions: {
      plugins: [
        {
          name: "ignore-cloudflare-sockets",
          setup(build) {
            build.onResolve({ filter: /^cloudflare:sockets$/ }, (args) => ({
              path: args.path,
              external: true,
            }));
          },
        },
      ],
    },
  },
});
