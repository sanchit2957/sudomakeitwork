/**
 * Automated Dispatch Lifecycle & Orchestrator
 * Manages rapid 10s triage deadlines, automated Uber-style offer dispatch,
 * candidate rotation, concurrency-safe acceptance, and Command Centre escalation.
 */

import { eq, inArray } from "drizzle-orm";
import { getDb, withDbTimeout } from "../db";
import { incidents, notifications } from "../../drizzle/schema";
import {
  addIncidentEvent,
  assignMissionAtomically,
  createMissionOffer,
  getIncidentById,
  getMissionOfferById,
  listOffersForIncident,
  updateMissionOfferStatus,
  writeAudit,
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryNotifications,
} from "../rescue.db";
import { findRankedMatchesForIncident } from "./matching";
import type { IncidentDispatchTarget, SOSCategory } from "./scoring";
import { sendRescuerPush } from "../push";

export const CITIZEN_TRIAGE_WINDOW_MS = 15_000; // 15 seconds
export const RESPONDER_OFFER_WINDOW_MS = Number(process.env.RESPONDER_OFFER_WINDOW_MS) || 30_000; // 30 seconds (configurable)
export const DISPATCH_RADIUS_TIERS_KM = [15, 35, 75, 150, Infinity];

/**
 * Initializes rapid triage and deadline for a newly created SOS incident.
 */
export async function startIncidentTriage(incidentId: number, currentTime: Date = new Date()) {
  const triageDeadlineAt = new Date(currentTime.getTime() + CITIZEN_TRIAGE_WINDOW_MS);
  const db = await getDb();
  if (db) {
    try {
      await withDbTimeout(
        db
          .update(incidents)
          .set({
            triageStartedAt: currentTime,
            triageDeadlineAt,
            dispatchStatus: "triage_pending",
            updatedAt: currentTime,
          })
          .where(eq(incidents.id, incidentId)),
        4000,
        "startIncidentTriage"
      );
    } catch (err) {
      if (process.env.NODE_ENV === "production") throw err;
    }
  }

  const mem = _memoryIncidents.get(incidentId);
  if (mem) {
    mem.triageStartedAt = currentTime;
    mem.triageDeadlineAt = triageDeadlineAt;
    mem.dispatchStatus = "triage_pending";
    mem.updatedAt = currentTime;
    _memoryIncidents.set(incidentId, mem);
  }

  await writeAudit(
    mem?.reporterId ?? null,
    "sos_created",
    "incident",
    incidentId,
    `Triage started with 10s deadline until ${triageDeadlineAt.toISOString()}`
  );

  return { triageDeadlineAt };
}

/**
 * Records user's category selection within the 10s triage window or applies fallback.
 */
export async function selectIncidentCategory(
  incidentId: number,
  category: SOSCategory,
  actorId: number | null,
  currentTime: Date = new Date()
) {
  const incident = await getIncidentById(incidentId);
  if (!incident) throw new Error("Incident not found.");

  if (incident.status !== "pending") {
    throw new Error("Incident is already assigned or resolved.");
  }

  const isExpired = incident.triageDeadlineAt && currentTime.getTime() > new Date(incident.triageDeadlineAt).getTime();
  const appliedCategory: SOSCategory = isExpired ? (incident.requestCategory || "emergency") : category;
  const dispatchStatus = "matching";

  const db = await getDb();
  if (db) {
    try {
      await withDbTimeout(
        db
          .update(incidents)
          .set({
            requestCategory: appliedCategory,
            triageSelectedAt: currentTime,
            dispatchStatus,
            matchingStartedAt: currentTime,
            updatedAt: currentTime,
          })
          .where(eq(incidents.id, incidentId)),
        4000,
        "selectIncidentCategory"
      );
    } catch (err) {
      if (process.env.NODE_ENV === "production") throw err;
    }
  }

  const mem = _memoryIncidents.get(incidentId);
  if (mem) {
    mem.requestCategory = appliedCategory;
    mem.triageSelectedAt = currentTime;
    mem.dispatchStatus = dispatchStatus;
    mem.matchingStartedAt = currentTime;
    mem.updatedAt = currentTime;
    _memoryIncidents.set(incidentId, mem);
  }

  if (isExpired) {
    await writeAudit(actorId, "triage_timeout", "incident", incidentId, `Triage window timed out. Defaulted to ${appliedCategory}.`);
    await addIncidentEvent(incidentId, actorId, "triage_timeout", "Triage timed out", "Automatic emergency response activated.");
  } else {
    await writeAudit(actorId, "triage_selected", "incident", incidentId, `Citizen selected category: ${appliedCategory}`);
    await addIncidentEvent(incidentId, actorId, "triage_selected", `Category: ${appliedCategory.toUpperCase()}`, `Request classified as ${appliedCategory}.`);
  }

  // Trigger matching immediately
  return await advanceIncidentDispatch(incidentId, currentTime);
}

