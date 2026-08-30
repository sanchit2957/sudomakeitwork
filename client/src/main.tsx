import { getApiUrl } from "@/lib/apiConfig";
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { startLogin } from "./const";
import "leaflet/dist/leaflet.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN") return false;
        return failureCount < 1;
      },
      staleTime: 2000,
    },
    mutations: {
      retry: false,
    },
  },
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.DEV || Capacitor.isNativePlatform()) {
      void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(registration => registration.unregister())));
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // The SOS flow remains usable online if an older browser cannot install the offline shell.
    });
  });
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  // On Native Mobile APK (Capacitor), do NOT use window.location.href hard-redirects
  if (Capacitor.isNativePlatform()) return;

  const pathname = window.location.pathname;
  if (
    pathname === "/" ||
    pathname.includes("index.html") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/user/login") ||
    pathname.startsWith("/responder/login") ||
    pathname.startsWith("/hospital/login") ||
    pathname.startsWith("/medical/login")
  ) {
    return;
  }

  const isUnauthorized =
    error.message === UNAUTHED_ERR_MSG ||
    error.data?.code === "UNAUTHORIZED";

  if (!isUnauthorized) return;

  try {
    localStorage.removeItem("app-runtime-session-token");
    localStorage.removeItem("app-runtime-user-info");
    localStorage.removeItem("app_native_bearer_token");
  } catch {}

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: getApiUrl("/api/trpc"),
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {};
        try {
          const nativeToken =
            localStorage.getItem("app_native_bearer_token") ||
            localStorage.getItem("app-runtime-session-token");
          if (nativeToken) {
            headers["Authorization"] = `Bearer ${nativeToken}`;
          }
        } catch {}
        return headers;
      },
      fetch(input, init) {
        let target = input;
        if (typeof target === "string" && target.startsWith("/")) {
          target = getApiUrl(target);
        }
        if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
          const urlStr = typeof target === "string" ? target : (target as Request).url;
          console.log("[Mobile Request]", init?.method || "GET", urlStr);
        }
        return globalThis.fetch(target, {
          ...(init ?? {}),
          credentials: "include",
          cache: "no-store",
          headers: {
            ...(init?.headers ?? {}),
            "Cache-Control": "no-cache, no-store, max-age=0",
            Pragma: "no-cache",
          },
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
