# Migrating TanStack Start Hybrid Apps to Pure Static SPA

This guide documents the architecture change to convert a TanStack Start hybrid application (which normally requires a Node.js server to execute `_serverFn` server functions) into a pure, static SPA. This is achieved by utilizing a shim that intercepts backend requests and executes them dynamically in the user's browser, relying on Supabase Row Level Security (RLS) for data protection.

## Steps to Migrate

### 1. Introduce the `start-shim.ts`
Create a file at `src/lib/start-shim.ts` that overrides the default TanStack `createServerFn`. This shim converts backend mutations into standard client-side promises that execute with the user's active session context.
*(Ensure `src/main.tsx` is also created to serve as the pure client entry point replacing the TanStack auto-entry).*

### 2. Update `vite.config.ts`
Remove the `@tanstack/react-start` plugin and replace it with the pure `@tanstack/router-plugin/vite`. Inject resolve aliases to enforce the shim.
```typescript
import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

const startShim = path.resolve(__dirname, "src/lib/start-shim.ts");

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: false }),
    // ...other plugins
  ],
  resolve: {
    alias: {
      "@tanstack/react-start/server": startShim,
      "@tanstack/react-start": startShim,
    },
  }
});
```

### 3. Update `package.json`
Remove any post-build scripts (like `merge-dist.mjs`) that flatten the `dist/client` and `dist/server` directories.
Change the build script to a simple `vite build`:
```json
"scripts": {
  "build": "vite build"
}
```

### 4. Revert `web.config` to Pure SPA Fallback
If deploying to IIS, remove any reverse proxy rules pointing to a Node server port. Use standard SPA fallback routing:
```xml
<rule name="SPA Fallback" stopProcessing="true">
  <match url=".*" />
  <conditions logicalGrouping="MatchAll">
    <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
    <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
  </conditions>
  <action type="Rewrite" url="/index.html" />
</rule>
```

### 5. Build and Deploy
Run `npm run build`. The output will be a flat `dist/` directory containing only static assets. You no longer need to run an Express server (`express-server.mjs`); simply host the `dist/` folder on any static web host or IIS site.
