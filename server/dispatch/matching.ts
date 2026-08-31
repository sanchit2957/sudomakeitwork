/**
 * Automated Responder Matching Engine
 * Queries and ranks available responders for an incident target.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb, withDbTimeout } from "../db";
import { missions, rescuerCapabilities, rescueProfiles, users } from "../../drizzle/schema";
import {
  scoreCandidate,
  type IncidentDispatchTarget,
  type MatchScoreResult,
  type RescuerCandidate,
} from "./scoring";
import {
  _memoryMissions,
  _memoryRescueProfiles,
  _memoryUsers,
  getRescuerCapabilities,
  listOffersForIncident,
} from "../rescue.db";

export interface RankedMatch {
  candidate: RescuerCandidate;
  match: MatchScoreResult;
}

/**
 * Retrieves all registered rescuer candidates with their profiles, capabilities, and workload.
 */
export async function getRescuerCandidates(): Promise<RescuerCandidate[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await withDbTimeout(
        db
          .select({
            user: users,
            profile: rescueProfiles,
          })
          .from(rescueProfiles)
          .innerJoin(users, eq(rescueProfiles.userId, users.id))
          .where(and(eq(users.role, "rescuer"), eq(users.status, "active"))),
        4000,
        "getRescuerCandidates_roster"
      );

      if (rows.length > 0) {
        const userIds = rows.map(r => r.user.id);

        // Fetch capabilities
        const caps = await withDbTimeout(
          db
            .select()
            .from(rescuerCapabilities)
            .where(and(inArray(rescuerCapabilities.rescuerId, userIds), eq(rescuerCapabilities.active, "yes"))),
          4000,
          "getRescuerCandidates_capabilities"
        );

        // Fetch active missions
        const activeMissions = await withDbTimeout(
          db
            .select({ rescuerId: missions.rescuerId })
            .from(missions)
            .where(and(inArray(missions.rescuerId, userIds), inArray(missions.status, ["pending", "dispatched"]))),
          4000,
          "getRescuerCandidates_missions"
        );

        const capsByRescuer = new Map<number, typeof caps>();
        for (const c of caps) {
          const list = capsByRescuer.get(c.rescuerId) || [];
          list.push(c);
          capsByRescuer.set(c.rescuerId, list);
        }

        const missionCounts = new Map<number, number>();
        for (const m of activeMissions) {
          missionCounts.set(m.rescuerId, (missionCounts.get(m.rescuerId) || 0) + 1);
        }

        return rows.map(({ user, profile }) => {
          let userCaps = capsByRescuer.get(user.id) || [];
          // Default fallback capabilities for existing accounts with no capability rows yet
          if (userCaps.length === 0) {
            userCaps = [
              { id: 0, rescuerId: user.id, capability: "general_emergency" as const, priority: 1, active: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
              { id: 0, rescuerId: user.id, capability: "flood_rescue" as const, priority: 1, active: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
              { id: 0, rescuerId: user.id, capability: "evacuation" as const, priority: 1, active: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
            ];
          }

          return {
            user: {
              id: user.id,
              name: user.name,
              role: user.role,
              status: user.status,
            },
            profile: {
              callSign: profile.callSign,
              category: (profile as any).category || (profile.callSign.toLowerCase().includes("boat") ? "boat" : profile.callSign.toLowerCase().includes("med") ? "medical" : "ground-team"),
              availability: profile.availability as "available" | "on_mission" | "off_duty",
              lastLatitude: profile.lastLatitude,
              lastLongitude: profile.lastLongitude,
              locationUpdatedAt: profile.locationUpdatedAt,
            },
            capabilities: userCaps.map(c => ({
              capability: c.capability,
              priority: c.priority,
              active: c.active,
            })),
            activeMissionsCount: missionCounts.get(user.id) || 0,
          };
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  // In-Memory Fallback (Dev/Testing)
  const candidates: RescuerCandidate[] = [];
  const profiles = Array.from(_memoryRescueProfiles.values());
  for (const profile of profiles) {
    const user = Array.from(_memoryUsers.values()).find(u => u.id === profile.userId);
    if (user && user.role === "rescuer" && (user.status || "active") === "active") {
      const caps = await getRescuerCapabilities(user.id);
      const activeMissionsCount = Array.from(_memoryMissions.values()).filter(
        m => m.rescuerId === user.id && (m.status === "pending" || m.status === "dispatched")
      ).length;

      candidates.push({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          status: user.status || "active",
        },
        profile: {
          callSign: profile.callSign,
          category: (profile as any).category || (profile.callSign.toLowerCase().includes("boat") ? "boat" : profile.callSign.toLowerCase().includes("med") ? "medical" : "ground-team"),
          availability: profile.availability,
          lastLatitude: profile.lastLatitude,
          lastLongitude: profile.lastLongitude,
          locationUpdatedAt: profile.locationUpdatedAt,
        },
        capabilities: caps.length
          ? caps
          : [
              { capability: "general_emergency", priority: 1, active: "yes" },
              { capability: "flood_rescue", priority: 1, active: "yes" },
              { capability: "evacuation", priority: 1, active: "yes" },
            ],
        activeMissionsCount,
      });
    }
  }
  return candidates;
}

/**
 * Finds and ranks all eligible rescuer candidates for an incident.
 * Excludes candidates who have already declined or had expired offers for this incident.
 * Optionally filters by radius tier (maxRadiusKm).
 */
export async function findRankedMatchesForIncident(
  target: IncidentDispatchTarget,
  currentTime: Date = new Date(),
  maxRadiusKm?: number
): Promise<RankedMatch[]> {
  const allCandidates = await getRescuerCandidates();
  const pastOffers = await listOffersForIncident(target.id);

  // Set of rescuer IDs who have already responded or expired
  const excludedRescuerIds = new Set(
    pastOffers
      .filter(o => o.status === "declined" || o.status === "expired" || o.status === "cancelled")
      .map(o => o.rescuerId)
  );

  const ranked: RankedMatch[] = [];

  for (const candidate of allCandidates) {
    if (excludedRescuerIds.has(candidate.user.id)) {
      continue;
    }

    const match = scoreCandidate(candidate, target, currentTime);
    if (match.isEligible) {
      if (maxRadiusKm !== undefined && match.distanceKm > maxRadiusKm) {
        continue;
      }
      ranked.push({ candidate, match });
    }
  }

  // Deterministic sort:
  // 1. Highest score first
  // 2. Shortest distance
  // 3. Lowest rescuer ID (tie breaker)
  ranked.sort((a, b) => {
    if (b.match.score !== a.match.score) {
      return b.match.score - a.match.score;
    }
    if (a.match.distanceKm !== b.match.distanceKm) {
      return a.match.distanceKm - b.match.distanceKm;
    }
    return a.candidate.user.id - b.candidate.user.id;
  });

  return ranked;
}