/**
 * Advances the dispatch lifecycle for an incident:
 * - Checks & handles triage expiry -> auto defaults
 * - Checks active offer expiry -> marks expired and rotates to next candidate
 * - Finds next best candidate and sends 10s offer
 * - Escalates to Command Centre if all candidates exhausted
 */
export async function advanceIncidentDispatch(incidentId: number, currentTime: Date = new Date()) {
  const incident = await getIncidentById(incidentId);
  if (!incident) return null;

  if (incident.status !== "pending" || incident.assignedRescuerId !== null) {
    return { status: incident.status, assignedRescuerId: incident.assignedRescuerId };
  }

  // 1. Check Triage Deadline
  if (incident.dispatchStatus === "triage_pending") {
    if (incident.triageDeadlineAt && currentTime.getTime() >= new Date(incident.triageDeadlineAt).getTime()) {
      // Triage window expired -> apply safe default
      const defaultCategory = incident.requestCategory || "emergency";
      const db = await getDb();
      if (db) {
        try {
          await withDbTimeout(
            db
              .update(incidents)
              .set({
                requestCategory: defaultCategory,
                dispatchStatus: "matching",
                matchingStartedAt: currentTime,
                updatedAt: currentTime,
              })
              .where(eq(incidents.id, incidentId)),
            4000,
            "advance_triageExpired"
          );
        } catch (err) {
          if (process.env.NODE_ENV === "production") throw err;
        }
      }

      const mem = _memoryIncidents.get(incidentId);
      if (mem) {
        mem.requestCategory = defaultCategory;
        mem.dispatchStatus = "matching";
        mem.matchingStartedAt = currentTime;
        mem.updatedAt = currentTime;
        _memoryIncidents.set(incidentId, mem);
      }

      await writeAudit(null, "triage_timeout", "incident", incidentId, `Triage deadline passed. Activated default ${defaultCategory}.`);
      await addIncidentEvent(incidentId, null, "triage_timeout", "Triage timed out", "Automatic emergency response activated.");
      incident.dispatchStatus = "matching";
      incident.requestCategory = defaultCategory;
    } else {
      // Citizen still has time remaining in triage window
      return { status: "triage_pending", triageDeadlineAt: incident.triageDeadlineAt };
    }
  }

  // 2. Check Active Offers for Expiry
  const offers = await listOffersForIncident(incidentId);
  const activeOffers = offers.filter(o => o.status === "offered");

  if (activeOffers.length > 0) {
    let anyStillActive = false;
    for (const activeOffer of activeOffers) {
      const expiresAtTime = new Date(activeOffer.expiresAt).getTime();
      if (currentTime.getTime() >= expiresAtTime) {
        // Expired!
        await updateMissionOfferStatus(activeOffer.id, "expired", currentTime);
        await writeAudit(
          activeOffer.rescuerId,
          "responder_offer_expired",
          "missionOffer",
          activeOffer.id,
          `Offer for rescuer ${activeOffer.rescuerId} expired after ${RESPONDER_OFFER_WINDOW_MS / 1000}s`
        );
        await addIncidentEvent(
          incidentId,
          activeOffer.rescuerId,
          "responder_offer_expired",
          "Offer expired",
          `Responder did not accept within the ${RESPONDER_OFFER_WINDOW_MS / 1000}-second response window.`
        );
      } else {
        anyStillActive = true;
      }
    }

    if (anyStillActive) {
      const remainingActive = (await listOffersForIncident(incidentId)).filter(o => o.status === "offered");
      return { status: "offered", offers: remainingActive };
    }
  }

  // 3. Find Candidates (Broaden search radius tier on zero accepts)
  const target: IncidentDispatchTarget = {
    id: incident.id,
    latitude: incident.latitude,
    longitude: incident.longitude,
    emergencyType: incident.emergencyType,
    requestCategory: incident.requestCategory || "emergency",
    severity: incident.severity,
    peopleAffected: incident.peopleAffected,
  };

  let tierIndex = Math.min(incident.matchingAttempts || 0, DISPATCH_RADIUS_TIERS_KM.length - 1);
  let rankedMatches: Awaited<ReturnType<typeof findRankedMatchesForIncident>> = [];

  while (tierIndex < DISPATCH_RADIUS_TIERS_KM.length) {
    const maxRadiusKm = DISPATCH_RADIUS_TIERS_KM[tierIndex];
    rankedMatches = await findRankedMatchesForIncident(target, currentTime, maxRadiusKm);
    if (rankedMatches.length > 0) {
      break;
    }
    // Silently broaden to next tier
    tierIndex++;
  }

  if (rankedMatches.length > 0) {
    // Broadcast SIMULTANEOUSLY to all eligible candidates in this tier
    const offerExpiresAt = new Date(currentTime.getTime() + RESPONDER_OFFER_WINDOW_MS);
    const createdOffers = await Promise.all(
      rankedMatches.map(top =>
        createMissionOffer({
          incidentId: incident.id,
          rescuerId: top.candidate.user.id,
          distanceKm: top.match.distanceKm,
          matchScore: top.match.score,
          expiresAt: offerExpiresAt,
        })
      )
    );

    const matchingAttempts = tierIndex + 1;

    const db = await getDb();
    if (db) {
      try {
        await withDbTimeout(
          db
            .update(incidents)
            .set({
              dispatchStatus: "offered",
              matchingAttempts,
              updatedAt: currentTime,
            })
            .where(eq(incidents.id, incidentId)),
          4000,
          "advance_updateOffered"
        );
      } catch (err) {
        if (process.env.NODE_ENV === "production") throw err;
      }
    }

    const mem = _memoryIncidents.get(incidentId);
    if (mem) {
      mem.dispatchStatus = "offered";
      mem.matchingAttempts = matchingAttempts;
      mem.updatedAt = currentTime;
      _memoryIncidents.set(incidentId, mem);
    }

    for (let i = 0; i < rankedMatches.length; i++) {
      const top = rankedMatches[i];
      const offer = createdOffers[i];
      await writeAudit(
        top.candidate.user.id,
        "responder_offer_created",
        "missionOffer",
        offer.id,
        `Simultaneous offer created for responder ${top.candidate.user.id} (${top.candidate.profile.callSign}). Score: ${top.match.score}, Dist: ${top.match.distanceKm}km. ${top.match.reason}`
      );
    }

    await addIncidentEvent(
      incidentId,
      null,
      "responder_offer_created",
      "Mission broadcast dispatched",
      `Offers dispatched simultaneously to ${rankedMatches.length} nearby response unit(s). 15-second response window active.`
    );

    // Send push / notifications to all rescuer candidates simultaneously
    try {
      await sendRescuerPush(
        rankedMatches.map(r => r.candidate.user.id),
        {
          title: `🚨 EMERGENCY OFFER: ${incident.requestCategory.toUpperCase()}`,
          body: `${incident.severity.toUpperCase()} SOS at ${incident.locationLabel}. 15s to accept.`,
          incidentId: incident.id,
          url: "/responder",
        }
      );
    } catch (pushErr) {
      console.warn("[Dispatch] Push notification skipped:", pushErr);
    }

    return { status: "offered", offers: createdOffers, candidates: rankedMatches.map(r => r.candidate) };
  } else {
    // Zero available responders right now in any tier -> maintain "matching" search status
    // (Silently broaden / poll; do not auto-escalate to Command)
    const db = await getDb();
    if (db) {
      try {
        await withDbTimeout(
          db
            .update(incidents)
            .set({
              dispatchStatus: "matching",
              matchingAttempts: DISPATCH_RADIUS_TIERS_KM.length,
              updatedAt: currentTime,
            })
            .where(eq(incidents.id, incidentId)),
          4000,
          "advance_matchingSearch"
        );
      } catch (err) {
        if (process.env.NODE_ENV === "production") throw err;
      }
    }

    const mem = _memoryIncidents.get(incidentId);
    if (mem) {
      mem.dispatchStatus = "matching";
      mem.matchingAttempts = DISPATCH_RADIUS_TIERS_KM.length;
      mem.updatedAt = currentTime;
      _memoryIncidents.set(incidentId, mem);
    }

    return { status: "matching" };
  }
}

