import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "rescuer" | "admin"): TrpcContext {
  const now = new Date();
  return {
    user: { id: 9, openId: `test-${role}`, name: "Test account", email: null, loginMethod: "test", role, createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("rescuer authorization", () => {
  it("rejects an ordinary user from responder-only configuration", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.rescue.rescuer.pushConfig()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });

  it("allows a rescuer to read their push configuration", async () => {
    const caller = appRouter.createCaller(contextFor("rescuer"));
    await expect(caller.rescue.rescuer.pushConfig()).resolves.toMatchObject({ enabled: expect.any(Boolean) });
  });

  it("rejects an ordinary user from rescuer profile, sharing-consent, and live-location mutations", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.rescue.rescuer.updateProfile({ phone: "+919999999999" })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
    await expect(caller.rescue.rescuer.setLocationSharing({ enabled: true })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
    await expect(caller.rescue.rescuer.updateLiveLocation({ latitude: 26.1445, longitude: 91.7362 })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });
});
