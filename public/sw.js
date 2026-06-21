/**
 * PWA Service Worker
 * - Handles install / activate lifecycle
 * - Caches the app shell and static assets (Cache First strategy)
 * - Falls back to network for API calls (Network First)
 * - Forwards push notifications (merged from sw-push.js)
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `int-hr-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `int-hr-assets-${CACHE_VERSION}`;

// App-shell URLs to pre-cache on install
const SHELL_URLS = [
  "/",
  "/app.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
];

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {
        // Non-fatal: some URLs may not exist yet
      })
    )
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete old caches from previous versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => k !== SHELL_CACHE && k !== ASSET_CACHE
            )
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API / SSR routes — always go to network
  if (
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/rpc/") ||
    request.method !== "GET"
  ) {
    return; // let the browser handle it normally
  }

  // Static assets (hashed filenames in /assets/) — Cache First
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Navigation requests — Network First, fall back to cached "/"
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/");
        return cached || new Response("Offline", { status: 503 });
      })
    );
    return;
  }

  // Shell assets — Cache First, refresh in background
  event.respondWith(
    caches.match(request).then(async (cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          caches.open(SHELL_CACHE).then((cache) =>
            cache.put(request, response.clone())
          );
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});

// ─── Push Notifications ────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Notification", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "HR Alert";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag,
    data: { url: data.url || "/" },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if (c.url.includes(url) && "focus" in c) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
