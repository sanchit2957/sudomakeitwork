/**
 * Automated Dispatch Scoring Engine
 * Deterministic, capability-first, geographically-accurate responder ranking.
 */

export const EARTH_RADIUS_KM = 6371;
export const LOCATION_FRESHNESS_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
export const STALE_LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export type SOSCategory = "medical" | "rescue" | "emergency";
export type RescuerCapabilityType = "medical" | "flood_rescue" | "trapped_rescue" | "evacuation" | "general_emergency";

export interface RescuerCandidate {
  user: {
    id: number;
    name: string | null;
    role: string;
    status: string;
  };
  profile: {
    callSign: string;
    category?: "medical" | "boat" | "ground-team" | "other";
    availability: "available" | "on_mission" | "off_duty";
    lastLatitude: number | null;
    lastLongitude: number | null;
    locationUpdatedAt: Date | null;
  };
  capabilities: Array<{
    capability: string;
    priority?: number;
    active: string;
  }>;
  activeMissionsCount?: number;
}

export interface IncidentDispatchTarget {
  id: number;
  latitude: number;
  longitude: number;
  emergencyType: "flood" | "medical" | "trapped" | "evacuation" | "other";
  requestCategory: SOSCategory;
  severity: "critical" | "high" | "medium" | "low";
  peopleAffected?: number;
}

export interface MatchScoreResult {
  score: number;
  distanceKm: number;
  isEligible: boolean;
  breakdown: {
    capabilityScore: number;
    distanceScore: number;
    freshnessScore: number;
    workloadScore: number;
    severityScore: number;
  };
  reason: string;
}

/**
 * Calculates accurate great-circle geographic distance using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Infinity;
  }
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Evaluates capability compatibility and returns capability score points.
 * Capability is strictly prioritized over distance.
 */
export function evaluateCapabilityScore(
  category: SOSCategory,
  capabilities: Array<{ capability: string; active: string; priority?: number }>,
  profile?: { category?: string; callSign?: string }
): { compatible: boolean; capabilityScore: number; matchedCapability: string | null } {
  const activeCaps = new Set(
    capabilities
      .filter(c => c.active === "yes" || (c as any).active === true)
      .map(c => c.capability.toLowerCase().trim())
  );

  // Infer capabilities from rescuer category or call sign asset tags
  const rescuerCategory = profile?.category?.toLowerCase();
  const callSign = (profile?.callSign || "").toLowerCase();

  if (rescuerCategory === "medical" || callSign.includes("med") || callSign.includes("doctor")) {
    activeCaps.add("medical");
  }
  if (rescuerCategory === "boat" || callSign.includes("boat") || callSign.includes("ndrf") || callSign.includes("sdrf")) {
    activeCaps.add("flood_rescue");
    activeCaps.add("trapped_rescue");
    activeCaps.add("evacuation");
  }
  if (rescuerCategory === "ground-team") {
    activeCaps.add("general_emergency");
    activeCaps.add("trapped_rescue");
    activeCaps.add("evacuation");
  }

  switch (category) {
    case "medical": {
      if (activeCaps.has("medical")) {
        return { compatible: true, capabilityScore: 1000, matchedCapability: "medical" };
      }
      return { compatible: false, capabilityScore: 0, matchedCapability: null };
    }
    case "rescue": {
      if (activeCaps.has("trapped_rescue") || activeCaps.has("flood_rescue")) {
        return {
          compatible: true,
          capabilityScore: 1000,
          matchedCapability: activeCaps.has("trapped_rescue") ? "trapped_rescue" : "flood_rescue",
        };
      }
      if (activeCaps.has("evacuation")) {
        return { compatible: true, capabilityScore: 800, matchedCapability: "evacuation" };
      }
      if (activeCaps.has("general_emergency")) {
        return { compatible: true, capabilityScore: 500, matchedCapability: "general_emergency" };
      }
      return { compatible: false, capabilityScore: 0, matchedCapability: null };
    }
    case "emergency":
    default: {
      if (activeCaps.has("general_emergency")) {
        return { compatible: true, capabilityScore: 1000, matchedCapability: "general_emergency" };
      }
      if (activeCaps.has("flood_rescue") || activeCaps.has("trapped_rescue") || activeCaps.has("evacuation") || activeCaps.has("medical")) {
        const first = Array.from(activeCaps)[0];
        return { compatible: true, capabilityScore: 800, matchedCapability: first };
      }
      // If candidate has no explicitly registered capability, they are not compatible
      return { compatible: false, capabilityScore: 0, matchedCapability: null };
    }
  }
}

