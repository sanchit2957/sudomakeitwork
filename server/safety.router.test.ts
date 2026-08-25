import { describe, expect, it, beforeEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  queueRows: [] as Array<{ id: number; category: "shelter" | "food" | "medical" | "protection"; peopleAffected: number; details: string | null; latitude: number; longitude: number; status: "new" | "acknowledged" | "resolved"; createdAt: Date; requesterName: string | null }>,
  ownerRows: [] as Array<{ id: number; requesterId: number; category: "shelter" | "food" | "medical" | "protection"; peopleAffected: number; details: string | null; latitude: number; longitude: number; status: "new" | "acknowledged" | "resolved"; reviewedBy: number | null; reviewedAt: Date | null; createdAt: Date; updatedAt: Date }>,
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: (condition: unknown) => ({ orderBy: () => condition ? state.queueRows.filter(row => row.category === "medical") : state.queueRows }),
        }),
        where: () => ({ orderBy: () => state.ownerRows }),
      }),
    }),
  }),
}));

import { appRouter } from "./routers";

function contextFor(role: "user" | "rescuer" | "medical" | "admin", id: number): TrpcContext {
  const now = new Date();
  return { user: { id, openId: `test-${id}`, name: "Safety test", email: null, loginMethod: "test", role, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const queueSeed = [
  { id: 1, category: "medical" as const, peopleAffected: 1, details: "Insulin needed", latitude: 26.1, longitude: 91.7, status: "new" as const, createdAt: new Date(), requesterName: "Asha" },
  { id: 2, category: "shelter" as const, peopleAffected: 4, details: "Dry place needed", latitude: 26.2, longitude: 91.8, status: "new" as const, createdAt: new Date(), requesterName: "Bina" },
];

describe("Safety router access scope", () => {
  beforeEach(() => { state.queueRows = [...queueSeed]; state.ownerRows = []; });

  it("returns only medical-category requests for medical staff and all categories for government and field responders", async () => {
    const medical = await appRouter.createCaller(contextFor("medical", 10)).rescue.safety.queue();
    const admin = await appRouter.createCaller(contextFor("admin", 11)).rescue.safety.queue();
    const rescuer = await appRouter.createCaller(contextFor("rescuer", 12)).rescue.safety.queue();
    expect(medical.map(row => row.category)).toEqual(["medical"]);
    expect(admin.map(row => row.category)).toEqual(["medical", "shelter"]);
    expect(rescuer.map(row => row.category)).toEqual(["medical", "shelter"]);
  });

  it("returns only requester-owned rows from the victim view, while an operations account sees no other victim rows there", async () => {
    const now = new Date();
    state.ownerRows = [
      { id: 1, requesterId: 21, category: "food", peopleAffected: 2, details: null, latitude: 26.1, longitude: 91.7, status: "new", reviewedBy: null, reviewedAt: null, createdAt: now, updatedAt: now },
      { id: 2, requesterId: 99, category: "shelter", peopleAffected: 1, details: null, latitude: 26.2, longitude: 91.8, status: "new", reviewedBy: null, reviewedAt: null, createdAt: now, updatedAt: now },
    ];
    const victimRows = await appRouter.createCaller(contextFor("user", 21)).rescue.safety.mine();
    const operationsRows = await appRouter.createCaller(contextFor("admin", 77)).rescue.safety.mine();
    expect(victimRows.map(row => row.id)).toEqual([1]);
    expect(operationsRows).toEqual([]);
  });
});