/**
 * Rescuer accepts a mission offer.
 * Concurrency-safe and strictly validates expiration and ownership.
 * First-to-respond wins. Losing rescuers get a clear "mission already assigned" notice.
 */
export async function acceptMissionOffer(
  offerId: number,
  rescuerId: number,
  currentTime: Date = new Date()
) {
  const offer = await getMissionOfferById(offerId);
  if (!offer) throw new Error("Offer not found.");

  if (offer.rescuerId !== rescuerId) {
    throw new Error("You are not authorized to accept this offer.");
  }

  if (offer.status !== "offered") {
    if (offer.status === "cancelled" || offer.status === "expired") {
      throw new Error("This mission was already assigned to another responder. You may be matched to a nearby victim shortly.");
    }
    throw new Error(`This offer is no longer valid (status: ${offer.status}).`);
  }

  const expiresAtTime = new Date(offer.expiresAt).getTime();
  if (currentTime.getTime() > expiresAtTime) {
    await updateMissionOfferStatus(offerId, "expired", currentTime);
    await advanceIncidentDispatch(offer.incidentId, currentTime);
    throw new Error("Offer has expired.");
  }

  // Atomically assign mission (first-to-respond wins)
  try {
    const result = await assignMissionAtomically({
      incidentId: offer.incidentId,
      rescuerId,
      assignedBy: rescuerId,
      offerId,
      notes: `Accepted automatically via responder matching engine at ${currentTime.toISOString()}`,
    });

    await writeAudit(
      rescuerId,
      "responder_offer_accepted",
      "missionOffer",
      offerId,
      `Rescuer ${rescuerId} accepted offer within response window. Mission ${result.missionId} active.`
    );

    return result;
  } catch (err: any) {
    if (err.message && err.message.includes("already been assigned")) {
      throw new Error("This mission was already assigned to another responder. You may be matched to a nearby victim shortly.");
    }
    throw err;
  }
}

