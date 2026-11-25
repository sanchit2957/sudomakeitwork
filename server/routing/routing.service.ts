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

export interface RouteFloodAvoidance {
  avoidsFloodZones: boolean;
  intersectedZones: string[];
  detourApplied: boolean;
  hazardWarning?: string;
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
  floodAvoidance?: RouteFloodAvoidance;
}

export interface FloodPolygon {
  name: string;
  severity: string;
  vertices: Array<{ lat: number; lng: number }>;
}

function isPointInPolygon(lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findIntersectedFloodZones(
  coordinates: [number, number][],
  zones: FloodPolygon[]
): FloodPolygon[] {
  if (!zones.length || !coordinates.length) return [];
  const matched: FloodPolygon[] = [];
  for (const zone of zones) {
    if (zone.vertices.length < 3) continue;
    let hits = false;
    for (let i = 0; i < coordinates.length; i++) {
      const [lat, lng] = coordinates[i];
      if (isPointInPolygon(lat, lng, zone.vertices)) {
        hits = true;
        break;
      }
      // Also check midpoint between consecutive route points so straight fallback lines don't skip narrow zones
      if (i + 1 < coordinates.length) {
        const midLat = (lat + coordinates[i + 1][0]) / 2;
        const midLng = (lng + coordinates[i + 1][1]) / 2;
        if (isPointInPolygon(midLat, midLng, zone.vertices)) {
          hits = true;
          break;
        }
      }
    }
    if (hits) matched.push(zone);
  }
  return matched;
}

function computeDetourWaypoint(
  origin: LatLngPoint,
  destination: LatLngPoint,
  zone: FloodPolygon
): LatLngPoint {
  const cLat = zone.vertices.reduce((s, v) => s + v.lat, 0) / zone.vertices.length;
  const cLng = zone.vertices.reduce((s, v) => s + v.lng, 0) / zone.vertices.length;
  const maxOffsetLat = Math.max(...zone.vertices.map((v) => Math.abs(v.lat - cLat)), 0.015) * 1.45;
  const maxOffsetLng = Math.max(...zone.vertices.map((v) => Math.abs(v.lng - cLng)), 0.015) * 1.45;
  const dLat = destination.latitude - origin.latitude;
  const dLng = destination.longitude - origin.longitude;
  const len = Math.hypot(dLat, dLng) || 1;
  // Perpendicular unit vector shifted outside the flood zone polygon
  const perpLat = -dLng / len;
  const perpLng = dLat / len;
  return {
    latitude: cLat + perpLat * maxOffsetLat,
    longitude: cLng + perpLng * maxOffsetLng,
  };
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
 * Parse FloodZone polygonJson strings into FloodPolygon objects safely.
 */
export function parseFloodZonesForRouting(
  rawZones: Array<{ name: string; severity: string; polygonJson: string }>
): FloodPolygon[] {
  const parsed: FloodPolygon[] = [];
  for (const z of rawZones) {
    try {
      const verts = JSON.parse(z.polygonJson);
      if (Array.isArray(verts) && verts.length >= 3) {
        const vertices = verts
          .map((v: any) => ({ lat: Number(v.lat ?? v[0]), lng: Number(v.lng ?? v[1]) }))
          .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));
        if (vertices.length >= 3) {
          parsed.push({ name: z.name, severity: z.severity, vertices });
        }
      }
    } catch {
      // Skip invalid polygon JSON
    }
  }
  return parsed;
}

