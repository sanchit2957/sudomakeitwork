// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getCurrentCoordinates,
  getLastKnownCoordinates,
  ensureLocationPermissionCookie,
  hasLocationPermissionGranted,
  rememberCoordinates,
  LOCATION_PERMISSION_COOKIE,
  LOCATION_COORDS_COOKIE,
} from "./nativeLocation";

describe("nativeLocation adapter", () => {
  const originalGeolocation = typeof navigator !== "undefined" ? navigator.geolocation : undefined;

  beforeEach(() => {
    if (typeof document !== "undefined") {
      document.cookie = `${LOCATION_PERMISSION_COOKIE}=; path=/; max-age=0`;
      document.cookie = `${LOCATION_COORDS_COOKIE}=; path=/; max-age=0`;
    }
    if (typeof sessionStorage !== "undefined") sessionStorage.clear();
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  afterEach(() => {
    if (typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "geolocation", {
        value: originalGeolocation,
        configurable: true,
      });
    }
  });

  it("resolves coordinates successfully via geolocation fallback", async () => {
    const mockCoords = {
      latitude: 26.1445,
      longitude: 91.7362,
      accuracy: 10,
    };

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              ...mockCoords,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });

    const coords = await getCurrentCoordinates();
    expect(coords.latitude).toBe(26.1445);
    expect(coords.longitude).toBe(91.7362);
  });

  it("handles geolocation failure gracefully", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
      },
    });

    await expect(getCurrentCoordinates()).rejects.toThrow();
  });

  it("remembers and returns last known coordinates", async () => {
    const mockCoords = {
      latitude: 19.1998,
      longitude: 73.1091,
      accuracy: 15,
    };

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              ...mockCoords,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });

    const acquired = await getCurrentCoordinates();
    expect(acquired.latitude).toBe(19.1998);
    expect(acquired.longitude).toBe(73.1091);
  });

  it("stores and reads location permission and coordinates in browser cookies", () => {
    ensureLocationPermissionCookie({ latitude: 26.1445, longitude: 91.7362 });
    expect(hasLocationPermissionGranted()).toBe(true);
    expect(document.cookie).toContain("sahay_location_permission=granted");

    const cached = getLastKnownCoordinates();
    expect(cached).not.toBeNull();
    expect(cached?.latitude).toBe(26.1445);
    expect(cached?.longitude).toBe(91.7362);
  });

  it("falls back to cookie coordinates when geolocation fails and permission is granted", async () => {
    rememberCoordinates({ latitude: 28.6139, longitude: 77.2090, accuracy: 20 });

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
      },
    });

    const coords = await getCurrentCoordinates();
    expect(coords.latitude).toBe(28.6139);
    expect(coords.longitude).toBe(77.2090);
  });
});
