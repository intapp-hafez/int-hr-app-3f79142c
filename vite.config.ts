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
    TanStackRouterVite({ target: "react", autoCodeSplitting: false }),
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