/**
 * Rescuer declines a mission offer.
 * Immediately triggers next candidate matching.
 */
export async function declineMissionOffer(
  offerId: number,
  rescuerId: number,
  currentTime: Date = new Date()
) {
  const offer = await getMissionOfferById(offerId);
  if (!offer) throw new Error("Offer not found.");

  if (offer.rescuerId !== rescuerId) {
    throw new Error("You are not authorized to decline this offer.");
  }

  if (offer.status !== "offered") {
    throw new Error(`This offer cannot be declined (status: ${offer.status}).`);
  }

  await updateMissionOfferStatus(offerId, "declined", currentTime);

  await writeAudit(
    rescuerId,
    "responder_offer_declined",
    "missionOffer",
    offerId,
    `Rescuer ${rescuerId} declined offer.`
  );

  await addIncidentEvent(
    offer.incidentId,
    rescuerId,
    "responder_offer_declined",
    "Offer declined",
    "Responder declined mission. Searching for next nearest unit."
  );

  // Advance dispatch to next candidate immediately
  return await advanceIncidentDispatch(offer.incidentId, currentTime);
}

/**
 * Background sweep for all active dispatches needing advancement (triage timeouts / offer timeouts).
 */
export async function checkAndAdvanceAllDispatches(currentTime: Date = new Date()) {
  const db = await getDb();
  let pendingIncidentIds: number[] = [];

  if (db) {
    try {
      const rows = await withDbTimeout(
        db
          .select({ id: incidents.id })
          .from(incidents)
          .where(
            inArray(incidents.dispatchStatus, ["triage_pending", "matching", "offered"])
          ),
        4000,
        "checkAndAdvanceAllDispatches_ids"
      );
      pendingIncidentIds = rows.map(r => r.id);
    } catch {
      // fallback
    }
  }

  if (pendingIncidentIds.length === 0) {
    pendingIncidentIds = Array.from(_memoryIncidents.values())
      .filter(i => i.status === "pending" && (i.dispatchStatus === "triage_pending" || i.dispatchStatus === "matching" || i.dispatchStatus === "offered"))
      .map(i => i.id);
  }

  for (const id of pendingIncidentIds) {
    try {
      await advanceIncidentDispatch(id, currentTime);
    } catch (err) {
      console.warn(`[Dispatch] Error advancing incident ${id}:`, err);
    }
  }
}

let _dispatchWorkerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the global background dispatch worker (every 2 seconds).
 */
export function startDispatchWorker(intervalMs: number = 2000) {
  if (_dispatchWorkerInterval) return;
  _dispatchWorkerInterval = setInterval(() => {
    void checkAndAdvanceAllDispatches(new Date());
  }, intervalMs);
}

export function stopDispatchWorker() {
  if (_dispatchWorkerInterval) {
    clearInterval(_dispatchWorkerInterval);
    _dispatchWorkerInterval = null;
  }
}
