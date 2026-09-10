import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({ incident: null as any }));

vi.mock("./rescue.db", () => ({
  getIncidentByCode: async () => state.incident,
  addIncidentEvent: async () => undefined,
  writeAudit: async () => undefined,
  getActiveAssignedRescuerForIncident: async () => null,
  getAnalytics: async () => ({}), getIncidentMessages: async () => [], getAvailableRescuersNear: async () => [], getIncidentById: async () => null, getIncidentTimeline: async () => [], getMapLayers: async () => ({}), listHospitals: async () => [], listRescuerRegistrationRequests: async () => [], getMissionForRescuer: async () => null, getRescuerProfile: async () => null, getRescuerRoster: async () => [], listIncidents: async () => [], listIncidentsForReporter: async () => [], listMissionsForRescuer: async () => [], listNotificationFeed: async () => [], unreadNotificationCount: async () => 0,
}));
vi.mock("./db", () => ({ getDb: async () => ({ update: () => ({ set: () => ({ where: async () => undefined }) }) }) }));

import { appRouter } from "./routers";

function contextFor(id: number): TrpcContext {
  const now = new Date();
  return { user: { id, openId: `victim-${id}`, name: "Victim", email: null, loginMethod: "test", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("post-alert details router access", () => {
  beforeEach(() => { state.incident = { id: 1, publicCode: "SOS-ABCDEFGH", reporterId: 5, status: "pending", peopleAffected: 1, emergencyType: "flood", helpNeeds: null, notes: null, contactName: "Victim" }; });

  it("returns active SOS details only to its reporting victim", async () => {
    const details = await appRouter.createCaller(contextFor(5)).rescue.emergency.myDetailsByCode({ publicCode: "SOS-ABCDEFGH" });
    expect(details.peopleAffected).toBe(1);
    await expect(appRouter.createCaller(contextFor(6)).rescue.emergency.myDetailsByCode({ publicCode: "SOS-ABCDEFGH" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks details views and updates once the SOS is resolved", async () => {
    state.incident.status = "resolved";
    const caller = appRouter.createCaller(contextFor(5));
    await expect(caller.rescue.emergency.myDetailsByCode({ publicCode: "SOS-ABCDEFGH" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.rescue.emergency.updateMyDetails({ publicCode: "SOS-ABCDEFGH", peopleAffected: 2, emergencyType: "medical", helpNeeds: "Medicine" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
