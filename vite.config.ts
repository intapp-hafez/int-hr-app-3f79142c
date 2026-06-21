import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
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
