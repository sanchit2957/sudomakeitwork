import { Capacitor } from "@capacitor/core";

export const DEFAULT_PRODUCTION_API_URL = "https://assam-rescue-platform.onrender.com";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return true;
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    if (window.location.protocol === "capacitor:" || window.location.protocol === "ionic:") return true;
    // Android WebView User Agent check fallback
    if (navigator.userAgent.includes("wv") || navigator.userAgent.includes("Capacitor")) return true;
  } catch {}
  return false;
}

/**
 * Returns the base API URL for backend communication.
 * In a native mobile APK (Capacitor), requests MUST reach the hosted backend API
 * (https://assam-rescue-platform.onrender.com) rather than https://localhost.
 */
export function getApiBaseUrl(): string {
  // 1. Check runtime window override or stored preference if configured
  if (typeof window !== "undefined") {
    const windowOverride = (window as any).__APP_API_URL__;
    if (typeof windowOverride === "string" && windowOverride.trim().length > 0) {
      return windowOverride.trim().replace(/\/+$/, "");
    }
    try {
      const storedUrl = localStorage.getItem("app_api_base_url");
      if (storedUrl && storedUrl.trim().length > 0) {
        return storedUrl.trim().replace(/\/+$/, "");
      }
    } catch {
      // localStorage unavailable
    }
  }

  // 2. Check build-time environment variable
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 3. If running inside native mobile app (Capacitor Android/iOS), use production API
  if (isNativeApp()) {
    if (import.meta.env.DEV) {
      return "http://10.0.2.2:3000";
    }
    return DEFAULT_PRODUCTION_API_URL;
  }

  // 4. In browser development mode on localhost (vite dev server), use relative URLs for dev proxy
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "";
  }

  // 5. In production web deployment on standard hosting, relative URLs are standard
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return "";
  }

  // 6. Default fallback for build-time or mobile environment
  return DEFAULT_PRODUCTION_API_URL;
}

/**
 * Resolves an API or static asset path into a full URL when running in mobile native mode,
 * or keeps it relative when running in standard web hosting.
 */
export function getApiUrl(path: string): string {
  if (!path) return path;

  // Already absolute or data/blob URI
  if (/^(?:https?:|\/\/|data:|blob:)/i.test(path)) {
    return path;
  }

  const base = getApiBaseUrl();
  if (!base) {
    return path;
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
