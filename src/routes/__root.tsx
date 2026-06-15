import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installErrorCollector } from "../lib/error-log";

if (typeof window !== "undefined") {
  installErrorCollector();
}

const LOGO_URL = "/__l5e/assets-v1/96422966-c9e8-4a26-87d0-b7f3f3b977fc/thermominder.png";

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
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "reminder" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "reminder" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { property: "og:image", content: LOGO_URL },
      { name: "twitter:image", content: LOGO_URL },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "reminder" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/aNznm3PtS7TWR5hC2EGAP3uxad23/social-images/social-1781532880331-thermominder.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/aNznm3PtS7TWR5hC2EGAP3uxad23/social-images/social-1781532880331-thermominder.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: LOGO_URL },
      { rel: "apple-touch-icon", href: LOGO_URL },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #tt-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;background:radial-gradient(circle at 50% 30%,#0f172a 0%,#020617 70%);color:#5eead4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;transition:opacity .45s ease;}
              #tt-splash.tt-hide{opacity:0;pointer-events:none;}
              #tt-splash img{width:140px;height:140px;object-fit:contain;border-radius:24px;box-shadow:0 20px 60px -20px rgba(45,212,191,.5);animation:tt-pulse 1.8s ease-in-out infinite;}
              #tt-splash .tt-title{font-size:1.1rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;}
              #tt-splash .tt-bar{width:140px;height:3px;border-radius:999px;background:rgba(45,212,191,.15);overflow:hidden;position:relative;}
              #tt-splash .tt-bar::after{content:"";position:absolute;inset:0;width:40%;background:linear-gradient(90deg,transparent,#2dd4bf,transparent);animation:tt-slide 1.2s linear infinite;}
              @keyframes tt-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.85}}
              @keyframes tt-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
            `,
          }}
        />
      </head>
      <body>
        <div id="tt-splash" aria-hidden="true">
          <img src={LOGO_URL} alt="" />
          <div className="tt-title">ThermoMinder</div>
          <div className="tt-bar" />
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const el = document.getElementById("tt-splash");
    if (!el) return;
    const t = setTimeout(() => {
      el.classList.add("tt-hide");
      setTimeout(() => el.remove(), 500);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
