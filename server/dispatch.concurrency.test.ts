import { describe, expect, it, beforeEach } from "vitest";
import {
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryRescueProfiles,
  _memoryUsers,
  _memoryMissions,
  assignMissionAtomically,
} from "./rescue.db";
import { acceptMissionOffer, declineMissionOffer } from "./dispatch/dispatch";

describe("Automated Dispatch Concurrency & Security Rules", () => {
  const baseTime = new Date("2026-08-31T12:00:00.000Z");

  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryMissionOffers.clear();
    _memoryRescueProfiles.clear();
    _memoryUsers.clear();
    _memoryMissions.clear();

    _memoryUsers.set("1", { id: 1, openId: "citizen-1", name: "Citizen A", email: "citizen@test.com", loginMethod: "otp", role: "user", createdAt: baseTime, updatedAt: baseTime, lastSignedIn: baseTime });
    _memoryUsers.set("301", { id: 301, openId: "rescuer-301", name: "Unit 301", email: "301@gov.in", loginMethod: "password", role: "rescuer", createdAt: baseTime, updatedAt: baseTime, lastSignedIn: baseTime });
    _memoryUsers.set("302", { id: 302, openId: "rescuer-302", name: "Unit 302", email: "302@gov.in", loginMethod: "password", role: "rescuer", createdAt: baseTime, updatedAt: baseTime, lastSignedIn: baseTime });

    _memoryRescueProfiles.set(301, {
      userId: 301,
      callSign: "UNIT-301",
      phone: "+919876543201",
      availability: "available",
      locationSharing: "yes",
      lastLatitude: 26.15,
      lastLongitude: 91.74,
      locationUpdatedAt: baseTime,
      updatedAt: baseTime,
    });

    _memoryRescueProfiles.set(302, {
      userId: 302,
      callSign: "UNIT-302",
      phone: "+919876543202",
      availability: "available",
      locationSharing: "yes",
      lastLatitude: 26.16,
      lastLongitude: 91.75,
      locationUpdatedAt: baseTime,
      updatedAt: baseTime,
    });
  });

  it("prevents double-dispatch and ensures single-responder assignment under race conditions", async () => {
    _memoryIncidents.set(601, {
      id: 601,
      publicCode: "SOS-RACE01",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "rescue",
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
      dispatchStatus: "offered",
      triageStartedAt: baseTime,
      triageDeadlineAt: baseTime,
      triageSelectedAt: baseTime,
      matchingStartedAt: baseTime,
      matchingAttempts: 1,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // Simulate two concurrent assignment calls
    const p1 = assignMissionAtomically({ incidentId: 601, rescuerId: 301, assignedBy: 301 });
    const p2 = assignMissionAtomically({ incidentId: 601, rescuerId: 302, assignedBy: 302 });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const inc = _memoryIncidents.get(601);
    expect(inc?.status).toBe("dispatched");
    expect([301, 302]).toContain(inc?.assignedRescuerId);
  });

  it("rejects offer acceptance if the 10-second offer window has expired", async () => {
    _memoryIncidents.set(602, {
      id: 602,
      publicCode: "SOS-EXP01",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "rescue",
      helpNeeds: null,
      severity: "high",
      peopleAffected: 1,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      dispatchStatus: "offered",
      triageStartedAt: baseTime,
      triageDeadlineAt: baseTime,
      triageSelectedAt: baseTime,
      matchingStartedAt: baseTime,
      matchingAttempts: 1,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    _memoryMissionOffers.set(801, {
      id: 801,
      incidentId: 602,
      rescuerId: 301,
      distanceKm: 1.2,
      matchScore: 950,
      status: "offered",
      offeredAt: baseTime,
      expiresAt: new Date(baseTime.getTime() + 10_000),
      respondedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // Attempt to accept at 12 seconds (after expiration)
    const lateTime = new Date(baseTime.getTime() + 12_000);
    await expect(acceptMissionOffer(801, 301, lateTime)).rejects.toThrow("Offer has expired");
  });

  it("rejects offer acceptance if attempted by a different rescuer", async () => {
    _memoryIncidents.set(603, {
      id: 603,
      publicCode: "SOS-AUTH01",
      reporterId: 1,
      contactName: "Citizen A",
      locationLabel: "Panbazar",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "medical",
      requestCategory: "medical",
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
      dispatchStatus: "offered",
      triageStartedAt: baseTime,
      triageDeadlineAt: baseTime,
      triageSelectedAt: baseTime,
      matchingStartedAt: baseTime,
      matchingAttempts: 1,
      escalatedToCommandAt: null,
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    _memoryMissionOffers.set(802, {
      id: 802,
      incidentId: 603,
      rescuerId: 301,
      distanceKm: 1.0,
      matchScore: 1000,
      status: "offered",
      offeredAt: baseTime,
      expiresAt: new Date(baseTime.getTime() + 10_000),
      respondedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    });

    // Rescuer 302 tries to accept Rescuer 301's offer
    await expect(acceptMissionOffer(802, 302, new Date(baseTime.getTime() + 2_000))).rejects.toThrow(
      "You are not authorized to accept this offer"
    );
  });
});
