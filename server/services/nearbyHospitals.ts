import { listHospitals, type MemoryHospital } from "../rescue.db";

export interface NormalizedHospitalBranch {
  id: number;
  ownerUserId: number | null;
  organizationName: string;
  branchName: string;
  registrationId: string | null;
  isPrimaryBranch: boolean;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  contactPhone: string | null;
  latitude: number;
  longitude: number;
  specialties: string[];
  specialty: string;
  erTotal: number;
  erAvailable: number;
  icuTotal: number;
  icuAvailable: number;
  oxygenUnits: number;
  bloodUnits: number;
  ambulances: number;
  totalEmergencyBeds: number;
  availableEmergencyBeds: number;
  totalIcuBeds: number;
  availableIcuBeds: number;
  oxygenCylinderCount: number;
  bloodUnitCount: number;
  ambulanceCount: number;
  supplies: {
    food: boolean;
    medicine: boolean;
    water: boolean;
    power: boolean;
  };
  foodSupplyStatus: "available" | "limited" | "critical" | "unavailable";
  medicineSupplyStatus: "available" | "limited" | "critical" | "unavailable";
  waterSupplyStatus: "available" | "limited" | "critical" | "unavailable";
  powerBackupStatus: "available" | "limited" | "critical" | "unavailable";
  status: "OPEN" | "LIMITED" | "FULL" | "CLOSED";
  legacyStatus: "open" | "limited" | "critical" | "closed";
  isSahayVerified: true;
  createdAt: string;
  updatedAt: string;
}

export interface NearbyHospitalItem {
  id: number | string;
  source: "SAHAY_VERIFIED" | "PUBLIC_DIRECTORY";
  isSahayVerified: boolean;
  name: string;
  organizationName?: string;
  branchName?: string;
  registrationId?: string | null;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone: string | null;
  contactPhone: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  specialties?: string[];
  specialty?: string;
  erTotal?: number;
  erAvailable?: number;
  icuTotal?: number;
  icuAvailable?: number;
  totalEmergencyBeds?: number;
  availableEmergencyBeds?: number;
  totalIcuBeds?: number;
  availableIcuBeds?: number;
  oxygenUnits?: number;
  bloodUnits?: number;
  ambulances?: number;
  oxygenCylinderCount?: number;
  bloodUnitCount?: number;
  ambulanceCount?: number;
  supplies?: {
    food: boolean;
    medicine: boolean;
    water: boolean;
    power: boolean;
  };
  foodSupplyStatus?: "available" | "limited" | "critical" | "unavailable";
  medicineSupplyStatus?: "available" | "limited" | "critical" | "unavailable";
  waterSupplyStatus?: "available" | "limited" | "critical" | "unavailable";
  powerBackupStatus?: "available" | "limited" | "critical" | "unavailable";
  status: string;
  legacyStatus?: string;
  updatedAt?: string;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function mapDbStatusToBranchStatus(
  status?: string | null
): "OPEN" | "LIMITED" | "FULL" | "CLOSED" {
  const normalized = String(status || "open").toLowerCase();
  if (normalized === "closed") return "CLOSED";
  if (normalized === "critical" || normalized === "full") return "FULL";
  if (normalized === "limited") return "LIMITED";
  return "OPEN";
}

export function mapBranchStatusToDbStatus(
  status?: string | null
): "open" | "limited" | "critical" | "closed" {
  const normalized = String(status || "OPEN").toUpperCase();
  if (normalized === "CLOSED") return "closed";
  if (normalized === "FULL" || normalized === "CRITICAL") return "critical";
  if (normalized === "LIMITED") return "limited";
  return "open";
}

export function normalizeHospitalBranch(raw: MemoryHospital | any): NormalizedHospitalBranch {
  const organizationName =
    String(raw.organizationName || "").trim() ||
    String(raw.name || "Registered Hospital").split(" — ")[0].trim();
  const branchName =
    String(raw.branchName || "").trim() ||
    (String(raw.name || "").includes(" — ")
      ? String(raw.name).split(" — ").slice(1).join(" — ").trim()
      : "Main Hospital");
  const displayName =
    String(raw.name || "").trim() ||
    (branchName && branchName !== organizationName
      ? `${organizationName} — ${branchName}`
      : organizationName);

  const specialtyStr = String(raw.specialty || "Trauma & Emergency Care").trim();
  const specialties = specialtyStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const foodSupplyStatus = raw.foodSupplyStatus || "available";
  const medicineSupplyStatus = raw.medicineSupplyStatus || "available";
  const waterSupplyStatus = raw.waterSupplyStatus || "available";
  const powerBackupStatus = raw.powerBackupStatus || "available";

  const isSupplyActive = (val: string) => val === "available" || val === "limited";

  const erTotal = Number(raw.totalEmergencyBeds ?? raw.erTotal ?? 0);
  const erAvailable = Number(raw.availableEmergencyBeds ?? raw.erAvailable ?? 0);
  const icuTotal = Number(raw.totalIcuBeds ?? raw.icuTotal ?? 0);
  const icuAvailable = Number(raw.availableIcuBeds ?? raw.icuAvailable ?? 0);
  const oxygenUnits = Number(raw.oxygenCylinderCount ?? raw.oxygenUnits ?? 0);
  const bloodUnits = Number(raw.bloodUnitCount ?? raw.bloodUnits ?? 0);
  const ambulances = Number(raw.ambulanceCount ?? raw.ambulances ?? 0);

  const legacyStatus = mapBranchStatusToDbStatus(raw.status);
  const status = mapDbStatusToBranchStatus(raw.status);

  return {
    id: Number(raw.id),
    ownerUserId: raw.ownerUserId ?? raw.updatedBy ?? null,
    organizationName,
    branchName,
    registrationId: raw.registrationId ?? null,
    isPrimaryBranch: raw.isPrimaryBranch !== undefined ? Boolean(raw.isPrimaryBranch) : true,
    name: displayName,
    address: String(raw.address || ""),
    city: String(raw.city || ""),
    state: String(raw.state || ""),
    pincode: String(raw.pincode || ""),
    phone: String(raw.contactPhone || raw.phone || ""),
    contactPhone: raw.contactPhone ?? raw.phone ?? null,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    specialties,
    specialty: specialtyStr,
    erTotal,
    erAvailable,
    icuTotal,
    icuAvailable,
    oxygenUnits,
    bloodUnits,
    ambulances,
    totalEmergencyBeds: erTotal,
    availableEmergencyBeds: erAvailable,
    totalIcuBeds: icuTotal,
    availableIcuBeds: icuAvailable,
    oxygenCylinderCount: oxygenUnits,
    bloodUnitCount: bloodUnits,
    ambulanceCount: ambulances,
    supplies: {
      food: isSupplyActive(foodSupplyStatus),
      medicine: isSupplyActive(medicineSupplyStatus),
      water: isSupplyActive(waterSupplyStatus),
      power: isSupplyActive(powerBackupStatus),
    },
    foodSupplyStatus,
    medicineSupplyStatus,
    waterSupplyStatus,
    powerBackupStatus,
    status,
    legacyStatus,
    isSahayVerified: true,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date(raw.updatedAt || Date.now()).toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
  };
}

// 10-minute in-memory TTL cache keyed by lat/lng rounded to 2 decimal places
const OVERPASS_CACHE_TTL_MS = 10 * 60 * 1000;
const _overpassCache = new Map<string, { expiresAt: number; items: Array<{ name: string; address: string; phone: string | null; latitude: number; longitude: number; osmId: string }> }>();

export function clearOverpassCache(): void {
  _overpassCache.clear();
}

function buildOsmAddress(tags: Record<string, string> | undefined): string {
  if (!tags) return "Public Directory Hospital";
  if (tags["addr:full"] && tags["addr:full"].trim()) return tags["addr:full"].trim();
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:locality"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || tags["addr:district"],
    tags["addr:state"],
    tags["addr:postcode"],
  ]
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return "OpenStreetMap Public Health Facility";
}

