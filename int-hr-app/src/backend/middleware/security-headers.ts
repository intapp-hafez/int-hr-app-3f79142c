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
      // Browser feature gating
      set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(self), payment=()",
      );
      // Cross-origin isolation defaults
      set("Cross-Origin-Opener-Policy", "same-origin");
      set("Cross-Origin-Resource-Policy", "same-site");
      // XSS protection (legacy header, still respected by some UAs)
      set("X-XSS-Protection", "1; mode=block");
      // Baseline CSP — relaxed enough for Vite/HMR and Supabase, hard blocks
      // arbitrary plugin/object embeds and frame ancestors (clickjacking).
      set(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https:",
          "style-src 'self' 'unsafe-inline' https:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
          "connect-src 'self' https: wss:",
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