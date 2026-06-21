import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { LanguageProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "INT-HR App — Employee Attendance Management" },
      { name: "description", content: "Secure mobile attendance with GPS geo-fencing, authorized network validation, leave management, and real-time reporting." },
      { name: "author", content: "INT-HR App" },
      { property: "og:title", content: "INT-HR App — Employee Attendance Management" },
      { property: "og:description", content: "Secure mobile attendance with GPS geo-fencing and authorized network validation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Chrome / Android
      { name: "theme-color", content: "#EA7A2C" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "INT-HR" },
      // Safari / iOS
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "INT-HR" },
      // Windows / Edge
      { name: "msapplication-TileColor", content: "#EA7A2C" },
      { name: "msapplication-TileImage", content: "/android-chrome-192x192.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/app.webmanifest" },
      // Favicons
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/android-chrome-192x192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/android-chrome-512x512.png" },
      // Apple touch icons for iOS Safari
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/android-chrome-192x192.png" },
      { rel: "apple-touch-icon", sizes: "512x512", href: "/android-chrome-512x512.png" },
      // Fonts
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthSessionWatcher />
        <Outlet />
        <Toaster position="top-center" richColors />
        <PwaInstallBanner />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

/**
 * Single global listener: when the Supabase session ends (sign-out or token
 * refresh failure / expiry), purge protected caches and route the user back
 * to /auth. On sign-in/user update, invalidate so loaders refetch.
 */
function AuthSessionWatcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only react to an explicit user sign-out. Do NOT auto-redirect on
      // TOKEN_REFRESHED with no session (token expiry / refresh failure) —
      // users should not be kicked out of any panel automatically.
      if (event === "SIGNED_OUT") {
        await queryClient.cancelQueries();
        queryClient.clear();
        router.invalidate();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          const from = window.location.pathname + window.location.search + window.location.hash;
          const target = `/auth?redirect=${encodeURIComponent(from)}`;
          window.location.replace(target);
        }
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        router.invalidate();
        queryClient.invalidateQueries();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}
