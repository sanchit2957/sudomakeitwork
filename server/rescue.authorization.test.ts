import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "rescuer" | "medical" | "admin"): TrpcContext {
  const now = new Date();
  return {
    user: { id: 9, openId: `test-${role}`, name: "Test account", email: null, loginMethod: "test", role, createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function anonymousContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("rescuer authorization", () => {
  it("requires sign-in before a rapid SOS can be created", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.rescue.emergency.create({ locationLabel: "Verified location", latitude: 26.1445, longitude: 91.7362, emergencyType: "flood", severity: "high", peopleAffected: 1 })).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });
  });

  it("rejects an authenticated rapid SOS outside Assam before it can be persisted", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.rescue.emergency.create({ locationLabel: "Shillong test point", latitude: 25.5788, longitude: 91.8933, emergencyType: "flood", severity: "high", peopleAffected: 1 })).rejects.toMatchObject<Partial<TRPCError>>({ code: "BAD_REQUEST", message: "Locations must be inside Assam. Please select or share a location within Assam." });
  });

  it("requires sign-in for a safety-assistance request and operations access for its response queue", async () => {
    const anonymous = appRouter.createCaller(anonymousContext());
    await expect(anonymous.rescue.safety.createRequest({ category: "medical", peopleAffected: 1, latitude: 26.1445, longitude: 91.7362 })).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });
    const victim = appRouter.createCaller(contextFor("user"));
    await expect(victim.rescue.safety.queue()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });

  it("rejects out-of-Assam Safety assistance coordinates before a request is persisted", async () => {
    const victim = appRouter.createCaller(contextFor("user"));
    await expect(victim.rescue.safety.createRequest({ category: "medical", peopleAffected: 1, latitude: 25.5788, longitude: 91.8933 })).rejects.toMatchObject<Partial<TRPCError>>({ code: "BAD_REQUEST", message: "Locations must be inside Assam. Please select or share a location within Assam." });
  });

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

  it("rejects medical staff from field-rescuer controls", async () => {
    const caller = appRouter.createCaller(contextFor("medical"));
    await expect(caller.rescue.rescuer.pushConfig()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
    await expect(caller.rescue.rescuer.setLocationSharing({ enabled: true })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });
});