function normalizeHospitalNameTokens(name: string): Set<string> {
  const stopWords = new Set(["hospital", "medical", "college", "clinic", "centre", "center", "and", "the", "of", "general", "private", "govt", "government", "district", "branch", "main"]);
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));
  return new Set(tokens);
}

export function isMatchingHospitalName(nameA: string, nameB: string): boolean {
  const cleanA = nameA.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanB = nameB.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleanA || !cleanB) return false;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  const tokensA = normalizeHospitalNameTokens(nameA);
  const tokensB = normalizeHospitalNameTokens(nameB);
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let overlap = 0;
  for (const t of Array.from(tokensA)) {
    if (tokensB.has(t)) overlap++;
  }
  const minSize = Math.min(tokensA.size, tokensB.size);
  return overlap / minSize >= 0.5;
}

async function queryOverpassHospitals(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<{ ok: boolean; items: Array<{ name: string; address: string; phone: string | null; latitude: number; longitude: number; osmId: string }> }> {
  const query = `[out:json][timeout:5];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});relation["amenity"="hospital"](around:${radiusMeters},${lat},${lng}););out center tags 60;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "SahayEmergencyPlatform/2.0 (Pan-India Emergency Coordination)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return { ok: false, items: [] };
    }

    const data: any = await response.json();
    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
    const seenNames = new Set<string>();
    const results: Array<{ name: string; address: string; phone: string | null; latitude: number; longitude: number; osmId: string }> = [];

    for (const el of elements) {
      const tags: Record<string, string> | undefined = el.tags;
      const name = String(tags?.name || tags?.["name:en"] || "").trim();
      if (!name) continue;
      const elLat = Number(el.lat ?? el.center?.lat);
      const elLon = Number(el.lon ?? el.center?.lon);
      if (!Number.isFinite(elLat) || !Number.isFinite(elLon)) continue;

      const dedupeKey = `${name.toLowerCase()}@${elLat.toFixed(3)},${elLon.toFixed(3)}`;
      if (seenNames.has(dedupeKey)) continue;
      seenNames.add(dedupeKey);

      const rawPhone =
        tags?.phone ||
        tags?.["contact:phone"] ||
        tags?.["contact:mobile"] ||
        tags?.telephone ||
        null;

      results.push({
        osmId: `osm-${el.type}-${el.id}`,
        name,
        address: buildOsmAddress(tags),
        phone: rawPhone ? String(rawPhone).trim() : null,
        latitude: elLat,
        longitude: elLon,
      });
    }

    return { ok: true, items: results };
  } catch {
    return { ok: false, items: [] };
  }
}

export async function getOverpassNearbyHospitals(
  lat: number,
  lng: number
): Promise<{ overpassAvailable: boolean; items: Array<{ name: string; address: string; phone: string | null; latitude: number; longitude: number; osmId: string }> }> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = _overpassCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { overpassAvailable: true, items: cached.items };
  }

  // First search 15 km; if fewer than 5 results, expand to 30 km
  let res = await queryOverpassHospitals(lat, lng, 15000);
  if (res.ok && res.items.length < 5) {
    const expanded = await queryOverpassHospitals(lat, lng, 30000);
    if (expanded.ok) {
      res = expanded;
    }
  }

  if (res.ok) {
    _overpassCache.set(cacheKey, {
      expiresAt: Date.now() + OVERPASS_CACHE_TTL_MS,
      items: res.items,
    });
  }

  return { overpassAvailable: res.ok, items: res.items };
}

export async function discoverNearbyHospitals(options: {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  includePublicDirectory?: boolean;
  allRegistered?: boolean;
}) {
  const radiusKm = Number.isFinite(options.radiusKm) && (options.radiusKm ?? 0) > 0 ? Number(options.radiusKm) : 50;
  const hasCoords =
    options.lat !== null &&
    options.lat !== undefined &&
    options.lng !== null &&
    options.lng !== undefined &&
    Number.isFinite(options.lat) &&
    Number.isFinite(options.lng);

  const dbRows = await listHospitals();
  const normalizedBranches = dbRows.map(normalizeHospitalBranch);

  // If caller explicitly requests all registered hospitals across India (e.g. "All Registered" filter)
  if (options.allRegistered || !hasCoords) {
    const allItems: NearbyHospitalItem[] = normalizedBranches.map((b) => {
      const dist = hasCoords ? haversineKm(options.lat!, options.lng!, b.latitude, b.longitude) : 0;
      return {
        ...b,
        source: "SAHAY_VERIFIED",
        isSahayVerified: true,
        distanceKm: parseFloat(dist.toFixed(2)),
      };
    });
    if (hasCoords) {
      allItems.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return {
      hospitals: allItems,
      counts: {
        sahayVerified: allItems.length,
        publicDirectory: 0,
        total: allItems.length,
      },
      radiusKm,
      center: hasCoords ? { lat: options.lat!, lng: options.lng! } : null,
      overpassAvailable: true,
    };
  }

  const userLat = options.lat!;
  const userLng = options.lng!;

  // Tier 1: Active Sahay-registered hospitals within radiusKm
  const tier1: NearbyHospitalItem[] = normalizedBranches
    .filter((b) => b.legacyStatus !== "closed")
    .map((b) => ({
      ...b,
      source: "SAHAY_VERIFIED" as const,
      isSahayVerified: true,
      distanceKm: parseFloat(haversineKm(userLat, userLng, b.latitude, b.longitude).toFixed(2)),
    }))
    .filter((b) => b.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Tier 2: Overpass OpenStreetMap nearby hospitals (if enabled)
  let overpassAvailable = true;
  let tier2: NearbyHospitalItem[] = [];

  if (options.includePublicDirectory !== false) {
    const osmRes = await getOverpassNearbyHospitals(userLat, userLng);
    overpassAvailable = osmRes.overpassAvailable;

    tier2 = osmRes.items
      .map((osm) => {
        const dist = haversineKm(userLat, userLng, osm.latitude, osm.longitude);
        return {
          id: osm.osmId,
          source: "PUBLIC_DIRECTORY" as const,
          isSahayVerified: false,
          name: osm.name,
          address: osm.address,
          phone: osm.phone,
          contactPhone: osm.phone,
          latitude: osm.latitude,
          longitude: osm.longitude,
          distanceKm: parseFloat(dist.toFixed(2)),
          status: "PUBLIC_DIRECTORY",
        };
      })
      .filter((osm) => osm.distanceKm <= Math.max(radiusKm, 30))
      .filter((osm) => {
        // Smart deduplication: drop OSM entry if a SAHAY_VERIFIED branch is within 150m with matching name
        return !tier1.some(
          (sahay) =>
            haversineKm(osm.latitude, osm.longitude, sahay.latitude, sahay.longitude) <= 0.15 &&
            isMatchingHospitalName(osm.name, sahay.name)
        );
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return {
    hospitals: [...tier1, ...tier2],
    counts: {
      sahayVerified: tier1.length,
      publicDirectory: tier2.length,
      total: tier1.length + tier2.length,
    },
    radiusKm,
    center: { lat: userLat, lng: userLng },
    overpassAvailable,
  };
}
