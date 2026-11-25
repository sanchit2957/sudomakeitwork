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
import { advanceIncidentDispatch } from "./dispatch/dispatch";
import type { TrpcContext } from "./_core/context";
import fs from "fs";
import path from "path";

function createCitizenContext(id: number): TrpcContext {
  const now = new Date();
  return {
    user: {
      id,
      openId: `citizen-user-${id}`,
      name: `Citizen ${id}`,
      email: `citizen${id}@test.org`,
      password: null,
      loginMethod: "test",
      role: "user",
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      codeVersion: 1,
    },
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as any,
    res: {
      cookie: () => {},
    } as any,
  };
}

function createRescuerContext(
  id: number,
  sessionStartedAt?: number
): TrpcContext {
  const now = new Date();
  return {
    user: {
      id,
      openId: `rescuer-unit-${id}`,
      name: `Rescuer ${id}`,
      email: `rescuer${id}@test.org`,
      password: null,
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
      headers: {},
      ip: "127.0.0.1",
    } as any,
    res: {
      cookie: () => {},
    } as any,
  };
}

describe("BLE Offline-to-Online SOS Reconciliation & Dispatch Pipeline", () => {
  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryMissionOffers.clear();
    _memoryMissions.clear();
    _memoryUsers.clear();
    _memoryRescueProfiles.clear();
    rescuerSessionStartRegistry.clear();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Offline BLE SOS enters dispatch pipeline immediately on sync
  // -------------------------------------------------------------------------
  it("TEST 1: Offline BLE SOS sync sets dispatchStatus 'matching' and advances dispatch immediately", async () => {
    const rescuerId = 201;
    const now = new Date();

    // Setup an available rescuer nearby
    _memoryUsers.set(String(rescuerId), {
      id: rescuerId,
      name: "Assam SDRF Boat 1",
      email: "sdrf1@assam.gov.in",
      role: "rescuer",
      status: "active",
      createdAt: now,
      updatedAt: now,
    } as any);

    _memoryRescueProfiles.set(rescuerId, {
      id: rescuerId,
      userId: rescuerId,
      callSign: "SDRF-01",
      category: "boat",
      phone: "+919876543210",
      photoKey: null,
      photoUrl: null,
      contactSharing: "yes",
      locationSharing: "yes",
      availability: "available",
      lastLatitude: 26.144,
      lastLongitude: 91.736,
      locationUpdatedAt: now,
      updatedAt: now,
    });

    const citizenCtx = createCitizenContext(101);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const bleBeaconId = "K8N2X9P1";
    const res = await citizenCaller.rescue.emergency.create({
      contactName: "Victim In Flood",
      locationLabel: "Near Bharalu River Bridge",
      latitude: 26.145,
      longitude: 91.737,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 3,
      bleBeaconId,
    });

    expect(res.incidentId).toBeDefined();
    expect(res.publicCode).toMatch(/^SOS-[A-Z0-9]{8}$/);

    const memIncident = _memoryIncidents.get(res.incidentId);
    expect(memIncident).toBeDefined();
    // Dispatch status should have moved to offered (since offers were dispatched) or matching, NOT stuck in triage_pending
    expect(["matching", "offered"]).toContain(memIncident!.dispatchStatus);
    expect(memIncident!.bleBeaconId).toBe(bleBeaconId);

    // An offer should have been automatically generated for the nearby rescuer
    const offers = Array.from(_memoryMissionOffers.values()).filter(
      (o) => o.incidentId === res.incidentId
    );
    expect(offers.length).toBeGreaterThanOrEqual(1);
    expect(offers[0].rescuerId).toBe(rescuerId);
    expect(offers[0].status).toBe("offered");
  });

  // -------------------------------------------------------------------------
  // TEST 2: Rescuer activeOffer exempts BLE incident from sessionStartedAt cutoff
  // -------------------------------------------------------------------------
  it("TEST 2: activeOffer returns offer for BLE incident even if rescuer session started after incident creation", async () => {
    const rescuerId = 202;
    // Rescuer logs in at 10:15
    const sessionTime = new Date("2026-09-04T10:15:00.000Z").getTime();
    setRescuerSessionStartedAt(rescuerId, sessionTime);

    // Citizen created SOS offline at 10:00 (15 mins earlier)
    const incidentTime = new Date("2026-09-04T10:00:00.000Z");
    const incidentId = 88;
    const bleBeaconId = "BLE77AA2";

    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-BLE00088",
      reporterId: 50,
      contactName: "Stranded Citizen",
      locationLabel: "Uzan Bazar Ghat",
      latitude: 26.19,
      longitude: 91.75,
      emergencyType: "flood",
      requestCategory: "emergency",
      severity: "critical",
      peopleAffected: 2,
      notes: "Trapped on roof",
      status: "pending",
      bleBeaconId,
      dispatchStatus: "matching",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    // Offer generated for rescuer
    const offerId = 901;
    _memoryMissionOffers.set(offerId, {
      id: offerId,
      incidentId,
      rescuerId,
      distanceKm: 1.2,
      matchScore: 900,
      status: "offered",
      offeredAt: new Date("2026-09-04T10:16:00.000Z"),
      expiresAt: new Date(Date.now() + 60_000), // unexpired
      createdAt: new Date("2026-09-04T10:16:00.000Z"),
      updatedAt: new Date("2026-09-04T10:16:00.000Z"),
    } as any);

    const rescuerCtx = createRescuerContext(rescuerId, sessionTime);
    const rescuerCaller = appRouter.createCaller(rescuerCtx);

    const active = await rescuerCaller.rescue.rescuer.activeOffer();
    expect(active.hasOffer).toBe(true);
    expect(active.offer).toBeDefined();
    expect(active.incident).toBeDefined();
    expect(active.incident?.publicCode).toBe("SOS-BLE00088");
    expect(active.incident?.bleBeaconId).toBe(bleBeaconId);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Rescuer offline acceptance before victim sync returns pending_victim_sync
  // -------------------------------------------------------------------------
  it("TEST 3: submitOfflineBleAcceptance returns pending_victim_sync if victim has not synced yet", async () => {
    const rescuerId = 203;
    const rescuerCtx = createRescuerContext(rescuerId);
    const rescuerCaller = appRouter.createCaller(rescuerCtx);

    const bleBeaconId = "UNSYNCED1";
    const res = await rescuerCaller.rescue.rescuer.submitOfflineBleAcceptance({
      bleBeaconId,
      acceptedAt: Date.now(),
      latitude: 26.14,
      longitude: 91.73,
    });

    expect(res.status).toBe("pending_victim_sync");
    expect(res.message).toContain("not yet received");
  });

  // -------------------------------------------------------------------------
  // TEST 4: Rescuer offline acceptance reconciled after victim sync assigns mission
  // -------------------------------------------------------------------------
  it("TEST 4: submitOfflineBleAcceptance reconciles and assigns mission after victim syncs", async () => {
    const rescuerId = 204;
    const now = new Date();

    _memoryUsers.set(String(rescuerId), {
      id: rescuerId,
      name: "Rescuer 204",
      email: "r204@test.org",
      role: "rescuer",
      status: "active",
      createdAt: now,
      updatedAt: now,
    } as any);

    _memoryRescueProfiles.set(rescuerId, {
      id: rescuerId,
      userId: rescuerId,
      callSign: "Bravo-4",
      category: "boat",
      phone: "+919876543299",
      photoKey: null,
      photoUrl: null,
      contactSharing: "yes",
      locationSharing: "yes",
      availability: "available",
      lastLatitude: 26.14,
      lastLongitude: 91.73,
      locationUpdatedAt: now,
      updatedAt: now,
    });

    const bleBeaconId = "RECONCILE9";

    // 1. Citizen syncs offline SOS
    const citizenCtx = createCitizenContext(102);
    const citizenCaller = appRouter.createCaller(citizenCtx);
    const created = await citizenCaller.rescue.emergency.create({
      contactName: "Victim Reconcile",
      locationLabel: "Guwahati Club",
      latitude: 26.18,
      longitude: 91.76,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 1,
      bleBeaconId,
    });

    expect(created.publicCode).toBeDefined();

    // 2. Rescuer submits offline acceptance
    const rescuerCtx = createRescuerContext(rescuerId);
    const rescuerCaller = appRouter.createCaller(rescuerCtx);
    const acceptRes = await rescuerCaller.rescue.rescuer.submitOfflineBleAcceptance({
      bleBeaconId,
      acceptedAt: Date.now(),
      latitude: 26.179,
      longitude: 91.759,
    });

    expect(acceptRes.status).toBe("assigned");
    expect(acceptRes.publicCode).toBe(created.publicCode);

    // Verify incident assigned in DB
    const inc = _memoryIncidents.get(created.incidentId);
    expect(inc?.assignedRescuerId).toBe(rescuerId);
    expect(inc?.status).toBe("dispatched");

    // 3. Submitting again by the same rescuer is idempotent
    const repeatRes = await rescuerCaller.rescue.rescuer.submitOfflineBleAcceptance({
      bleBeaconId,
    });
    expect(repeatRes.status).toBe("assigned");
    expect(repeatRes.message).toContain("already confirmed");
  });

  // -------------------------------------------------------------------------
  // TEST 5: Transient responder availability error returns retryable_error, not conflict
  // -------------------------------------------------------------------------
  it("TEST 5: Transient availability error returns retryable_error so client retries instead of failing", async () => {
    const rescuerId = 205;
    const now = new Date();

    _memoryUsers.set(String(rescuerId), {
      id: rescuerId,
      name: "Rescuer 205",
      email: "r205@test.org",
      role: "rescuer",
      status: "active",
      createdAt: now,
      updatedAt: now,
    } as any);

    // Rescuer profile is temporarily off_duty
    _memoryRescueProfiles.set(rescuerId, {
      id: rescuerId,
      userId: rescuerId,
      callSign: "Bravo-5",
      category: "boat",
      phone: "+919876543298",
      photoKey: null,
      photoUrl: null,
      contactSharing: "yes",
      locationSharing: "yes",
      availability: "off_duty", // not available!
      lastLatitude: 26.14,
      lastLongitude: 91.73,
      locationUpdatedAt: now,
      updatedAt: now,
    });

    const bleBeaconId = "TRANSIENT1";
    const citizenCtx = createCitizenContext(103);
    const citizenCaller = appRouter.createCaller(citizenCtx);
    await citizenCaller.rescue.emergency.create({
      contactName: "Victim Transient",
      locationLabel: "Paltan Bazar",
      latitude: 26.17,
      longitude: 91.75,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 1,
      bleBeaconId,
    });

    const rescuerCtx = createRescuerContext(rescuerId);
    const rescuerCaller = appRouter.createCaller(rescuerCtx);
    const res = await rescuerCaller.rescue.rescuer.submitOfflineBleAcceptance({
      bleBeaconId,
    });

    // Must be retryable_error, NEVER conflict!
    expect(res.status).toBe("retryable_error");
  });

  // -------------------------------------------------------------------------
  // TEST 6: Genuine conflict (already assigned to another rescuer)
  // -------------------------------------------------------------------------
  it("TEST 6: Competing assignment to another rescuer correctly returns conflict", async () => {
    const rescuerA = 206;
    const rescuerB = 207;
    const now = new Date();

    const bleBeaconId = "RACE_CONFLICT";
    const incidentId = 99;

    // Incident already assigned to rescuerA
    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-ASSIGNED1",
      reporterId: 55,
      contactName: "Victim",
      locationLabel: "Six Mile",
      latitude: 26.13,
      longitude: 91.80,
      emergencyType: "flood",
      requestCategory: "emergency",
      severity: "high",
      peopleAffected: 2,
      status: "dispatched",
      assignedRescuerId: rescuerA, // already assigned to A
      bleBeaconId,
      createdAt: now,
      updatedAt: now,
    } as any);

    // Rescuer B attempts to reconcile
    const rescuerBCtx = createRescuerContext(rescuerB);
    const rescuerBCaller = appRouter.createCaller(rescuerBCtx);
    const res = await rescuerBCaller.rescue.rescuer.submitOfflineBleAcceptance({
      bleBeaconId,
    });

    expect(res.status).toBe("conflict");
    expect(res.message).toContain("already assigned to another responder");
  });

  // -------------------------------------------------------------------------
  // TEST 7: Victim original GPS coordinates are strictly preserved
  // -------------------------------------------------------------------------
  it("TEST 7: Original victim GPS coordinates remain the emergency destination", async () => {
    const citizenCtx = createCitizenContext(104);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const victimLat = 26.14567;
    const victimLng = 91.73456;
    const bleBeaconId = "PRESERVE_GPS";

    const created = await citizenCaller.rescue.emergency.create({
      contactName: "GPS Test Citizen",
      locationLabel: "Original Spot",
      latitude: victimLat,
      longitude: victimLng,
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 1,
      bleBeaconId,
    });

    const inc = _memoryIncidents.get(created.incidentId);
    expect(inc?.latitude).toBe(victimLat);
    expect(inc?.longitude).toBe(victimLng);
  });

  // -------------------------------------------------------------------------
  // TEST 8: Idempotent victim sync does not create duplicate incidents
  // -------------------------------------------------------------------------
  it("TEST 8: Repeated offline sync with same bleBeaconId returns existing incident", async () => {
    const citizenCtx = createCitizenContext(105);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const bleBeaconId = "IDEMPOTENT_BLE";
    const first = await citizenCaller.rescue.emergency.create({
      contactName: "Duplicate Test",
      locationLabel: "Zone 4",
      latitude: 26.15,
      longitude: 91.74,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 1,
      bleBeaconId,
    });

    const second = await citizenCaller.rescue.emergency.create({
      contactName: "Duplicate Test",
      locationLabel: "Zone 4",
      latitude: 26.15,
      longitude: 91.74,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 1,
      bleBeaconId,
    });

    expect(second.incidentId).toBe(first.incidentId);
    expect(second.publicCode).toBe(first.publicCode);
  });

  // -------------------------------------------------------------------------
  // TEST 9: Normal online SOS without BLE follows 10s triage wait
  // -------------------------------------------------------------------------
  it("TEST 9: Standard SOS without BLE sets triage_pending", async () => {
    const citizenCtx = createCitizenContext(106);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const created = await citizenCaller.rescue.emergency.create({
      contactName: "Normal Citizen",
      locationLabel: "Normal Location",
      latitude: 26.16,
      longitude: 91.75,
      emergencyType: "medical",
      severity: "medium",
      peopleAffected: 1,
    });

    const inc = _memoryIncidents.get(created.incidentId);
    expect(inc?.dispatchStatus).toBe("triage_pending");
    expect(inc?.bleBeaconId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // TEST 10: Service Worker and client IndexedDB name alignment
  // -------------------------------------------------------------------------
  it("TEST 10: Service worker and client offline SOS DB name are identical", () => {
    const swPath = path.resolve(__dirname, "../client/public/sw.js");
    const swContent = fs.readFileSync(swPath, "utf-8");
    expect(swContent).toContain('const DB_NAME = "sudo-makeitwork-sos";');
  });
});
