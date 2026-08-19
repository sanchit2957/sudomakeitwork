import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

const { appRouter } = await import("./routers");

function adminContext(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 700001, openId: "approval-test-admin", name: "Test administrator", email: null, loginMethod: "test", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("administrator rescuer-registration approval", () => {
  it("approves a pending request, assigns the rescuer role, and creates the field profile", async () => {
    const updates: Array<{ values: Record<string, unknown> }> = [];
    const inserts: Array<{ values: Record<string, unknown> }> = [];
    let selectCall = 0;
    const pendingRequest = { id: 73, userId: 700002, phone: "7000000000", status: "pending" };
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCall += 1;
              return selectCall === 1 ? [pendingRequest] : [];
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updates.push({ values });
          return { where: async () => undefined };
        },
      }),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          inserts.push({ values });
          return undefined;
        },
      }),
    };
    mocks.getDb.mockResolvedValue(fakeDb);

    const caller = appRouter.createCaller(adminContext());
    await expect(caller.rescue.operations.reviewRescuerRegistration({ requestId: 73, decision: "approved", callSign: "TEST-RESQ" })).resolves.toEqual({ success: true });

    expect(updates.map(entry => entry.values)).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "approved", reviewedBy: 700001 }),
      expect.objectContaining({ role: "rescuer" }),
    ]));
    expect(inserts.map(entry => entry.values)).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 700002, callSign: "TEST-RESQ", phone: "7000000000", availability: "available" }),
    ]));
  });
});
