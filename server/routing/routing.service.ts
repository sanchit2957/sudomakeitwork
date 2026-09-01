/**
 * SERVER ROAD ROUTING & ETA ENGINE
 * Computes road-network driving distances, durations, and polyline coordinates.
 * Features:
 * - OSRM (Open Source Routing Machine) integration
 * - In-memory bounded cache with coordinate grid snapping to avoid API spam
 * - Resilient fallback to Haversine + road-circuity (1.35x) model when external router is offline
 * - Rate limiting & timeout guards
 */

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  etaText: string;
  distanceText: string;
  isApproximate: boolean;
  source: "osrm" | "cache" | "fallback";
  coordinates: [number, number][]; // [latitude, longitude] pairs for polyline rendering
}

interface CachedRoute {
  result: RouteResult;
  expiresAt: number;
}

// In-memory bounded cache (15-second TTL per origin-destination pair)
const ROUTE_CACHE = new Map<string, CachedRoute>();
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_SIZE = 500;

/** For test isolation: clears the route cache */
export function clearRouteCache(): void {
  ROUTE_CACHE.clear();
}

// OSRM Base URL (defaults to public open router, overridable via OSRM_ROUTER_URL)
const DEFAULT_OSRM_URL = "https://router.project-osrm.org";

/**
 * Grid snap coordinates to ~50m resolution to maximize cache hits
 * for continuous rescuer GPS movement.
 */
function snapCoord(val: number): number {
  return Math.round(val * 2000) / 2000;
}

function makeCacheKey(origin: LatLngPoint, destination: LatLngPoint): string {
  return `${snapCoord(origin.latitude)},${snapCoord(origin.longitude)}->${snapCoord(destination.latitude)},${snapCoord(destination.longitude)}`;
}

/**
 * Clean expired items from route cache if it exceeds max size
 */
function purgeCacheIfNecessary() {
  const now = Date.now();
  if (ROUTE_CACHE.size > MAX_CACHE_SIZE) {
    for (const [key, entry] of Array.from(ROUTE_CACHE.entries())) {
      if (entry.expiresAt < now) {
        ROUTE_CACHE.delete(key);
      }
    }
  }
}

/**
 * Calculate straight-line Haversine distance in meters
 */
export function calculateHaversineMeters(p1: LatLngPoint, p2: LatLngPoint): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format duration into user-friendly ETA string
 */
export function formatEtaString(minutes: number, isApproximate = false): string {
  const prefix = isApproximate ? "~" : "";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${prefix}${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const remMin = Math.round(minutes % 60);
  return remMin > 0 ? `${prefix}${hrs} hr ${remMin} min` : `${prefix}${hrs} hr`;
}

/**
 * Format distance into user-friendly string
 */
export function formatDistanceString(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Fallback routing calculation when external road router is unreachable.
 * Uses 1.35x road circuity factor and 30 km/h average emergency transit speed.
 */
export function calculateFallbackRoute(origin: LatLngPoint, destination: LatLngPoint): RouteResult {
  const straightMeters = calculateHaversineMeters(origin, destination);
  // Urban / rural road circuity factor: average roads are ~1.35x longer than straight lines
  const roadMeters = Math.round(straightMeters * 1.35);
  const roadKm = Math.round((roadMeters / 1000) * 10) / 10;

  // Emergency transit speed: 30 km/h = 8.33 m/s
  const durationSec = Math.max(30, Math.round(roadMeters / 8.33));
  const durationMin = Math.max(1, Math.round(durationSec / 60));

  return {
    distanceMeters: roadMeters,
    distanceKm: roadKm,
    durationSeconds: durationSec,
    durationMinutes: durationMin,
    etaText: formatEtaString(durationMin, true),
    distanceText: formatDistanceString(roadKm),
    isApproximate: true,
    source: "fallback",
    coordinates: [
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ],
  };
}

/**
 * Primary road routing function with caching, timeout, and graceful fallback.
 */
export async function calculateRoadRouteAndEta(
  origin: LatLngPoint,
  destination: LatLngPoint
): Promise<RouteResult> {
  // Validate coordinates
  if (
    typeof origin.latitude !== "number" ||
    typeof origin.longitude !== "number" ||
    typeof destination.latitude !== "number" ||
    typeof destination.longitude !== "number" ||
    isNaN(origin.latitude) ||
    isNaN(origin.longitude) ||
    isNaN(destination.latitude) ||
    isNaN(destination.longitude)
  ) {
    return calculateFallbackRoute(
      { latitude: 26.1445, longitude: 91.7362 },
      { latitude: 26.1445, longitude: 91.7362 }
    );
  }

  // 1. Check in-memory cache
  const cacheKey = makeCacheKey(origin, destination);
  const now = Date.now();
  const cached = ROUTE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return {
      ...cached.result,
      source: "cache",
    };
  }

  // 2. Query OSRM routing engine with a 3.5s timeout
  const baseUrl = (process.env.OSRM_ROUTER_URL || DEFAULT_OSRM_URL).replace(/\/$/, "");
  const url = `${baseUrl}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AssamEmergencyRescuePlatform/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || !data.routes.length || data.code !== "Ok") {
      throw new Error(`OSRM route not found: ${data.code || "No route"}`);
    }

    const primaryRoute = data.routes[0];
    const distanceMeters = Math.round(primaryRoute.distance || 0);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationSeconds = Math.round(primaryRoute.duration || 0);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
    const rawCoords: [number, number][] = primaryRoute.geometry?.coordinates || [];
    const coordinates: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);

    const result: RouteResult = {
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationMinutes,
      etaText: formatEtaString(durationMinutes, false),
      distanceText: formatDistanceString(distanceKm),
      isApproximate: false,
      source: "osrm",
      coordinates: coordinates.length > 0 ? coordinates : [[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]],
    };

    // Cache the result
    purgeCacheIfNecessary();
    ROUTE_CACHE.set(cacheKey, {
      result,
      expiresAt: now + CACHE_TTL_MS,
    });

    return result;
  } catch (err) {
    // Graceful fallback to Haversine + road circuity
    const fallback = calculateFallbackRoute(origin, destination);

    // Cache fallback for a shorter time (8 seconds) to retry OSRM on subsequent updates
    ROUTE_CACHE.set(cacheKey, {
      result: fallback,
      expiresAt: now + 8000,
    });

    return fallback;
  }
}
