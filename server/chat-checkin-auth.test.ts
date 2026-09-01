/**
 * CHAT & POST-RESCUE CHECK-IN IDOR & AUTHORIZATION TESTS
 * Verifies that:
 * 1. Unrelated users cannot view another victim's private chat
 * 2. Unrelated users cannot post into another victim's private chat
 * 3. Post-rescue check-in requires authorization
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { _memoryIncidents, _memoryIncidentMessages } from "./rescue.db";

describe("Incident Chat & Post-Rescue Check-In IDOR Security", () => {
  const victimUser: any = { id: 501, name: "Citizen Victim", role: "user", openId: "usr-501" };
  const attackerUser: any = { id: 999, name: "Attacker User", role: "user", openId: "usr-999" };
  const rescuerUser: any = { id: 701, name: "Assigned Rescuer", role: "rescuer", openId: "res-701" };
  const adminUser: any = { id: 101, name: "Admin Operations", role: "admin", openId: "adm-101" };

  const incidentCode = "SOS-PRIVTES1";
  const incidentId = 8801;

  _memoryIncidents.set(incidentId, {
    id: incidentId,
    publicCode: incidentCode,
    reporterId: 501,
    locationLabel: "Guwahati Riverside",
    latitude: 26.18,
    longitude: 91.74,
    emergencyType: "flood",
    severity: "critical",
    status: "dispatched",
    requestCategory: "rescue",
    dispatchStatus: "dispatched",
    assignedRescuerId: 701,
    destinationHospitalId: null,
    destinationHospitalName: null,
    triageStartedAt: new Date(),
    triageDeadlineAt: new Date(),
    triageSelectedAt: new Date(),
    matchingStartedAt: new Date(),
    matchingAttempts: 1,
    escalatedToCommandAt: null,
    dispatchedAt: new Date(),
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    peopleAffected: 2,
    helpNeeds: null,
    notes: null,
    contactName: null,
    evidenceKey: null,
    evidenceUrl: null,
    voiceNoteKey: null,
    voiceNoteUrl: null,
    voiceNoteDurationSeconds: null,
  });

  _memoryIncidentMessages.push({
    id: 1,
    incidentId,
    authorId: 501,
    authorType: "victim",
    message: "Water is rising fast on our ground floor!",
    createdAt: new Date(),
  });

  it("permits the incident reporter to view their private chat", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: victimUser });
    const messages = await caller.rescue.emergency.chatByCode({ publicCode: incidentCode });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].message).toContain("Water is rising fast");
  });

  it("permits the assigned rescuer to view the incident chat", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: rescuerUser });
    const messages = await caller.rescue.emergency.chatByCode({ publicCode: incidentCode });
    expect(messages.length).toBeGreaterThan(0);
  });

  it("permits admin operations to view the incident chat", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: adminUser });
    const messages = await caller.rescue.emergency.chatByCode({ publicCode: incidentCode });
    expect(messages.length).toBeGreaterThan(0);
  });

  it("strictly hides private chat messages from an unrelated user (IDOR protection)", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: attackerUser });
    const messages = await caller.rescue.emergency.chatByCode({ publicCode: incidentCode });
    expect(messages).toEqual([]);
  });

  it("rejects message posts from an unrelated user into another victim's incident", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: attackerUser });
    await expect(
      caller.rescue.emergency.sendChat({
        publicCode: incidentCode,
        message: "Malicious inject attempt",
      })
    ).rejects.toThrow("Only the SOS reporter, assigned rescuer, or State Command Centre can send incident messages.");
  });

  it("rejects post-rescue check-in from an unrelated unauthorized user", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: attackerUser });
    await expect(
      caller.rescue.emergency.submitPostRescueCheckIn({
        publicCode: incidentCode,
        reliefCentreAllotted: "no",
        helpCategory: "medical",
      })
    ).rejects.toThrow("Only the SOS reporter or response personnel can submit a check-in.");
  });
});
