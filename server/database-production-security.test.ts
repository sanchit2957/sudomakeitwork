import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { canEditHospitalResources } from "./hospital-registration.policy";
import { readFileSync, existsSync } from "fs";
import path from "path";

describe("Production Security & Fail-Closed Controls", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.DATABASE_URL = originalDbUrl;
    vi.restoreAllMocks();
  });

  it("fails closed when DATABASE_URL is missing or fails in production", async () => {
    delete process.env.DATABASE_URL;
    
    // Attempt to access operational DB in production without DATABASE_URL
    await expect(getDb()).rejects.toThrow(/operational database is disconnected|Authoritative database is unavailable/i);
  });

  it("auth.me sanitizes user and NEVER exposes password hash", async () => {
    const adminCaller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: {
        id: 1,
        openId: "user-admin",
        name: "Superadmin",
        email: "admin@assamrescue.gov.in",
        role: "admin",
        password: "salt:secret-scrypt-hash",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any,
    });

    const me = await adminCaller.auth.me();
    expect(me).toBeDefined();
    expect((me as any)?.password).toBeUndefined();
    expect(me?.email).toBe("admin@assamrescue.gov.in");
  });

  it("registration prevents role spoofing and enforces user role for all new accounts", async () => {
    // In dev mode or unit test, register creates user with role 'user'
    process.env.NODE_ENV = "test";
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: null,
    });

    const email = `test-spoof-${Date.now()}@example.com`;
    const res = await caller.auth.register({
      name: "Attacker Pretending Admin",
      email,
      password: "password123",
      role: "admin" as any, // Trying to register directly as admin
    });

    expect(res.success).toBe(true);
    // Role MUST remain "user" regardless of input.role
    expect(res.user?.role).toBe("user");
    expect((res.user as any)?.password).toBeUndefined();
  });

  it("enforces Hospital IDOR protection: medical staff cannot modify other hospitals", () => {
    const assignedHospitalId = 10;
    const requestedHospitalId = 20;

    // Allowed on assigned hospital
    expect(canEditHospitalResources("medical", assignedHospitalId, assignedHospitalId)).toBe(true);

    // Blocked on different hospital (IDOR protection)
    expect(canEditHospitalResources("medical", assignedHospitalId, requestedHospitalId)).toBe(false);

    // Citizen cannot edit any hospital
    expect(canEditHospitalResources("user", assignedHospitalId, assignedHospitalId)).toBe(false);

    // Admin can edit any hospital
    expect(canEditHospitalResources("admin", null, assignedHospitalId)).toBe(true);
    expect(canEditHospitalResources("admin", null, requestedHospitalId)).toBe(true);
  });

  it("verifies frontend client code does NOT expose DATABASE_URL", () => {
    const clientAppPath = path.resolve(process.cwd(), "client/src/App.tsx");
    if (existsSync(clientAppPath)) {
      const content = readFileSync(clientAppPath, "utf8");
      expect(content).not.toContain("DATABASE_URL");
    }

    const envExamplePath = path.resolve(process.cwd(), ".env.example");
    const envExample = readFileSync(envExamplePath, "utf8");
    expect(envExample).not.toContain("tidbcloud.com");
    expect(envExample).not.toContain("root:");
  });
});
