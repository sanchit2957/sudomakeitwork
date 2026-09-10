/**
 * Tests for server/routing/routing.service.ts
 * Covers: OSRM success, response parsing, timeout, malformed response,
 * cache hit, cache expiry, Haversine fallback, approximate ETA labeling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateRoadRouteAndEta,
  calculateFallbackRoute,
  calculateHaversineMeters,
  formatEtaString,
  formatDistanceString,
  clearRouteCache,
} from "./routing.service";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("calculateHaversineMeters", () => {
  it("returns 0 for identical points", () => {
    const point = { latitude: 26.1445, longitude: 91.7362 };
    expect(calculateHaversineMeters(point, point)).toBeLessThan(1);
  });

  it("computes reasonable distance for real-world coordinates (Guwahati)", () => {
    const from = { latitude: 26.1445, longitude: 91.7362 };
    const to = { latitude: 26.2006, longitude: 91.7362 };
    const distMeters = calculateHaversineMeters(from, to);
    expect(distMeters).toBeGreaterThan(5000); // ~6.2 km
    expect(distMeters).toBeLessThan(8000);
  });
});

describe("calculateFallbackRoute", () => {
  it("applies 1.35x road circuity factor", () => {
    const p1 = { latitude: 26.1445, longitude: 91.7362 };
    const p2 = { latitude: 26.2006, longitude: 91.7362 };
    const haversine = calculateHaversineMeters(p1, p2);
    const fallback = calculateFallbackRoute(p1, p2);
    expect(fallback.distanceMeters).toBeGreaterThan(haversine); // with circuity
    expect(fallback.distanceMeters).toBeCloseTo(haversine * 1.35, -2);
  });

  it("marks ETA as approximate", () => {
    const result = calculateFallbackRoute(
      { latitude: 26.1445, longitude: 91.7362 },
      { latitude: 26.2006, longitude: 91.7362 }
    );
    expect(result.isApproximate).toBe(true);
    expect(result.source).toBe("fallback");
    expect(result.etaText).toContain("~");
  });

  it("returns 2-point straight line coordinate array", () => {
    const p1 = { latitude: 26.1445, longitude: 91.7362 };
    const p2 = { latitude: 26.2006, longitude: 91.8000 };
    const result = calculateFallbackRoute(p1, p2);
    expect(result.coordinates).toHaveLength(2);
    expect(result.coordinates[0]).toEqual([p1.latitude, p1.longitude]);
    expect(result.coordinates[1]).toEqual([p2.latitude, p2.longitude]);
  });

  it("has a minimum 30-second duration", () => {
    // Very close points
    const p1 = { latitude: 26.1445, longitude: 91.7362 };
    const p2 = { latitude: 26.1445001, longitude: 91.7362001 };
    const result = calculateFallbackRoute(p1, p2);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(30);
  });
});

describe("formatEtaString", () => {
  it("returns < 1 min for very short durations", () => {
    expect(formatEtaString(0)).toBe("< 1 min");
    expect(formatEtaString(0.5)).toBe("< 1 min");
  });

  it("formats minutes correctly", () => {
    expect(formatEtaString(5)).toBe("5 min");
    expect(formatEtaString(30)).toBe("30 min");
  });

  it("adds ~ prefix for approximate ETAs", () => {
    expect(formatEtaString(5, true)).toBe("~5 min");
  });

  it("formats hours correctly", () => {
    expect(formatEtaString(65)).toBe("1 hr 5 min");
    expect(formatEtaString(120)).toBe("2 hr");
  });
});

describe("formatDistanceString", () => {
  it("formats meters for < 1 km", () => {
    expect(formatDistanceString(0.5)).toBe("500 m");
    expect(formatDistanceString(0.3)).toBe("300 m");
  });

  it("formats km for >= 1 km", () => {
    expect(formatDistanceString(5.0)).toBe("5.0 km");
    expect(formatDistanceString(12.5)).toBe("12.5 km");
  });
});

describe("calculateRoadRouteAndEta", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearRouteCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns OSRM route on success (Test 13: OSRM success)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 600,
            geometry: {
              coordinates: [
                [91.7362, 26.1445],
                [91.7500, 26.1600],
                [91.7700, 26.1800],
              ],
            },
          },
        ],
      }),
    });

    const result = await calculateRoadRouteAndEta(
      { latitude: 26.1445, longitude: 91.7362 },
      { latitude: 26.1800, longitude: 91.7700 }
    );

    expect(result.source).toBe("osrm");
    expect(result.distanceMeters).toBe(5000);
    expect(result.durationSeconds).toBe(600);
    expect(result.isApproximate).toBe(false);
    // GeoJSON [lng, lat] should be flipped to Leaflet [lat, lng]
    expect(result.coordinates[0]).toEqual([26.1445, 91.7362]);
  });

  it("parses OSRM response into Leaflet [lat, lng] coordinate format (Test 14)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 2000,
            duration: 300,
            geometry: {
              coordinates: [[91.74, 26.15], [91.75, 26.16]],
            },
          },
        ],
      }),
    });

    const result = await calculateRoadRouteAndEta(
      { latitude: 26.15, longitude: 91.74 },
      { latitude: 26.16, longitude: 91.75 }
    );
    // Verify coordinate flip from [lng, lat] to [lat, lng]
    expect(result.coordinates[0][0]).toBeCloseTo(26.15, 2);
    expect(result.coordinates[0][1]).toBeCloseTo(91.74, 2);
  });

  it("falls back to Haversine on OSRM timeout (Test 15)", async () => {
    // Simulate AbortController timeout
    mockFetch.mockImplementation(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const result = await calculateRoadRouteAndEta(
      { latitude: 26.1445, longitude: 91.7362 },
      { latitude: 26.2006, longitude: 91.7362 }
    );

    expect(result.isApproximate).toBe(true);
    expect(result.source).toBe("fallback");
    expect(result.etaText).toContain("~");
  });

  it("falls back to Haversine on OSRM malformed response (Test 16)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "NoRoute", routes: [] }),
    });

    const result = await calculateRoadRouteAndEta(
      { latitude: 26.1445, longitude: 91.7362 },
      { latitude: 26.2, longitude: 91.8 }
    );

    expect(result.isApproximate).toBe(true);
    expect(result.source).toBe("fallback");
  });

  it("returns cached result on route cache hit (Test 17)", async () => {
    // First call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{ distance: 3000, duration: 420, geometry: { coordinates: [[91.74, 26.15]] } }],
      }),
    });

    const p1 = { latitude: 26.15, longitude: 91.74 };
    const p2 = { latitude: 26.16, longitude: 91.75 };

    await calculateRoadRouteAndEta(p1, p2);
    // Second call should hit cache
    const cached = await calculateRoadRouteAndEta(p1, p2);
    expect(cached.source).toBe("cache");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes cache after TTL expiry (Test 18)", async () => {
    // First successful call
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{ distance: 4000, duration: 480, geometry: { coordinates: [[91.74, 26.15]] } }],
      }),
    });

    const p1 = { latitude: 26.20, longitude: 91.80 };
    const p2 = { latitude: 26.21, longitude: 91.81 };

    await calculateRoadRouteAndEta(p1, p2);
    // Advance time past cache TTL (15 seconds)
    vi.advanceTimersByTime(16_000);
    const refreshed = await calculateRoadRouteAndEta(p1, p2);
    // Should have fetched a second time
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(refreshed.source).toBe("osrm");
  });

  it("uses Haversine fallback with road circuity (Test 19)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const p1 = { latitude: 26.1445, longitude: 91.7362 };
    const p2 = { latitude: 26.2006, longitude: 91.7362 };
    const haversineMeters = calculateHaversineMeters(p1, p2);
    const result = await calculateRoadRouteAndEta(p1, p2);

    expect(result.isApproximate).toBe(true);
    // Road distance should be approximately 1.35x haversine
    expect(result.distanceMeters).toBeGreaterThan(haversineMeters);
    expect(result.distanceMeters).toBeLessThan(haversineMeters * 1.5);
  });

  it("fallback ETA is labeled approximate with ~ prefix (Test 20)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Offline"));

    const result = await calculateRoadRouteAndEta(
      { latitude: 26.1445, longitude: 91.7362 },
      { latitude: 26.2006, longitude: 91.8000 }
    );
    expect(result.etaText.startsWith("~")).toBe(true);
  });
});
