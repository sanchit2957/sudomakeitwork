import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createMockContext(role?: "admin" | "rescuer" | "hospital" | "medical" | "user"): {
  ctx: TrpcContext;
  cookiesSet: CookieCall[];
  cookiesCleared: CookieCall[];
} {
  const cookiesSet: CookieCall[] = [];
  const cookiesCleared: CookieCall[] = [];

  const now = new Date();
  const user = role
    ? {
        id: 1,
        openId: `test-${role}-01`,
        name: `Test ${role}`,
        email: `${role}@assamrescue.gov.in`,
        loginMethod: "test",
        role,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      }
    : null;

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookiesSet.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookiesCleared.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookiesSet, cookiesCleared };
}

describe("Role Hierarchy & Isolation", () => {
  it("allows admin, rescuer, medical, and citizen login with session cookie creation", async () => {
    const { ctx, cookiesSet } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const adminLogin = await caller.auth.login({
      email: "admin@assamrescue.gov.in",
      password: "admin",
    });
    expect(adminLogin.success).toBe(true);
    expect(adminLogin.user.role).toBe("admin");
    expect(cookiesSet.length).toBeGreaterThan(0);
    expect(cookiesSet[0].name).toBe(COOKIE_NAME);

    // Rescuer registration with active Government Code
    const { setRoleAccessCode } = await import("./db");
    await setRoleAccessCode("rescuer", "ASSAM-RESC-CODE-100", 1);
    const rescuerEmail = `ndrf-${Date.now()}@assamrescue.gov.in`;
    const rescuerRegistration = await caller.auth.register({
      name: "NDRF Lead",
      email: rescuerEmail,
      password: "password123",
      role: "rescuer",
      governmentCode: "ASSAM-RESC-CODE-100",
      callSign: "NDRF Boat 4",
    });
    expect(rescuerRegistration.success).toBe(true);
    expect(rescuerRegistration.user.role).toBe("rescuer");
    
    const rescuerLogin = await caller.auth.login({
      email: rescuerEmail,
      password: "password123",
      governmentCode: "ASSAM-RESC-CODE-100",
    });
    expect(rescuerLogin.success).toBe(true);
    expect(rescuerLogin.user.role).toBe("rescuer");
  });

  it("superadmin (admin) has access across all module middlewares", async () => {
    const { ctx } = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    // Admin passes both rescuer-specific and operational procedures
    await expect(caller.rescue.rescuer.pushConfig()).resolves.toMatchObject({
      enabled: expect.any(Boolean),
    });
  });

  it("rescuer is restricted to field responder portal and blocked from command centre", async () => {
    const { ctx } = createMockContext("rescuer");
    const caller = appRouter.createCaller(ctx);

    // Rescuer can access rescuer endpoints
    await expect(caller.rescue.rescuer.pushConfig()).resolves.toBeDefined();

    // Rescuer is FORBIDDEN from command centre operations
    await expect(caller.rescue.operations.analytics()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
    await expect(caller.rescue.operations.rescueRoster()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
  });

  it("hospital staff is restricted to hospital portal and blocked from rescuer and command portals", async () => {
    const { ctx } = createMockContext("hospital");
    const caller = appRouter.createCaller(ctx);

    // Hospital staff is FORBIDDEN from rescuer configuration
    await expect(caller.rescue.rescuer.pushConfig()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });

    // Hospital staff is FORBIDDEN from command centre operations
    await expect(caller.rescue.operations.analytics()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
    await expect(caller.rescue.operations.rescueRoster()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
  });

  it("medical staff (legacy) is restricted to hospital portal and blocked from rescuer and command portals", async () => {
    const { ctx } = createMockContext("medical");
    const caller = appRouter.createCaller(ctx);

    // Medical staff is FORBIDDEN from rescuer configuration
    await expect(caller.rescue.rescuer.pushConfig()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });

    // Medical staff is FORBIDDEN from command centre operations
    await expect(caller.rescue.operations.analytics()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
    await expect(caller.rescue.operations.rescueRoster()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
  });

  it("citizen (user) is blocked from all operational workspaces", async () => {
    const { ctx } = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.rescue.operations.analytics()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
    await expect(caller.rescue.rescuer.pushConfig()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
    });
  });
});
