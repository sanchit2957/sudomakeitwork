import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth.password";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { appRouter } from "./routers";
import type { Request } from "express";
import type { TrpcContext } from "./_core/context";

describe("Password Hashing & Timing-Safe Verification", () => {
  it("hashes password with salt and successfully verifies correct password", () => {
    const password = "mySecretPassword123!";
    const hash = hashPassword(password);

    expect(hash).toContain(":");
    const [salt, key] = hash.split(":");
    expect(salt.length).toBe(32); // 16 bytes hex
    expect(key.length).toBe(128); // 64 bytes hex

    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrongPassword", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("handles malformed or missing hashes gracefully without crashing", () => {
    expect(verifyPassword("pass", null as any)).toBe(false);
    expect(verifyPassword("pass", undefined as any)).toBe(false);
    expect(verifyPassword("pass", "nohash")).toBe(false);
    expect(verifyPassword("pass", ":")).toBe(false);
  });
});

describe("Session Cookie Configuration", () => {
  it("sets SameSite=lax and Secure=false on local development HTTP requests", () => {
    const req = {
      protocol: "http",
      headers: {},
    } as unknown as Request;

    const options = getSessionCookieOptions(req);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");
  });

  it("sets SameSite=none and Secure=true on production HTTPS requests", () => {
    const req = {
      protocol: "https",
      headers: {},
    } as unknown as Request;

    const options = getSessionCookieOptions(req);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });

  it("recognizes x-forwarded-proto https header for reverse proxies", () => {
    const req = {
      protocol: "http",
      headers: {
        "x-forwarded-proto": "https",
      },
    } as unknown as Request;

    const options = getSessionCookieOptions(req);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });
});

describe("User Sanitization & Authentication Security", () => {
  function createTestContext(user: any = null) {
    const cookiesSet: any[] = [];
    const ctx: TrpcContext = {
      user,
      req: {
        protocol: "http",
        headers: {},
        cookies: {},
      } as any,
      res: {
        cookie: (name: string, value: string, options: any) => {
          cookiesSet.push({ name, value, options });
        },
        clearCookie: () => {},
      } as any,
    };
    return { ctx, cookiesSet };
  }

  it("does not return password field on auth.login", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const loginRes = await caller.auth.login({
      email: "citizen@assamrescue.gov.in",
      password: "citizen",
    });

    expect(loginRes.success).toBe(true);
    expect(loginRes.user.role).toBe("user");
    expect((loginRes.user as any).password).toBeUndefined();
  });

  it("rejects login with invalid password", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "citizen@assamrescue.gov.in",
        password: "wrongPassword",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("sanitizes user on registration and securely hashes password", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const testEmail = `newuser_${Date.now()}@assamrescue.gov.in`;

    const registerRes = await caller.auth.register({
      name: "New Registered Citizen",
      email: testEmail,
      password: "securePassword2026!",
      role: "user",
    });

    expect(registerRes.success).toBe(true);
    expect((registerRes.user as any).password).toBeUndefined();

    // Verify the new user can log in with their password
    const loginRes = await caller.auth.login({
      email: testEmail,
      password: "securePassword2026!",
    });
    expect(loginRes.success).toBe(true);
    expect((loginRes.user as any).password).toBeUndefined();
  });

  it("rejects request if session user is missing from authoritative database", async () => {
    const fakeToken = await sdk.createSessionToken("non-existent-user-openid-99999");
    const mockReq = {
      headers: {
        cookie: `sudo_makeitwork_session=${fakeToken}`,
      },
    } as unknown as Request;

    await expect(sdk.authenticateRequest(mockReq)).rejects.toThrow();
  });

  it("rejects login with invalid or unverified supabaseToken", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "user@example.com",
        supabaseToken: "invalid-token-12345",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
