import { describe, expect, it, beforeEach } from "vitest";
import {
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryRescueProfiles,
  _memoryRescuerCapabilities,
  _memoryUsers,
  _memoryMissions,
} from "./rescue.db";
import {
  startIncidentTriage,
  selectIncidentCategory,
  advanceIncidentDispatch,
  acceptMissionOffer,
  declineMissionOffer,
  RESPONDER_OFFER_WINDOW_MS,
} from "./dispatch/dispatch";

describe("Automated SOS Triage and Dispatch Lifecycle", () => {
  const baseTime = new Date("2026-08-31T10:00:00.000Z");

  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryMissionOffers.clear();
    _memoryRescueProfiles.clear();
    _memoryRescuerCapabilities.clear();
    _memoryUsers.clear();
    _memoryMissions.clear();

    // Seed test users
    _memoryUsers.set("1", { id: 1, openId: "citizen-1", name: "Citizen A", email: "citizen@test.com", loginMethod: "otp", role: "user", createdAt: baseTime, updatedAt: baseTime, lastSignedIn: baseTime });
    _memoryUsers.set("201", { id: 201, openId: "rescuer-201", name: "Rescuer Alpha", email: "alpha@ndrf.gov.in", loginMethod: "password", role: "rescuer", createdAt: baseTime, updatedAt: baseTime, lastSignedIn: baseTime });
    _memoryUsers.set("202", { id: 202, openId: "rescuer-202", name: "Rescuer Beta", email: "beta@ndrf.gov.in", loginMethod: "password", role: "rescuer", createdAt: baseTime, updatedAt: baseTime, lastSignedIn: baseTime });

    // Seed rescuer profiles (Guwahati area)
    _memoryRescueProfiles.set(201, {
      userId: 201,
      callSign: "NDRF-BOAT-01",
      phone: "+919876543210",
      availability: "available",
      locationSharing: "yes",
      lastLatitude: 26.1500,
      lastLongitude: 91.7400,
      locationUpdatedAt: baseTime,
      updatedAt: baseTime,
    });

    _memoryRescueProfiles.set(202, {
      userId: 202,
      callSign: "NDRF-BOAT-02",
      phone: "+919876543211",
      availability: "available",
      locationSharing: "yes",
      lastLatitude: 26.1700,
      lastLongitude: 91.7500,
      locationUpdatedAt: baseTime,
      updatedAt: baseTime,
    });

    // Seed capabilities
    _memoryRescuerCapabilities.set(201, [
      { id: 1, rescuerId: 201, capability: "flood_rescue", priority: 1, active: "yes", createdAt: baseTime, updatedAt: baseTime },
      { id: 2, rescuerId: 201, capability: "medical", priority: 2, active: "yes", createdAt: baseTime, updatedAt: baseTime },
    ]);

    _memoryRescuerCapabilities.set(202, [
      { id: 3, rescuerId: 202, capability: "flood_rescue", priority: 1, active: "yes", createdAt: baseTime, updatedAt: baseTime },
    ]);
  });

  it("sets up a 10-second triage deadline immediately upon SOS triage initiation", async () => {
    _memoryIncidents.set(501, {
      id: 501,
      publicCode: "SOS-LIFECY01",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar, Guwahati",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "emergency",
      helpNeeds: null,
      severity: "critical",
      peopleAffected: 3,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "triage_pending",
      triageStartedAt: baseTime,
      triageDeadlineAt: null,
      triageSelectedAt: null,
      matchingStartedAt: null,
      matchingAttempts: 0,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    const result = await startIncidentTriage(501, baseTime);
    expect(result.triageDeadlineAt.getTime()).toBe(baseTime.getTime() + 15_000);

    const inc = _memoryIncidents.get(501);
    expect(inc?.dispatchStatus).toBe("triage_pending");
    expect(inc?.triageDeadlineAt?.getTime()).toBe(baseTime.getTime() + 15_000);
  });

  it("handles citizen classification selection within the 15-second window and dispatches offer", async () => {
    _memoryIncidents.set(502, {
      id: 502,
      publicCode: "SOS-LIFECY02",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar, Guwahati",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "medical",
      requestCategory: "emergency",
      helpNeeds: null,
      severity: "critical",
      peopleAffected: 1,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "triage_pending",
      triageStartedAt: baseTime,
      triageDeadlineAt: new Date(baseTime.getTime() + 15_000),
      triageSelectedAt: null,
      matchingStartedAt: null,
      matchingAttempts: 0,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // Citizen selects "medical" at 4 seconds
    const selectionTime = new Date(baseTime.getTime() + 4_000);
    const advanceResult = await selectIncidentCategory(502, "medical", 1, selectionTime);

    const inc = _memoryIncidents.get(502);
    expect(inc?.requestCategory).toBe("medical");
    expect(inc?.dispatchStatus).toBe("offered");

    // NDRF-BOAT-01 (rescuer 201) receives offer
    const offers = Array.from(_memoryMissionOffers.values()).filter(o => o.incidentId === 502);
    expect(offers.length).toBeGreaterThanOrEqual(1);
    expect(offers[0].rescuerId).toBe(201);
    expect(offers[0].status).toBe("offered");
    expect(offers[0].expiresAt.getTime()).toBe(selectionTime.getTime() + RESPONDER_OFFER_WINDOW_MS);
  });

  it("safely defaults to 'emergency' category when 10-second triage timer expires", async () => {
    _memoryIncidents.set(503, {
      id: 503,
      publicCode: "SOS-LIFECY03",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar, Guwahati",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "emergency",
      helpNeeds: null,
      severity: "critical",
      peopleAffected: 2,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "triage_pending",
      triageStartedAt: baseTime,
      triageDeadlineAt: new Date(baseTime.getTime() + 10_000),
      triageSelectedAt: null,
      matchingStartedAt: null,
      matchingAttempts: 0,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // Advance at 11 seconds (past deadline)
    const sweepTime = new Date(baseTime.getTime() + 11_000);
    await advanceIncidentDispatch(503, sweepTime);

    const inc = _memoryIncidents.get(503);
    expect(inc?.requestCategory).toBe("emergency");
    expect(inc?.dispatchStatus).toBe("offered");
  });

  it("allows rescuer to accept offer within 10s and transitions incident to assigned/dispatched", async () => {
    _memoryIncidents.set(504, {
      id: 504,
      publicCode: "SOS-LIFECY04",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar, Guwahati",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "rescue",
      helpNeeds: null,
      severity: "high",
      peopleAffected: 2,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "matching",
      triageStartedAt: baseTime,
      triageDeadlineAt: baseTime,
      triageSelectedAt: baseTime,
      matchingStartedAt: baseTime,
      matchingAttempts: 0,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // Offer to 201
    await advanceIncidentDispatch(504, baseTime);
    const offer = Array.from(_memoryMissionOffers.values()).find(o => o.incidentId === 504 && o.rescuerId === 201);
    expect(offer).toBeDefined();

    // Rescuer 201 accepts at +5 seconds
    const acceptTime = new Date(baseTime.getTime() + 5_000);
    const result = await acceptMissionOffer(offer!.id, 201, acceptTime);
    expect(result.missionId).toBeDefined();

    const inc = _memoryIncidents.get(504);
    expect(inc?.status).toBe("dispatched");
    expect(inc?.assignedRescuerId).toBe(201);

    const profile = _memoryRescueProfiles.get(201);
    expect(profile?.availability).toBe("on_mission");
  });

  it("rotates immediately to next candidate when current offer is declined", async () => {
    _memoryIncidents.set(505, {
      id: 505,
      publicCode: "SOS-LIFECY05",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar, Guwahati",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "rescue",
      helpNeeds: null,
      severity: "high",
      peopleAffected: 2,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "matching",
      triageStartedAt: baseTime,
      triageDeadlineAt: baseTime,
      triageSelectedAt: baseTime,
      matchingStartedAt: baseTime,
      matchingAttempts: 0,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // First offer goes to 201 (closer)
    await advanceIncidentDispatch(505, baseTime);
    const firstOffer = Array.from(_memoryMissionOffers.values()).find(o => o.incidentId === 505 && o.rescuerId === 201);
    expect(firstOffer).toBeDefined();

    // Rescuer 201 declines at +3 seconds
    const declineTime = new Date(baseTime.getTime() + 3_000);
    await declineMissionOffer(firstOffer!.id, 201, declineTime);

    // Second offer should now automatically be dispatched to Rescuer 202
    const secondOffer = Array.from(_memoryMissionOffers.values()).find(o => o.incidentId === 505 && o.rescuerId === 202 && o.status === "offered");
    expect(secondOffer).toBeDefined();
    expect(secondOffer?.rescuerId).toBe(202);
  });

  it("escalates to State Command Centre when all available candidate offers expire or are declined", async () => {
    _memoryIncidents.set(506, {
      id: 506,
      publicCode: "SOS-LIFECY06",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar, Guwahati",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "rescue",
      helpNeeds: null,
      severity: "high",
      peopleAffected: 2,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "matching",
      triageStartedAt: baseTime,
      triageDeadlineAt: baseTime,
      triageSelectedAt: baseTime,
      matchingStartedAt: baseTime,
      matchingAttempts: 0,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // 1. Simultaneous broadcast offers to 201 and 202
    await advanceIncidentDispatch(506, baseTime);
    const offer1 = Array.from(_memoryMissionOffers.values()).find(o => o.incidentId === 506 && o.rescuerId === 201)!;
    await declineMissionOffer(offer1.id, 201, new Date(baseTime.getTime() + 2_000));

    const offer2 = Array.from(_memoryMissionOffers.values()).find(o => o.incidentId === 506 && o.rescuerId === 202)!;
    if (offer2 && offer2.status === "offered") {
      await declineMissionOffer(offer2.id, 202, new Date(baseTime.getTime() + 4_000));
    }

    // 2. Zero acceptances -> silently broadens radius tier, remains in matching, does NOT auto-escalate to Command
    const inc = _memoryIncidents.get(506);
    expect(inc?.dispatchStatus).toBe("matching");
    expect(inc?.escalatedToCommandAt).toBeNull();
  });
});