async function fetchOsrmCoordinates(waypoints: LatLngPoint[]): Promise<{
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
}> {
  const baseUrl = (process.env.OSRM_ROUTER_URL || DEFAULT_OSRM_URL).replace(/\/$/, "");
  const coordPath = waypoints.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url = `${baseUrl}/route/v1/driving/${coordPath}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "SahayEmergencyPlatform/1.0",
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
  const durationSeconds = Math.round(primaryRoute.duration || 0);
  const rawCoords: [number, number][] = primaryRoute.geometry?.coordinates || [];
  const coordinates: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);

  return { distanceMeters, durationSeconds, coordinates };
}

/**
 * Primary road routing function with flood-zone avoidance, caching, timeout, and graceful fallback.
 */
export async function calculateRoadRouteAndEta(
  origin: LatLngPoint,
  destination: LatLngPoint,
  options?: { floodZones?: FloodPolygon[] }
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
      { latitude: 20.5937, longitude: 78.9629 },
      { latitude: 20.5937, longitude: 78.9629 }
    );
  }

  const activeZones = options?.floodZones || [];

  // 1. Check in-memory cache (skip cache if active flood zones are supplied to ensure fresh hazard checks)
  const cacheKey = `${makeCacheKey(origin, destination)}::fz${activeZones.length}`;
  const now = Date.now();
  const cached = ROUTE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return {
      ...cached.result,
      source: "cache",
    };
  }

  // 2. Query OSRM routing engine with a 3.5s timeout
  try {
    let routeData = await fetchOsrmCoordinates([origin, destination]);
    let coords =
      routeData.coordinates.length > 0
        ? routeData.coordinates
        : ([
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ] as [number, number][]);

    let floodAvoidance: RouteFloodAvoidance | undefined;

    if (activeZones.length > 0) {
      const hits = findIntersectedFloodZones(coords, activeZones);
      if (hits.length > 0) {
        const detourWp = computeDetourWaypoint(origin, destination, hits[0]);
        try {
          const detourData = await fetchOsrmCoordinates([origin, detourWp, destination]);
          const detourCoords =
            detourData.coordinates.length > 0 ? detourData.coordinates : coords;
          const remainingHits = findIntersectedFloodZones(detourCoords, activeZones);
          routeData = detourData;
          coords = detourCoords;
          floodAvoidance = {
            avoidsFloodZones: remainingHits.length === 0,
            intersectedZones: hits.map((h) => h.name),
            detourApplied: true,
            hazardWarning:
              remainingHits.length === 0
                ? `Detour active avoiding flooded sector: ${hits.map((h) => h.name).join(", ")}`
                : `Partial flood hazard on route (${remainingHits.map((h) => h.name).join(", ")})`,
          };
        } catch {
          floodAvoidance = {
            avoidsFloodZones: false,
            intersectedZones: hits.map((h) => h.name),
            detourApplied: false,
            hazardWarning: `Route intersects active flood zone: ${hits.map((h) => h.name).join(", ")}`,
          };
        }
      } else {
        floodAvoidance = {
          avoidsFloodZones: true,
          intersectedZones: [],
          detourApplied: false,
        };
      }
    }

    const distanceKm = Math.round((routeData.distanceMeters / 1000) * 10) / 10;
    const durationMinutes = Math.max(1, Math.round(routeData.durationSeconds / 60));

    const result: RouteResult = {
      distanceMeters: routeData.distanceMeters,
      distanceKm,
      durationSeconds: routeData.durationSeconds,
      durationMinutes,
      etaText: formatEtaString(durationMinutes, false),
      distanceText: formatDistanceString(distanceKm),
      isApproximate: false,
      source: "osrm",
      coordinates: coords,
      ...(floodAvoidance ? { floodAvoidance } : {}),
    };

    // Cache the result
    purgeCacheIfNecessary();
    ROUTE_CACHE.set(cacheKey, {
      result,
      expiresAt: now + CACHE_TTL_MS,
    });

    return result;
  } catch (err) {
    // Graceful fallback to Haversine + road circuity, with flood-zone detour if intersected
    let fallback = calculateFallbackRoute(origin, destination);

    if (activeZones.length > 0) {
      const hits = findIntersectedFloodZones(fallback.coordinates, activeZones);
      if (hits.length > 0) {
        const detourWp = computeDetourWaypoint(origin, destination, hits[0]);
        const leg1 = calculateFallbackRoute(origin, detourWp);
        const leg2 = calculateFallbackRoute(detourWp, destination);
        const combinedMeters = leg1.distanceMeters + leg2.distanceMeters;
        const combinedKm = Math.round((combinedMeters / 1000) * 10) / 10;
        const combinedSec = leg1.durationSeconds + leg2.durationSeconds;
        const combinedMin = Math.max(1, Math.round(combinedSec / 60));
        fallback = {
          distanceMeters: combinedMeters,
          distanceKm: combinedKm,
          durationSeconds: combinedSec,
          durationMinutes: combinedMin,
          etaText: formatEtaString(combinedMin, true),
          distanceText: formatDistanceString(combinedKm),
          isApproximate: true,
          source: "fallback",
          coordinates: [
            [origin.latitude, origin.longitude],
            [detourWp.latitude, detourWp.longitude],
            [destination.latitude, destination.longitude],
          ],
          floodAvoidance: {
            avoidsFloodZones: true,
            intersectedZones: hits.map((h) => h.name),
            detourApplied: true,
            hazardWarning: `Detour applied around flooded zone: ${hits.map((h) => h.name).join(", ")}`,
          },
        };
      }
    }

    // Cache fallback for a shorter time (8 seconds) to retry OSRM on subsequent updates
    ROUTE_CACHE.set(cacheKey, {
      result: fallback,
      expiresAt: now + 8000,
    });

    return fallback;
  }
}
