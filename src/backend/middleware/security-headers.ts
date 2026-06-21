import { createMiddleware } from "@tanstack/react-start";

/**
 * Applies a baseline of OWASP-recommended security response headers to every
 * SSR / server route / server function response. Values cover the most common
 * web threats (XSS, clickjacking, MIME sniffing, referrer leakage, insecure
 * transport, unwanted browser feature access).
 *
 * Per-tenant overrides (toggle CSP / HSTS / X-Frame-Options / Referrer-Policy /
 * Permissions-Policy) live in `public.security_settings` and are surfaced in
 * /admin/settings → Security. This middleware applies safe defaults
 * unconditionally so the headers are present even before settings load.
 */
export const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next();
    const response: Response | undefined = (result as { response?: Response })
      .response;
    if (!response || !(response instanceof Response)) {
      return result;
    }

    try {
      const h = response.headers;
      const set = (k: string, v: string) => {
        if (!h.has(k)) h.set(k, v);
      };

      // Clickjacking
      set("X-Frame-Options", "DENY");
      // MIME sniffing
      set("X-Content-Type-Options", "nosniff");
      // Referrer
      set("Referrer-Policy", "strict-origin-when-cross-origin");
      // HSTS (only meaningful over HTTPS, browsers ignore on http)
      set(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
      // Browser feature gating.
      //
      // Per the Permissions-Policy spec, `feature=*` (bare, no parens) means
      // "allow self AND any cross-origin embed". `feature=()` blocks
      // everywhere. `feature=(self)` allows only this origin. The syntax
      // `(self "*")` is INVALID — `"*"` is parsed as a literal (broken)
      // origin string and silently ignored, leaving the feature self-only.
      //
      // - camera / microphone: FaceCapture + future audio. Use `*` so a
      //   parent iframe (custom domain wrapper) can pass
      //   the permission through via its `allow=` attribute. Without a
      //   matching `allow=` token on the parent <iframe>, the browser
      //   still blocks it — this header just keeps OUR side permissive.
      // - publickey-credentials-create / -get: WebAuthn. Same reasoning.
      // - geolocation: self only (attendance check-in).
      // - payment: disabled.
      set(
        "Permissions-Policy",
        [
          "camera=*",
          "microphone=*",
          "geolocation=(self)",
          "payment=()",
          "publickey-credentials-create=*",
          "publickey-credentials-get=*",
        ].join(", "),
      );
      // Cross-origin isolation defaults
      set("Cross-Origin-Opener-Policy", "same-origin");
      set("Cross-Origin-Resource-Policy", "same-site");
      // XSS protection (legacy header, still respected by some UAs)
      set("X-XSS-Protection", "1; mode=block");
      // Baseline CSP — relaxed enough for Vite/HMR and Supabase, hard blocks
      // arbitrary plugin/object embeds and frame ancestors (clickjacking).
      //
      // Notes on WebAuthn: `navigator.credentials.create/get` is a browser
      // API and is NOT gated by CSP `connect-src` — only the Permissions-
      // Policy header (above) controls whether the feature is available.
      // The verify round-trip uses our own server functions, so `self`
      // covers it. Explicit origins below are for the resources the app
      // actually loads: Google Fonts (CSS + font files) and Supabase
      // (REST, Auth, Storage, Realtime over WSS).
      set(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          // 'unsafe-eval' is required by Vite HMR in dev and by some
          // WASM/face-api glue. Keep it scoped to scripts only.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
          "worker-src 'self' blob:",
          // Supabase: REST/Auth/Storage over HTTPS, Realtime over WSS.
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
          "media-src 'self' blob:",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      );
    } catch {
      /* headers may be immutable for some responses (e.g. redirects) */
    }

    return result;
  },
);