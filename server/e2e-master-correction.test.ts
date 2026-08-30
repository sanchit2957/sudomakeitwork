import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";
import { _memoryIncidents, _memoryHospitals, _memoryRescueProfiles, listShelters } from "./rescue.db";
import { canEditHospitalResources } from "./hospital-registration.policy";
import { hasValidHospitalCapacity } from "./hospital.policy";

describe("E2E Master Correction & Security Hardening Test Suite", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  function createCallerForUser(user: any = null) {
    const cookiesSet: any[] = [];
    const cookiesCleared: any[] = [];
    const ctx = {
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
        clearCookie: (name: string, options: any) => {
          cookiesCleared.push({ name, options });
        },
      } as any,
    };
    return { caller: appRouter.createCaller(ctx), cookiesSet, cookiesCleared };
  }

  it("1. Citizen Login: successfully authenticates, sets HTTP-only cookie, and does not leak raw session token for web", async () => {
    const { caller, cookiesSet } = createCallerForUser(null);
    const res = await caller.auth.login({
      email: "citizen@assamrescue.gov.in",
      password: "citizen",
    });

    expect(res.success).toBe(true);
    expect(res.user.role).toBe("user");
    expect(res.sessionToken).toBeUndefined(); // Web flow: session token omitted from JSON body
    expect(cookiesSet.length).toBeGreaterThan(0);
    expect(cookiesSet[0].name).toBe(COOKIE_NAME);
    expect(cookiesSet[0].options.httpOnly).toBe(true);
  });

  it("2. Rescuer Login: authenticates rescuer with proper role", async () => {
    const { caller } = createCallerForUser(null);
    const res = await caller.auth.login({
      email: "rescuer@assamrescue.gov.in",
      password: "rescuer",
    });

    expect(res.success).toBe(true);
    expect(res.user.role).toBe("rescuer");
    expect((res.user as any).password).toBeUndefined();
  });

  it("3. Medical Login: authenticates medical staff with canonical hospital/medical role", async () => {
    const { caller } = createCallerForUser(null);
    const res = await caller.auth.login({
      email: "medical@assamrescue.gov.in",
      password: "medical",
    });

    expect(res.success).toBe(true);
    expect(["hospital", "medical"]).toContain(res.user.role);
    expect((res.user as any).password).toBeUndefined();
  });

  it("4. Admin Login: authenticates superadmin with admin role", async () => {
    const { caller } = createCallerForUser(null);
    const res = await caller.auth.login({
      email: "admin@assamrescue.gov.in",
      password: "admin",
    });

    expect(res.success).toBe(true);
    expect(res.user.role).toBe("admin");
  });

  it("5. Logout: clears the session cookie and invalidates session", async () => {
    const clearedCookies: any[] = [];
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "user-citizen", role: "user", status: "active" } as any,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: {
        clearCookie: (name: string, options: any) => {
          clearedCookies.push({ name, options });
        },
      } as any,
    });
    const res = await caller.auth.logout();

    expect(res.success).toBe(true);
    expect(clearedCookies.some(c => c.name === COOKIE_NAME)).toBe(true);
  });

  it("6. Invalid Login: rejects incorrect passwords with UNAUTHORIZED", async () => {
    const { caller } = createCallerForUser(null);
    await expect(
      caller.auth.login({
        email: "citizen@assamrescue.gov.in",
        password: "wrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("7. Backend Authorization: prevents citizen from accessing admin-only or responder-only endpoints", async () => {
    const citizenUser = { id: 4, openId: "user-citizen", name: "Citizen", role: "user", status: "active" };
    const { caller } = createCallerForUser(citizenUser);

    // Attempting to assign mission as a regular citizen
    await expect(
      caller.rescue.operations.assignMission({ incidentId: 1, rescuerId: 2 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // Attempting to list all users as a regular citizen
    await expect(
      caller.auth.listUsers()
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("8. SOS Creation & Tracking: creates an emergency SOS and queries statusByCode", async () => {
    const citizenUser = { id: 4, openId: "user-citizen", name: "Citizen", role: "user", status: "active" };
    const { caller } = createCallerForUser(citizenUser);

    const sos = await caller.rescue.emergency.create({
      latitude: 26.1445,
      longitude: 91.7362,
      locationLabel: "Guwahati Riverside",
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 3,
    });

    expect(sos.publicCode).toMatch(/^SOS-[A-Z0-9]{8}$/);

    const status = await caller.rescue.emergency.statusByCode({ publicCode: sos.publicCode });
    expect(status.publicCode).toBe(sos.publicCode);
    expect(status.locationLabel).toBe("Guwahati Riverside");
    expect(status.severity).toBe("critical");
    expect(status.status).toBe("pending");
  });

  it("9. Hospital Capacity Invariants: rejects invalid or negative bed counts", () => {
    // Total beds: 100, Available: 105 (Exceeds capacity) -> must fail
    expect(hasValidHospitalCapacity(100, 105, 20, 5)).toBe(false);

    // Total ICU: 20, Available: 25 (Exceeds capacity) -> must fail
    expect(hasValidHospitalCapacity(100, 50, 20, 25)).toBe(false);

    // Negative available beds -> must fail
    expect(hasValidHospitalCapacity(100, -5, 20, 5)).toBe(false);

    // Valid capacity -> must pass
    expect(hasValidHospitalCapacity(100, 50, 20, 10)).toBe(true);
  });

  it("10. Hospital IDOR Protection: medical staff cannot update other hospitals", () => {
    const medicalStaffHospitalId = 5;
    const targetHospitalId = 9;

    expect(canEditHospitalResources("medical", medicalStaffHospitalId, targetHospitalId)).toBe(false);
    expect(canEditHospitalResources("medical", medicalStaffHospitalId, medicalStaffHospitalId)).toBe(true);
    expect(canEditHospitalResources("admin", null, targetHospitalId)).toBe(true);
  });

  it("11. Emergency Contact Authorization: user cannot read other users' contacts without authorization", async () => {
    const userA = { id: 101, openId: "user-a", name: "User A", role: "user", status: "active" };
    const { caller } = createCallerForUser(userA);

    // Attempt to access user 102's contacts
    await expect(
      caller.auth.emergencyContacts.getForUser({ userId: 102 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("12. Production Database Fail-Closed: throws in production when DB is unreachable and does not fall back to memory", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    await expect(getDb()).rejects.toThrow(/operational database is disconnected|database is unavailable/i);
  });
});
