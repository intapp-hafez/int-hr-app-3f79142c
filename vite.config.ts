import path from "path";
import { defineConfig, Plugin } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const startShim = path.resolve(__dirname, "src/lib/start-shim.ts");

// A Vite plugin that intercepts Node.js built-ins and server-only modules 
// and replaces them with an empty mock. This prevents Vite's import analysis 
// from throwing errors or leaking these imports to the browser in pure SPA mode.
function stubServerModules(): Plugin {
  const stubs = ["cloudflare:sockets", "crypto", "https", "url", "util", "node:tls", "node:events", "node:buffer", "node:stream"];
  return {
    name: "stub-server-modules",
    enforce: "pre",
    resolveId(id) {
      if (stubs.includes(id)) {
        return `\0stubbed:${id}`;
      }
    },
    load(id) {
      if (id.startsWith("\0stubbed:")) {
        return `export default {};\nexport const connect = () => { throw new Error("Mocked server module"); };`;
      }
    },
  };
}

export default defineConfig({
  plugins: [
    stubServerModules(),
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
});
