import { Capacitor } from "@capacitor/core";

export const DEFAULT_PRODUCTION_API_URL = "https://assam-rescue-platform.onrender.com";

/**
 * Returns the base API URL for backend communication.
 * In a native mobile APK (Capacitor), requests need to reach the hosted backend API
 * rather than https://localhost. In web browser deployments, relative URLs are used by default.
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

  // 2. In browser development mode on localhost, always use local relative URLs
  if (typeof window !== "undefined" && !Capacitor.isNativePlatform() && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return "";
  }

  // 3. Check build-time environment variable (for remote production or native builds)
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 4. Native fallback: default production API if running in native app
  if (Capacitor.isNativePlatform()) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  // 5. Default web behavior: relative URLs
  return "";
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

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
