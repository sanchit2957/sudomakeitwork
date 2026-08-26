import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { hashPassword, verifyPassword } from "./_core/password";
import type { TrpcContext } from "./_core/context";

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

describe("authentication security", () => {
  it("hashes and verifies passwords without exposing the original", async () => {
    const hashed = await hashPassword("demo-password");
    expect(hashed).toMatch(/^scrypt:/);
    expect(hashed).not.toContain("demo-password");
    await expect(verifyPassword("demo-password", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hashed)).resolves.toBe(false);
  });

  it("rejects client-selected admin roles during login", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());
      await expect(caller.auth.login({
        email: "new-user@example.com",
        password: "password",
        role: "admin",
      } as any)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects admin role input during public registration", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());
    await expect(caller.auth.register({
      name: "Public User",
      email: `public-${Date.now()}@example.com`,
      password: "password",
      role: "admin",
    } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not grant unauthenticated admin access", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());
    await expect(caller.auth.createUser({
      name: "Should Fail",
      email: "should-fail@example.com",
      password: "password",
      role: "user",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
