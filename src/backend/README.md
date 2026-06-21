# Backend (Phase 1)

All server-side logic for the HR app.

- `schemas/` — Zod input/output schemas, safe to import from anywhere.
- `functions/` — `createServerFn` wrappers. Client code imports from here.
  Files ending in `.functions.ts` are split by Vite so handler bodies stay
  on the server.
- `server/` — server-only modules (suffix `.server.ts`). Never import these
  from components; reference them only from `.functions.ts` handlers (with
  `await import(...)` for anything pulling `client.server`) or from server
  routes under `src/routes/api/`.

Phase 1 ships SMTP, notification preferences, export schedules with
server-side dedupe locking, and the cron route the database calls every
minute. Later phases migrate employees/tasks/trips/etc. into the same
structure.