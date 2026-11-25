import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";

export type CoordinateResult = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

let _lastKnownCoords: CoordinateResult | null = null;
export const LOCATION_PERMISSION_COOKIE = "sahay_location_permission";
export const LOCATION_COORDS_COOKIE = "sahay_last_coords";
const CACHE_KEY = "sahay_last_known_coords";
const PERMISSION_STORAGE_KEY = "sahay_location_permission";

// Default coordinates (Assam / North East regional emergency headquarters: Guwahati)
export const DEFAULT_FALLBACK_COORDINATES: CoordinateResult = {
  latitude: 26.1445,
  longitude: 91.7362,
  accuracy: 25,
};

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, maxAgeDays = 365) {
  if (typeof document === "undefined") return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function hasLocationPermissionGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cookieVal = getCookie(LOCATION_PERMISSION_COOKIE);
    if (cookieVal === "granted" || cookieVal === "allow" || cookieVal === "true") return true;
    const localVal = localStorage.getItem(PERMISSION_STORAGE_KEY);
    if (localVal === "granted" || localVal === "allow" || localVal === "true") return true;
  } catch {
    // Ignore storage errors
  }
  return false;
}

export function rememberLocationPermission(granted = true, coords?: CoordinateResult) {
  if (typeof window === "undefined") return;
  const status = granted ? "granted" : "denied";
  try {
    setCookie(LOCATION_PERMISSION_COOKIE, status, 365);
    localStorage.setItem(PERMISSION_STORAGE_KEY, status);
  } catch {
    // Ignore write errors
  }

  if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    rememberCoordinates(coords);
  }
}

export function ensureLocationPermissionCookie(defaultCoords: CoordinateResult = DEFAULT_FALLBACK_COORDINATES) {
  if (typeof window === "undefined") return;
  try {
    const current = getCookie(LOCATION_PERMISSION_COOKIE);
    if (!current) {
      setCookie(LOCATION_PERMISSION_COOKIE, "granted", 365);
      localStorage.setItem(PERMISSION_STORAGE_KEY, "granted");
    }
    const currentCoords = getCookie(LOCATION_COORDS_COOKIE);
    if (!currentCoords && defaultCoords) {
      rememberCoordinates(defaultCoords);
    }
  } catch {
    // Ignore write errors
  }
}

export function getLastKnownCoordinates(): CoordinateResult | null {
  if (_lastKnownCoords && Number.isFinite(_lastKnownCoords.latitude) && Number.isFinite(_lastKnownCoords.longitude)) {
    return _lastKnownCoords;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
          _lastKnownCoords = parsed;
          return parsed;
        }
      }
    } catch {}

    try {
      const rawLocal = localStorage.getItem(CACHE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed && Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
          _lastKnownCoords = parsed;
          return parsed;
        }
      }
    } catch {}

    try {
      const cookieCoords = getCookie(LOCATION_COORDS_COOKIE);
      if (cookieCoords) {
        const parts = cookieCoords.split(",");
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const res = { latitude: lat, longitude: lng, accuracy: 25 };
          _lastKnownCoords = res;
          return res;
        }
      }
    } catch {}

    if (hasLocationPermissionGranted()) {
      _lastKnownCoords = DEFAULT_FALLBACK_COORDINATES;
      return DEFAULT_FALLBACK_COORDINATES;
    }
  }
  return null;
}

export function rememberCoordinates(coords: CoordinateResult) {
  _lastKnownCoords = coords;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(coords));
      localStorage.setItem(CACHE_KEY, JSON.stringify(coords));
      setCookie(LOCATION_COORDS_COOKIE, `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`, 365);
      setCookie(LOCATION_PERMISSION_COOKIE, "granted", 365);
      localStorage.setItem(PERMISSION_STORAGE_KEY, "granted");
    } catch {
      // Ignore sessionStorage/cookie write errors
    }
  }
}

export async function getCurrentCoordinates(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  fallbackToCached?: boolean;
}): Promise<CoordinateResult> {
  const highAccuracy = options?.enableHighAccuracy ?? true;
  const timeout = options?.timeout ?? 6000;
  const maximumAge = options?.maximumAge ?? 60000;
  const allowFallback = options?.fallbackToCached ?? hasLocationPermissionGranted();

  const tryFallbackOrReject = (err: unknown, reject: (reason?: any) => void, resolve: (value: CoordinateResult) => void) => {
    if (allowFallback) {
      const cached = getLastKnownCoordinates();
      if (cached) {
        console.warn("[Location] Geolocation prompt/timeout, using remembered coordinates from cookie/storage:", err);
        resolve(cached);
        return;
      }
    }
    reject(err);
  };

  // 1. Try Capacitor native Geolocation on mobile platforms
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted" && status.coarseLocation !== "granted") {
        const req = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
        if (req.location !== "granted" && req.coarseLocation !== "granted") {
          throw new Error("Location permission denied by user.");
        }
      }

      // Stage 1a: Try fast high-accuracy fix
      try {
        const position: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: highAccuracy,
          timeout: Math.min(timeout, 5000),
          maximumAge,
        });

        const res = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        rememberCoordinates(res);
        return res;
      } catch (highAccErr) {
        // Stage 1b: Quick fallback to coarse/network location if high accuracy times out indoors
        const fallbackPos: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 3000,
          maximumAge: 120000,
        });

        const res = {
          latitude: fallbackPos.coords.latitude,
          longitude: fallbackPos.coords.longitude,
          accuracy: fallbackPos.coords.accuracy,
        };
        rememberCoordinates(res);
        return res;
      }
    } catch (nativeError) {
      console.warn("[Location] Native Geolocation error, checking browser fallback:", nativeError);
    }
  }

  // 2. Browser standard navigator.geolocation fallback
  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          rememberCoordinates(res);
          resolve(res);
        },
        (err) => {
          // If high-accuracy times out, try low-accuracy once
          if (highAccuracy && err.code === err.TIMEOUT) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const res = {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                };
                rememberCoordinates(res);
                resolve(res);
              },
              (secondErr) => tryFallbackOrReject(secondErr, reject, resolve),
              { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
            );
          } else {
            tryFallbackOrReject(err, reject, resolve);
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout,
          maximumAge,
        }
      );
    });
  }

  if (allowFallback) {
    const cached = getLastKnownCoordinates();
    if (cached) return cached;
  }

  throw new Error("Geolocation is not supported by this device.");
}

export function watchCoordinates(
  onSuccess: (coords: CoordinateResult) => void,
  onError?: (error: unknown) => void,
  options?: { enableHighAccuracy?: boolean }
): () => void {
  let watchId: string | number | null = null;
  let active = true;

  if (Capacitor.isNativePlatform()) {
    Geolocation.watchPosition(
      { enableHighAccuracy: options?.enableHighAccuracy ?? true },
      (pos, err) => {
        if (!active) return;
        if (err) {
          onError?.(err);
          return;
        }
        if (pos) {
          onSuccess({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      }
    ).then((id) => {
      if (!active) {
        Geolocation.clearWatch({ id });
      } else {
        watchId = id;
      }
    }).catch((err) => {
      onError?.(err);
    });

    return () => {
      active = false;
      if (typeof watchId === "string") {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }

  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!active) return;
        onSuccess({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        if (!active) return;
        onError?.(err);
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
      }
    );

    return () => {
      active = false;
      navigator.geolocation.clearWatch(id);
    };
  }

  return () => {
    active = false;
  };
}
