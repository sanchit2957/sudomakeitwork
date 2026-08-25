import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";

export type CoordinateResult = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export async function getCurrentCoordinates(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<CoordinateResult> {
  const highAccuracy = options?.enableHighAccuracy ?? true;
  const timeout = options?.timeout ?? 10000;
  const maximumAge = options?.maximumAge ?? 30000;

  // 1. Try Capacitor native Geolocation on mobile platforms
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        const req = await Geolocation.requestPermissions({ permissions: ["location"] });
        if (req.location !== "granted") {
          throw new Error("Location permission denied by user.");
        }
      }

      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (nativeError) {
      console.warn("[Location] Native Geolocation error, falling back to navigator.geolocation:", nativeError);
    }
  }

  // 2. Browser standard navigator.geolocation fallback
  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          reject(err);
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
