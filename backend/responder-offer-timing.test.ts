import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryMissions,
  _memoryRescueProfiles,
  _memoryUsers,
} from "./rescue.db";
import {
  setRescuerSessionStartedAt,
  rescuerSessionStartRegistry,
} from "./routers/rescue";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";

function createRescuerContext(
  id: number,
  sessionStartedAt?: number,
  sessionToken?: string
): TrpcContext {
  const now = new Date();
  const headers: Record<string, string> = {};
  if (sessionToken) {
    headers.authorization = `Bearer ${sessionToken}`;
  }
  return {
    user: {
      id,
      openId: `rescuer-unit-${id}`,
      name: `Rescuer ${id}`,
      email: `rescuer${id}@test.org`,
      loginMethod: "test",
      role: "rescuer",
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      sessionStartedAt,
      codeVersion: 1,
    },
    req: {
      protocol: "https",
      headers,
      ip: "127.0.0.1",
    } as any,
    res: {
      cookie: () => {},
    } as any,
  };
}

describe("SURGICAL FIX — Rescuer Accept/Decline Offer Timing Rule", () => {
  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryMissionOffers.clear();
    _memoryMissions.clear();
    _memoryUsers.clear();
    _memoryRescueProfiles.clear();
    rescuerSessionStartRegistry.clear();
  });

  // -------------------------------------------------------------------------
  // TEST 1: SOS created before responder login -> no popup eligibility
  // -------------------------------------------------------------------------
  it("TEST 1: SOS created before responder login -> activeOffer returns hasOffer: false", async () => {
    const rescuerId = 101;
    const loginTime = new Date("2026-09-04T10:05:00.000Z").getTime();
    const incidentTime = new Date("2026-09-04T10:00:00.000Z"); // 5 min before login

    // Citizen creates SOS at 10:00
    const incidentId = 1;
    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-PRE0001",
      reporterId: 50,
      contactName: "Citizen A",
      locationLabel: "Guwahati Ward 3",
      latitude: 26.14,
      longitude: 91.73,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 2,
      notes: "Water entering home",
      status: "pending",
      dispatchStatus: "offered",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    // Offer exists for this rescuer
    const offerId = 501;
    _memoryMissionOffers.set(offerId, {
      id: offerId,
      incidentId,
      rescuerId,
      distanceKm: 2.5,
      matchScore: 850,
      status: "offered",
      offeredAt: new Date("2026-09-04T10:01:00.000Z"),
      expiresAt: new Date("2026-09-04T10:20:00.000Z"), // still unexpired
      createdAt: new Date("2026-09-04T10:01:00.000Z"),
      updatedAt: new Date("2026-09-04T10:01:00.000Z"),
    } as any);

    // Rescuer logs in at 10:05
    setRescuerSessionStartedAt(rescuerId, loginTime);
    const ctx = createRescuerContext(rescuerId, loginTime);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.rescue.rescuer.activeOffer();
    expect(result.hasOffer).toBe(false);
    expect(result.offer).toBeNull();
    expect(result.incident).toBeNull();
  });

  // -------------------------------------------------------------------------
  // TEST 2: SOS created after responder login -> popup eligible
  // -------------------------------------------------------------------------
  it("TEST 2: SOS created after responder login -> activeOffer returns hasOffer: true", async () => {
    const rescuerId = 102;
    const loginTime = new Date("2026-09-04T10:05:00.000Z").getTime();
    const incidentTime = new Date("2026-09-04T10:06:00.000Z"); // 1 min after login

    // Rescuer logged in at 10:05
    setRescuerSessionStartedAt(rescuerId, loginTime);

    // Citizen creates NEW SOS at 10:06
    const incidentId = 2;
    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-POST002",
      reporterId: 51,
      contactName: "Citizen B",
      locationLabel: "Dispur Circle",
      latitude: 26.15,
      longitude: 91.77,
      emergencyType: "medical",
      severity: "critical",
      peopleAffected: 1,
      notes: "Elderly person needs evacuation",
      status: "pending",
      dispatchStatus: "offered",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    // Dispatch creates offer at 10:06
    const offerId = 502;
    _memoryMissionOffers.set(offerId, {
      id: offerId,
      incidentId,
      rescuerId,
      distanceKm: 1.8,
      matchScore: 920,
      status: "offered",
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 30_000), // unexpired
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    const ctx = createRescuerContext(rescuerId, loginTime);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.rescue.rescuer.activeOffer();
    expect(result.hasOffer).toBe(true);
    expect(result.offer?.id).toBe(offerId);
    expect(result.incident?.id).toBe(incidentId);
    expect(result.incident?.publicCode).toBe("SOS-POST002");
  });

  // -------------------------------------------------------------------------
  // TEST 3: Offer created before responder login -> no popup eligibility
  // -------------------------------------------------------------------------
  it("TEST 3: Offer created before responder login -> no popup eligibility", async () => {
    const rescuerId = 103;
    const incidentTime = new Date("2026-09-04T09:50:00.000Z");
    const offerTime = new Date("2026-09-04T09:51:00.000Z");
    const loginTime = new Date("2026-09-04T10:00:00.000Z").getTime();

    _memoryIncidents.set(3, {
      id: 3,
      publicCode: "SOS-OLD0003",
      locationLabel: "Jalukbari",
      latitude: 26.15,
      longitude: 91.66,
      emergencyType: "trapped",
      severity: "high",
      peopleAffected: 3,
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    _memoryMissionOffers.set(503, {
      id: 503,
      incidentId: 3,
      rescuerId,
      distanceKm: 4.1,
      matchScore: 780,
      status: "offered",
      offeredAt: offerTime,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: offerTime,
      updatedAt: offerTime,
    } as any);

    setRescuerSessionStartedAt(rescuerId, loginTime);
    const ctx = createRescuerContext(rescuerId, loginTime);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.rescue.rescuer.activeOffer();
    expect(result.hasOffer).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Old active offer survives polling after login -> still no popup
  // -------------------------------------------------------------------------
  it("TEST 4: Old active offer survives polling after login -> still no popup across multiple polling ticks", async () => {
    const rescuerId = 104;
    const loginTime = new Date("2026-09-04T10:10:00.000Z").getTime();
    const incidentTime = new Date("2026-09-04T10:05:00.000Z"); // 5 min prior

    _memoryIncidents.set(4, {
      id: 4,
      publicCode: "SOS-POLL004",
      locationLabel: "Khanapara",
      latitude: 26.12,
      longitude: 91.82,
      emergencyType: "flood",
      severity: "medium",
      peopleAffected: 1,
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    _memoryMissionOffers.set(504, {
      id: 504,
      incidentId: 4,
      rescuerId,
      status: "offered",
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 100_000),
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    setRescuerSessionStartedAt(rescuerId, loginTime);
    const ctx = createRescuerContext(rescuerId, loginTime);
    const caller = appRouter.createCaller(ctx);

    // Simulate 5 sequential 1-second polling ticks
    for (let tick = 1; tick <= 5; tick++) {
      const pollResult = await caller.rescue.rescuer.activeOffer();
      expect(pollResult.hasOffer).toBe(false);
      expect(pollResult.offer).toBeNull();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 5: New SOS after login -> existing popup flow remains eligible
  // -------------------------------------------------------------------------
  it("TEST 5: New SOS after login -> existing popup flow remains eligible and returns full incident details", async () => {
    const rescuerId = 105;
    const loginTime = new Date("2026-09-04T10:00:00.000Z").getTime();
    const newIncidentTime = new Date("2026-09-04T10:08:00.000Z"); // 8 min after login

    setRescuerSessionStartedAt(rescuerId, loginTime);

    _memoryIncidents.set(5, {
      id: 5,
      publicCode: "SOS-NEW0005",
      locationLabel: "Panbazar Overbridge",
      latitude: 26.18,
      longitude: 91.75,
      emergencyType: "medical",
      severity: "critical",
      peopleAffected: 4,
      notes: "Severe bleeding, ambulance needed",
      voiceNoteUrl: "https://example.com/voice.webm",
      createdAt: newIncidentTime,
      updatedAt: newIncidentTime,
    } as any);

    _memoryMissionOffers.set(505, {
      id: 505,
      incidentId: 5,
      rescuerId,
      distanceKm: 0.9,
      matchScore: 980,
      status: "offered",
      offeredAt: newIncidentTime,
      expiresAt: new Date(Date.now() + 25_000),
      createdAt: newIncidentTime,
      updatedAt: newIncidentTime,
    } as any);

    const ctx = createRescuerContext(rescuerId, loginTime);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.rescue.rescuer.activeOffer();
    expect(result.hasOffer).toBe(true);
    expect(result.offer?.id).toBe(505);
    expect(result.incident?.publicCode).toBe("SOS-NEW0005");
    expect(result.incident?.locationLabel).toBe("Panbazar Overbridge");
    expect(result.incident?.peopleAffected).toBe(4);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Browser/page refresh after login -> old SOS still not eligible
  // -------------------------------------------------------------------------
  it("TEST 6: Browser/page refresh after login -> old SOS still not eligible, post-login SOS remains eligible", async () => {
    const rescuerId = 106;
    const loginTime = new Date("2026-09-04T10:15:00.000Z").getTime();

    // Create session token bound to loginTime
    const token = await sdk.createSessionToken(`rescuer-unit-${rescuerId}`, {
      name: "Officer Kalita",
      sessionStartedAt: loginTime,
    });

    // Old SOS from 10:10 (before login)
    _memoryIncidents.set(60, {
      id: 60,
      publicCode: "SOS-OLD0060",
      locationLabel: "Six Mile",
      latitude: 26.13,
      longitude: 91.80,
      emergencyType: "flood",
      severity: "high",
      createdAt: new Date("2026-09-04T10:10:00.000Z"),
      updatedAt: new Date("2026-09-04T10:10:00.000Z"),
    } as any);
    _memoryMissionOffers.set(600, {
      id: 600,
      incidentId: 60,
      rescuerId,
      status: "offered",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date("2026-09-04T10:10:00.000Z"),
    } as any);

    // Initial visit: old offer is rejected
    const ctxInitial = createRescuerContext(rescuerId, loginTime, token);
    const callerInitial = appRouter.createCaller(ctxInitial);
    const res1 = await callerInitial.rescue.rescuer.activeOffer();
    expect(res1.hasOffer).toBe(false);

    // Simulate page reload: creates fresh component context with same session token
    const ctxReload = createRescuerContext(rescuerId, loginTime, token);
    const callerReload = appRouter.createCaller(ctxReload);
    const resReload = await callerReload.rescue.rescuer.activeOffer();
    expect(resReload.hasOffer).toBe(false);

    // Now a NEW SOS arrives at 10:18 (after login)
    _memoryIncidents.set(61, {
      id: 61,
      publicCode: "SOS-NEW0061",
      locationLabel: "Beltola",
      latitude: 26.11,
      longitude: 91.79,
      emergencyType: "evacuation",
      severity: "critical",
      createdAt: new Date("2026-09-04T10:18:00.000Z"),
      updatedAt: new Date("2026-09-04T10:18:00.000Z"),
    } as any);
    _memoryMissionOffers.set(601, {
      id: 601,
      incidentId: 61,
      rescuerId,
      status: "offered",
      expiresAt: new Date(Date.now() + 30_000),
      createdAt: new Date("2026-09-04T10:18:00.000Z"),
    } as any);

    const resNew = await callerReload.rescue.rescuer.activeOffer();
    expect(resNew.hasOffer).toBe(true);
    expect(resNew.incident?.publicCode).toBe("SOS-NEW0061");
  });

  // -------------------------------------------------------------------------
  // TEST 7: Two responders with different session start times
  // -------------------------------------------------------------------------
  it("TEST 7: Two responders with different session start times -> eligibility evaluated independently per session", async () => {
    const rescuerAId = 201;
    const rescuerBId = 202;

    // Rescuer A logs in at 10:00
    const loginA = new Date("2026-09-04T10:00:00.000Z").getTime();
    setRescuerSessionStartedAt(rescuerAId, loginA);

    // SOS incident created at 10:05
    const incidentTime = new Date("2026-09-04T10:05:00.000Z");
    const incidentId = 7;
    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-MULTI007",
      locationLabel: "Ulubari",
      latitude: 26.17,
      longitude: 91.75,
      emergencyType: "flood",
      severity: "high",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    // Rescuer B logs in at 10:10 (AFTER the SOS was created)
    const loginB = new Date("2026-09-04T10:10:00.000Z").getTime();
    setRescuerSessionStartedAt(rescuerBId, loginB);

    // Dispatch broadcasted offers to both responders
    _memoryMissionOffers.set(701, {
      id: 701,
      incidentId,
      rescuerId: rescuerAId,
      status: "offered",
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: incidentTime,
    } as any);

    _memoryMissionOffers.set(702, {
      id: 702,
      incidentId,
      rescuerId: rescuerBId,
      status: "offered",
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: incidentTime,
    } as any);

    // Rescuer A: SOS (10:05) was created AFTER Rescuer A's login (10:00) -> ELIGIBLE
    const callerA = appRouter.createCaller(createRescuerContext(rescuerAId, loginA));
    const resultA = await callerA.rescue.rescuer.activeOffer();
    expect(resultA.hasOffer).toBe(true);
    expect(resultA.offer?.id).toBe(701);

    // Rescuer B: SOS (10:05) was created BEFORE Rescuer B's login (10:10) -> INELIGIBLE
    const callerB = appRouter.createCaller(createRescuerContext(rescuerBId, loginB));
    const resultB = await callerB.rescue.rescuer.activeOffer();
    expect(resultB.hasOffer).toBe(false);
    expect(resultB.offer).toBeNull();
  });

  // -------------------------------------------------------------------------
  // TEST 8: Do not alter normal accept/decline mutations
  // -------------------------------------------------------------------------
  it("TEST 8: Do not alter normal accept/decline mutations", async () => {
    const rescuerId = 108;
    const loginTime = new Date("2026-09-04T10:20:00.000Z").getTime();
    const incidentTime = new Date("2026-09-04T10:25:00.000Z");

    setRescuerSessionStartedAt(rescuerId, loginTime);

    _memoryUsers.set(String(rescuerId), {
      id: rescuerId,
      role: "rescuer",
      name: "Field Rescuer",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    _memoryRescueProfiles.set(rescuerId, {
      id: rescuerId,
      userId: rescuerId,
      callSign: "SDRF-Bravo",
      category: "ground-team",
      availability: "available",
      lastLatitude: 26.15,
      lastLongitude: 91.75,
    } as any);

    // Create eligible incident #8
    _memoryIncidents.set(8, {
      id: 8,
      publicCode: "SOS-MUT0008",
      locationLabel: "Chandmari",
      latitude: 26.19,
      longitude: 91.78,
      emergencyType: "medical",
      requestCategory: "medical",
      severity: "high",
      status: "pending",
      assignedRescuerId: null,
      dispatchStatus: "offered",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    _memoryMissionOffers.set(801, {
      id: 801,
      incidentId: 8,
      rescuerId,
      status: "offered",
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 30_000),
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    const ctx = createRescuerContext(rescuerId, loginTime);
    const caller = appRouter.createCaller(ctx);

    // Accept offer
    const acceptRes = await caller.rescue.rescuer.acceptMissionOffer({ offerId: 801 });
    expect(acceptRes.success).toBe(true);
    expect(acceptRes.missionId).toBeDefined();

    // Verify mission offer status updated to accepted
    const offer = _memoryMissionOffers.get(801);
    expect(offer?.status).toBe("accepted");

    // Create another eligible offer for decline test
    _memoryIncidents.set(9, {
      id: 9,
      publicCode: "SOS-MUT0009",
      locationLabel: "Silpukhuri",
      latitude: 26.19,
      longitude: 91.76,
      emergencyType: "flood",
      requestCategory: "rescue",
      severity: "medium",
      status: "pending",
      assignedRescuerId: null,
      dispatchStatus: "offered",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    _memoryMissionOffers.set(802, {
      id: 802,
      incidentId: 9,
      rescuerId,
      status: "offered",
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 30_000),
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    // Decline offer
    const declineRes = await caller.rescue.rescuer.declineMissionOffer({ offerId: 802 });
    expect(declineRes.success).toBe(true);
    const declinedOffer = _memoryMissionOffers.get(802);
    expect(declinedOffer?.status).toBe("declined");
  });
});
