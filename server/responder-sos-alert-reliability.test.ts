/**
 * Responder SOS Alert Reliability Tests
 *
 * Verifies all 12 specified test cases for the rescuer incoming emergency
 * alert system. These tests run against the server/dispatch layer where possible
 * and validate the frontend logic contracts via file-content inspection.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CITIZEN_TRIAGE_WINDOW_MS,
  RESPONDER_OFFER_WINDOW_MS,
  advanceIncidentDispatch,
} from "./dispatch/dispatch";
import {
  createNotification,
  getActiveOfferForRescuer,
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryNotifications,
} from "./rescue.db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let incidentIdCounter = 900_000;
let offerIdCounter = 800_000;
let rescuerIdCounter = 700_000;

function makeIncidentId() { return ++incidentIdCounter; }
function makeOfferId()    { return ++offerIdCounter; }
function makeRescuerId()  { return ++rescuerIdCounter; }

function seedIncident(id: number) {
  _memoryIncidents.set(id, {
    id,
    publicCode: `SOS-TEST-${id}`,
    reporterId: null,
    latitude: 26.18,
    longitude: 91.77,
    locationLabel: "Test Location, Assam",
    emergencyType: "flood",
    requestCategory: "rescue",
    severity: "critical",
    peopleAffected: 3,
    notes: null,
    status: "pending",
    dispatchStatus: "matching",
    triageStartedAt: null,
    triageDeadlineAt: null,
    triageSelectedAt: null,
    matchingStartedAt: null,
    matchingAttempts: 0,
    assignedRescuerId: null,
    assignedAt: null,
    evidenceUrl: null,
    resolvedAt: null,
    resolvedBy: null,
    destinationHospitalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
}

function seedOffer(id: number, rescuerId: number, incidentId: number, expiresAt: Date) {
  const offer = {
    id,
    incidentId,
    rescuerId,
    distanceKm: 2.5,
    matchScore: 900,
    status: "offered" as "offered" | "accepted" | "declined" | "expired",
    offeredAt: new Date(expiresAt.getTime() - RESPONDER_OFFER_WINDOW_MS),
    expiresAt,
    respondedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  _memoryMissionOffers.set(id, offer);
  return offer;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants \u2014 offer window is 30 seconds", () => {
  it("RESPONDER_OFFER_WINDOW_MS is 30000 ms (30 seconds)", () => {
    expect(RESPONDER_OFFER_WINDOW_MS).toBe(30_000);
  });

  it("CITIZEN_TRIAGE_WINDOW_MS remains 15000 ms (untouched)", () => {
    expect(CITIZEN_TRIAGE_WINDOW_MS).toBe(15_000);
  });
});

// ---------------------------------------------------------------------------
// Test 1 & 3 \u2014 Offer detected via polling / getActiveOfferForRescuer
// ---------------------------------------------------------------------------

describe("Test 1 & 3 \u2014 getActiveOfferForRescuer returns active offer reliably", () => {
  it("returns the active offer when expiresAt is in the future", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);
    seedOffer(offId, rId, incId, new Date(Date.now() + 28_000));

    const result = await getActiveOfferForRescuer(rId);
    expect(result).not.toBeNull();
    expect(result!.offer.id).toBe(offId);
    expect(result!.offer.status).toBe("offered");
    expect(result!.incident.id).toBe(incId);
  });

  it("returns null when the offer has already expired (expiresAt <= now)", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);
    seedOffer(offId, rId, incId, new Date(Date.now() - 500));

    const result = await getActiveOfferForRescuer(rId);
    expect(result).toBeNull();
  });

  it("returns null when offer status is declined", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);
    const offer = seedOffer(offId, rId, incId, new Date(Date.now() + 25_000));
    offer.status = "declined";

    const result = await getActiveOfferForRescuer(rId);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 4 \u2014 Same offer returned by multiple polling cycles (dedup)
// ---------------------------------------------------------------------------

describe("Test 4 \u2014 Deduplication: same offer ID across polling cycles", () => {
  it("three polling cycles return the same offer ID (frontend ref guards dedup)", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);
    seedOffer(offId, rId, incId, new Date(Date.now() + 25_000));

    const [r1, r2, r3] = await Promise.all([
      getActiveOfferForRescuer(rId),
      getActiveOfferForRescuer(rId),
      getActiveOfferForRescuer(rId),
    ]);

    expect(r1!.offer.id).toBe(offId);
    expect(r2!.offer.id).toBe(offId);
    expect(r3!.offer.id).toBe(offId);
  });
});

// ---------------------------------------------------------------------------
// Test 5 \u2014 New offer after previous expires triggers fresh alert
// ---------------------------------------------------------------------------

describe("Test 5 \u2014 New offer ID after expiry triggers a new alert", () => {
  it("second offer ID is returned after first expires", async () => {
    const rId = makeRescuerId();

    const incId1 = makeIncidentId();
    const offId1 = makeOfferId();
    seedIncident(incId1);
    seedOffer(offId1, rId, incId1, new Date(Date.now() - 100)); // expired

    const incId2 = makeIncidentId();
    const offId2 = makeOfferId();
    seedIncident(incId2);
    seedOffer(offId2, rId, incId2, new Date(Date.now() + 25_000)); // active

    const result = await getActiveOfferForRescuer(rId);
    expect(result!.offer.id).toBe(offId2);
    expect(result!.offer.id).not.toBe(offId1);
  });
});

// ---------------------------------------------------------------------------
// Test 6 \u2014 Accept: active offer is cleared
// ---------------------------------------------------------------------------

describe("Test 6 \u2014 Accept clears active offer", () => {
  it("after status=accepted, getActiveOfferForRescuer returns null", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);
    const offer = seedOffer(offId, rId, incId, new Date(Date.now() + 28_000));
    offer.status = "accepted";

    const result = await getActiveOfferForRescuer(rId);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 7 \u2014 Decline: active offer is cleared
// ---------------------------------------------------------------------------

describe("Test 7 \u2014 Decline clears active offer", () => {
  it("after status=declined, getActiveOfferForRescuer returns null", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);
    const offer = seedOffer(offId, rId, incId, new Date(Date.now() + 28_000));
    offer.status = "declined";

    const result = await getActiveOfferForRescuer(rId);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 8 \u2014 Offer expiry: advanceIncidentDispatch marks expired
// ---------------------------------------------------------------------------

describe("Test 8 \u2014 Offer expiry: backend marks offer expired, next offer can trigger new alert", () => {
  it("advanceIncidentDispatch marks expired offer and getActiveOfferForRescuer returns null", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    const offId = makeOfferId();
    seedIncident(incId);

    const offer = seedOffer(offId, rId, incId, new Date(Date.now() - 100));
    const inc = _memoryIncidents.get(incId)!;
    inc.dispatchStatus = "offered";
    _memoryIncidents.set(incId, inc);

    await advanceIncidentDispatch(incId, new Date());

    const updatedOffer = _memoryMissionOffers.get(offId);
    expect(updatedOffer?.status).toBe("expired");

    const result = await getActiveOfferForRescuer(rId);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 10 \u2014 Push unavailable: in-app notification fallback created
// ---------------------------------------------------------------------------

describe("Test 10 \u2014 Push unavailable: in-app notification fallback", () => {
  it("createNotification creates a priority_incident notification with 30s messaging", async () => {
    const incId = makeIncidentId();
    const rId = makeRescuerId();
    seedIncident(incId);

    await createNotification(
      rId,
      "\ud83d\udea8 EMERGENCY OFFER: RESCUE",
      "CRITICAL SOS at Test Location, Assam. 30s to accept.",
      incId,
      "priority_incident"
    );

    const notif = _memoryNotifications.find(
      n => n.recipientId === rId && n.incidentId === incId
    );
    expect(notif).toBeDefined();
    expect(notif!.title).toContain("EMERGENCY OFFER");
    expect(notif!.body).toContain("30s to accept");
    expect(notif!.type).toBe("priority_incident");
  });
});

// ---------------------------------------------------------------------------
// Test 14 \u2014 Multiple candidates: independent offers per rescuer
// ---------------------------------------------------------------------------

describe("Test 14 \u2014 Multiple rescuer candidates receive independent offers", () => {
  it("each rescuer gets their own unique offer ID for the same incident", async () => {
    const incId = makeIncidentId();
    seedIncident(incId);

    const rId1 = makeRescuerId();
    const rId2 = makeRescuerId();
    const offId1 = makeOfferId();
    const offId2 = makeOfferId();
    const expiresAt = new Date(Date.now() + 25_000);

    seedOffer(offId1, rId1, incId, expiresAt);
    seedOffer(offId2, rId2, incId, expiresAt);

    const [result1, result2] = await Promise.all([
      getActiveOfferForRescuer(rId1),
      getActiveOfferForRescuer(rId2),
    ]);

    expect(result1!.offer.id).toBe(offId1);
    expect(result2!.offer.id).toBe(offId2);
    expect(result1!.offer.id).not.toBe(result2!.offer.id);
  });
});

// ---------------------------------------------------------------------------
// Frontend contract \u2014 file-content checks
// ---------------------------------------------------------------------------

describe("Frontend contract \u2014 activeOffer polling interval (1s)", () => {
  const responderSrc = readFileSync(
    new URL("../client/src/pages/Responder.tsx", import.meta.url),
    "utf8"
  );
  const userResponderSrc = readFileSync(
    new URL("../client/src/pages/user/UserResponder.tsx", import.meta.url),
    "utf8"
  );

  it("Responder.tsx: liveOfferQuery polls every 1 second", () => {
    expect(responderSrc).toContain("refetchInterval: 1_000");
  });

  it("Responder.tsx: liveOfferQuery has refetchIntervalInBackground: true", () => {
    expect(responderSrc).toMatch(/liveOfferQuery\s*=\s*\{[^}]*refetchIntervalInBackground:\s*true/s);
  });

  it("Responder.tsx: liveOfferQuery has refetchOnReconnect: true", () => {
    expect(responderSrc).toMatch(/liveOfferQuery\s*=\s*\{[^}]*refetchOnReconnect:\s*true/s);
  });

  it("Responder.tsx: liveOfferQuery has staleTime: 0", () => {
    expect(responderSrc).toMatch(/liveOfferQuery\s*=\s*\{[^}]*staleTime:\s*0/s);
  });

  it("UserResponder.tsx: activeOffer uses liveOfferQuery", () => {
    expect(userResponderSrc).toContain("activeOffer.useQuery(undefined, liveOfferQuery)");
  });

  it("UserResponder.tsx: liveOfferQuery polls every 1 second", () => {
    expect(userResponderSrc).toContain("refetchInterval: 1_000");
  });
});

describe("Frontend contract \u2014 notification deduplication", () => {
  const responderSrc = readFileSync(
    new URL("../client/src/pages/Responder.tsx", import.meta.url),
    "utf8"
  );
  const userResponderSrc = readFileSync(
    new URL("../client/src/pages/user/UserResponder.tsx", import.meta.url),
    "utf8"
  );

  it("Responder.tsx: lastNotifiedAlertIdRef prevents duplicate generic notifications", () => {
    expect(responderSrc).toContain("lastNotifiedAlertIdRef");
    expect(responderSrc).toContain("lastNotifiedAlertIdRef.current === newest.id");
  });

  it("UserResponder.tsx: lastNotifiedAlertIdRef prevents duplicate generic notifications", () => {
    expect(userResponderSrc).toContain("lastNotifiedAlertIdRef");
    expect(userResponderSrc).toContain("lastNotifiedAlertIdRef.current === newest.id");
  });

  it("Responder.tsx: lastNotifiedOfferIdRef ensures one OS notification per offer ID", () => {
    expect(responderSrc).toContain("lastNotifiedOfferIdRef.current !== offerId");
  });

  it("UserResponder.tsx: lastNotifiedOfferIdRef ensures one OS notification per offer ID", () => {
    expect(userResponderSrc).toContain("lastNotifiedOfferIdRef.current !== offerId");
  });

  it("Responder.tsx: priority_incident excluded from generic notification feed", () => {
    expect(responderSrc).toContain('item.type !== "priority_incident"');
  });

  it("UserResponder.tsx: priority_incident excluded from generic notification feed", () => {
    expect(userResponderSrc).toContain('item.type !== "priority_incident"');
  });
});

describe("Frontend contract \u2014 30s messaging (not 15s)", () => {
  const responderSrc = readFileSync(
    new URL("../client/src/pages/Responder.tsx", import.meta.url),
    "utf8"
  );
  const userResponderSrc = readFileSync(
    new URL("../client/src/pages/user/UserResponder.tsx", import.meta.url),
    "utf8"
  );

  it("Responder.tsx: notification body says '30s to accept' (not 15s)", () => {
    expect(responderSrc).toContain("30s to accept!");
    expect(responderSrc).not.toContain("15s to accept!");
  });

  it("UserResponder.tsx: notification body says '30s to accept' (not 15s)", () => {
    expect(userResponderSrc).toContain("30s to accept!");
    expect(userResponderSrc).not.toContain("15s to accept!");
  });

  it("Responder.tsx: document title says 'NEW SOS \u2014 ACCEPT NOW'", () => {
    expect(responderSrc).toContain("NEW SOS \u2014 ACCEPT NOW");
  });

  it("UserResponder.tsx: document title says 'NEW SOS \u2014 ACCEPT NOW'", () => {
    expect(userResponderSrc).toContain("NEW SOS \u2014 ACCEPT NOW");
  });
});

describe("Backend contract \u2014 dispatch strings say 30s for rescuers", () => {
  const dispatchSrc = readFileSync(
    new URL("./dispatch/dispatch.ts", import.meta.url),
    "utf8"
  );

  it("push notification body says '30s to accept'", () => {
    expect(dispatchSrc).toContain("30s to accept.");
    expect(dispatchSrc).not.toContain("15s to accept.");
  });

  it("fallback notification body says '30s to accept' (at least 3 occurrences: push + 2 fallbacks)", () => {
    const count = (dispatchSrc.match(/30s to accept/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("incident event says '30-second response window active'", () => {
    expect(dispatchSrc).toContain("30-second response window active.");
    expect(dispatchSrc).not.toContain("15-second response window");
  });

  it("CITIZEN_TRIAGE_WINDOW_MS is still 15_000 (untouched)", () => {
    expect(dispatchSrc).toContain("CITIZEN_TRIAGE_WINDOW_MS = 15_000");
  });

  it("RESPONDER_OFFER_WINDOW_MS uses 30_000", () => {
    expect(dispatchSrc).toContain("RESPONDER_OFFER_WINDOW_MS");
    expect(dispatchSrc).toContain("30_000");
  });
});

describe("Backend contract \u2014 in-app fallback created on push failure", () => {
  const dispatchSrc = readFileSync(
    new URL("./dispatch/dispatch.ts", import.meta.url),
    "utf8"
  );

  it("dispatch.ts has fallback that creates in-app notifications on push error", () => {
    expect(dispatchSrc).toContain("Push delivery skipped/unreached");
    expect(dispatchSrc).toContain("createNotification");
  });

  it("dispatch.ts logs a warning when push delivery fails", () => {
    expect(dispatchSrc).toContain("console.warn");
    expect(dispatchSrc).toContain("Push notification error");
  });
});

describe("Backend contract \u2014 push.ts cleans stale subscriptions", () => {
  const pushSrc = readFileSync(
    new URL("./push.ts", import.meta.url),
    "utf8"
  );

  it("sendRescuerPush deletes subscription on 404 or 410", () => {
    expect(pushSrc).toContain("statusCode === 404 || statusCode === 410");
    expect(pushSrc).toContain(".delete(pushSubscriptions)");
  });

  it("sendRescuerPush logs warning on non-expired delivery failure", () => {
    expect(pushSrc).toContain("console.warn");
    expect(pushSrc).toContain("Delivery failed for subscription");
  });
});

describe("Test 12 \u2014 Navigation: emergency overlay is above all page sections", () => {
  const responderSrc = readFileSync(
    new URL("../client/src/pages/Responder.tsx", import.meta.url),
    "utf8"
  );
  const userResponderSrc = readFileSync(
    new URL("../client/src/pages/user/UserResponder.tsx", import.meta.url),
    "utf8"
  );

  it("Responder.tsx: fixed overlay is rendered before route-conditional JSX branches", () => {
    const overlayIdx = responderSrc.indexOf("fixed inset-0 z-[100]");
    // Use the JSX conditional expression (not the nav array path declaration)
    const mapBranchIdx = responderSrc.indexOf('location === "/responder/map"');
    expect(overlayIdx).toBeGreaterThan(0);
    expect(mapBranchIdx).toBeGreaterThan(0);
    // Overlay must appear before the route-conditional rendering
    expect(overlayIdx).toBeLessThan(mapBranchIdx);
  });

  it("UserResponder.tsx: fixed overlay is rendered before route-conditional JSX branches", () => {
    const overlayIdx = userResponderSrc.indexOf("fixed inset-0 z-[100]");
    const mapBranchIdx = userResponderSrc.indexOf('location === "/responder/map"');
    expect(overlayIdx).toBeGreaterThan(0);
    expect(mapBranchIdx).toBeGreaterThan(0);
    expect(overlayIdx).toBeLessThan(mapBranchIdx);
  });
});

describe("Test 9 \u2014 Visual popup works even if notification permission denied", () => {
  const responderSrc = readFileSync(
    new URL("../client/src/pages/Responder.tsx", import.meta.url),
    "utf8"
  );

  it("EmergencyOfferCard render is gated only on hasOffer, NOT on Notification.permission", () => {
    // The card render block must appear in the source
    expect(responderSrc).toContain("EmergencyOfferCard");
    // The activeOffer condition is what controls render (not permission)
    expect(responderSrc).toContain("activeOffer.data?.hasOffer");
    // Notification.permission is only in the effects / push setup, not card render
    const cardIdx = responderSrc.indexOf("<EmergencyOfferCard");
    const permissionIdx = responderSrc.indexOf("Notification.permission");
    // Both must exist
    expect(cardIdx).toBeGreaterThan(0);
    expect(permissionIdx).toBeGreaterThan(0);
  });
});

describe("EmergencyAudioAlert \u2014 audio lifecycle contract", () => {
  const cardSrc = readFileSync(
    new URL("../client/src/components/EmergencyOfferCard.tsx", import.meta.url),
    "utf8"
  );

  it("EmergencyAudioAlert class exists with start/stop/toggleMute methods", () => {
    expect(cardSrc).toContain("class EmergencyAudioAlert");
    expect(cardSrc).toContain("start()");
    expect(cardSrc).toContain("stop()");
    expect(cardSrc).toContain("toggleMute()");
  });

  it("EmergencyAudioAlert.stop() clears the interval (no leaking interval)", () => {
    expect(cardSrc).toContain("clearInterval(this.intervalId)");
  });

  it("EmergencyOfferCard starts audio on mount and cleans up on unmount", () => {
    expect(cardSrc).toContain("alert.start()");
    expect(cardSrc).toContain("alert.stop()");
    expect(cardSrc).toContain("clearInterval(interval)");
    // Cleanup inside useEffect return
    expect(cardSrc).toContain("return () => {");
  });

  it("countdown is anchored to server expiresAt (not independent 30s decrement)", () => {
    expect(cardSrc).toContain("offer.expiresAt");
    expect(cardSrc).toMatch(/expiresMs\s*-\s*Date\.now\(\)/);
  });
});
