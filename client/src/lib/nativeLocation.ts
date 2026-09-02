import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";

export type CoordinateResult = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

let _lastKnownCoords: CoordinateResult | null = null;
const CACHE_KEY = "sahay_last_known_coords";

export function getLastKnownCoordinates(): CoordinateResult | null {
  if (_lastKnownCoords) return _lastKnownCoords;
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
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }
  return null;
}

function rememberCoordinates(coords: CoordinateResult) {
  _lastKnownCoords = coords;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(coords));
    } catch {
      // Ignore sessionStorage write errors
    }
  }
}

export async function getCurrentCoordinates(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<CoordinateResult> {
  const highAccuracy = options?.enableHighAccuracy ?? true;
  const timeout = options?.timeout ?? 6000;
  const maximumAge = options?.maximumAge ?? 60000;

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
              (secondErr) => reject(secondErr),
              { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
            );
          } else {
            reject(err);
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