/**
 * Deterministically computes a match score for a rescuer candidate against an incident.
 */
export function scoreCandidate(
  candidate: RescuerCandidate,
  target: IncidentDispatchTarget,
  currentTime: Date = new Date(),
  freshnessWindowMs: number = LOCATION_FRESHNESS_WINDOW_MS
): MatchScoreResult {
  // 1. Role & Status Verification
  if (candidate.user.role !== "rescuer") {
    return {
      score: 0,
      distanceKm: Infinity,
      isEligible: false,
      breakdown: { capabilityScore: 0, distanceScore: 0, freshnessScore: 0, workloadScore: 0, severityScore: 0 },
      reason: "User role is not rescuer",
    };
  }
  if (candidate.user.status !== "active") {
    return {
      score: 0,
      distanceKm: Infinity,
      isEligible: false,
      breakdown: { capabilityScore: 0, distanceScore: 0, freshnessScore: 0, workloadScore: 0, severityScore: 0 },
      reason: "Rescuer account is inactive",
    };
  }

  // 2. Availability Verification
  if (candidate.profile.availability !== "available") {
    return {
      score: 0,
      distanceKm: Infinity,
      isEligible: false,
      breakdown: { capabilityScore: 0, distanceScore: 0, freshnessScore: 0, workloadScore: 0, severityScore: 0 },
      reason: `Rescuer is ${candidate.profile.availability.replace("_", " ")}`,
    };
  }

  // 3. Location Presence & Freshness
  const { lastLatitude, lastLongitude, locationUpdatedAt } = candidate.profile;
  if (lastLatitude === null || lastLongitude === null || !Number.isFinite(lastLatitude) || !Number.isFinite(lastLongitude)) {
    return {
      score: 0,
      distanceKm: Infinity,
      isEligible: false,
      breakdown: { capabilityScore: 0, distanceScore: 0, freshnessScore: 0, workloadScore: 0, severityScore: 0 },
      reason: "No GPS location coordinates available",
    };
  }

  const locationAgeMs = locationUpdatedAt ? Math.max(0, currentTime.getTime() - new Date(locationUpdatedAt).getTime()) : STALE_LOCATION_MAX_AGE_MS;
  if (locationAgeMs > STALE_LOCATION_MAX_AGE_MS) {
    return {
      score: 0,
      distanceKm: Infinity,
      isEligible: false,
      breakdown: { capabilityScore: 0, distanceScore: 0, freshnessScore: 0, workloadScore: 0, severityScore: 0 },
      reason: "Location coordinates are excessively stale (>24 hours)",
    };
  }

  // 4. Capability Compatibility
  const { compatible, capabilityScore, matchedCapability } = evaluateCapabilityScore(target.requestCategory, candidate.capabilities, candidate.profile);
  if (!compatible) {
    return {
      score: 0,
      distanceKm: Infinity,
      isEligible: false,
      breakdown: { capabilityScore: 0, distanceScore: 0, freshnessScore: 0, workloadScore: 0, severityScore: 0 },
      reason: `Lacks required capability for ${target.requestCategory} SOS`,
    };
  }

  // 5. Geographic Distance
  const distanceKm = calculateHaversineDistanceKm(target.latitude, target.longitude, lastLatitude, lastLongitude);
  const distanceScore = Math.max(0, Math.round(500 - distanceKm * 10));

  // 6. Freshness Score
  const ageMinutes = Math.floor(locationAgeMs / (60 * 1000));
  const freshnessScore = locationAgeMs <= freshnessWindowMs ? Math.max(0, Math.round(100 - ageMinutes * 1.5)) : 10;

  // 7. Workload Score
  const workloadScore = (candidate.activeMissionsCount ?? 0) === 0 ? 100 : 0;

  // 8. Severity Weight
  const severityScore = target.severity === "critical" ? 50 : target.severity === "high" ? 25 : target.severity === "medium" ? 10 : 0;

  const totalScore = capabilityScore + distanceScore + freshnessScore + workloadScore + severityScore;

  return {
    score: totalScore,
    distanceKm,
    isEligible: true,
    breakdown: {
      capabilityScore,
      distanceScore,
      freshnessScore,
      workloadScore,
      severityScore,
    },
    reason: `Matched ${matchedCapability} capability (${capabilityScore} pts), ${distanceKm} km away (${distanceScore} pts), ${ageMinutes}m fresh (${freshnessScore} pts)`,
  };
}
