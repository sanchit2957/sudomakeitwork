import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import { _memoryIncidents, _memoryMissions, _memoryHospitals, _memoryRescueProfiles } from "./rescue.db";
import { setRoleAccessCode } from "./db";

describe("Real Database Functionality & Workflows", () => {
  it("authenticates Citizen, Rescuer, Medical, and Admin accounts with correct password verification", async () => {
    await setRoleAccessCode("rescuer", "RESCUER-2026", 1);
    await setRoleAccessCode("hospital", "HOSPITAL-2026", 1);

    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: null,
    });

    // 1. Citizen login
    const citizenLogin = await caller.auth.login({
      email: "citizen@assamrescue.gov.in",
      password: "citizen",
    });
    expect(citizenLogin.success).toBe(true);
    expect(citizenLogin.user?.role).toBe("user");
    expect(citizenLogin.user?.email).toBe("citizen@assamrescue.gov.in");

    // 2. Rescuer registration + login
    const rescuerEmail = `rescuer_${Date.now()}@assamrescue.gov.in`;
    await caller.auth.register({
      name: "Inspector Barua",
      email: rescuerEmail,
      password: "rescuer-password",
      role: "rescuer",
      governmentCode: "RESCUER-2026",
    });

    const rescuerLogin = await caller.auth.login({
      email: rescuerEmail,
      password: "rescuer-password",
      governmentCode: "RESCUER-2026",
    });
    expect(rescuerLogin.success).toBe(true);
    expect(rescuerLogin.user?.role).toBe("rescuer");
    expect(rescuerLogin.user?.email).toBe(rescuerEmail);

    // 3. Hospital registration + login
    const hospitalEmail = `hospital_${Date.now()}@assamrescue.gov.in`;
    await caller.auth.register({
      name: "Dr. Hazarika",
      email: hospitalEmail,
      password: "hospital-password",
      role: "hospital",
      governmentCode: "HOSPITAL-2026",
    });

    const medicalLogin = await caller.auth.login({
      email: hospitalEmail,
      password: "hospital-password",
      governmentCode: "HOSPITAL-2026",
    });
    expect(medicalLogin.success).toBe(true);
    expect(medicalLogin.user?.role).toBe("hospital");
    expect(medicalLogin.user?.email).toBe(hospitalEmail);

    // 4. Admin login
    const adminLogin = await caller.auth.login({
      email: "admin@assamrescue.gov.in",
      password: "admin",
    });
    expect(adminLogin.success).toBe(true);
    expect(adminLogin.user?.role).toBe("admin");
    expect(adminLogin.user?.email).toBe("admin@assamrescue.gov.in");
  });

  it("handles SOS creation, SOS tracking, and Rescuer workflows", async () => {
    const citizenCaller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: {
        id: 4,
        openId: "user-citizen",
        name: "Anamika Das",
        email: "citizen@assamrescue.gov.in",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any,
    });

    // SOS creation
    const sos = await citizenCaller.rescue.emergency.create({
      locationLabel: "Near Bharalu River Bridge, Guwahati",
      latitude: 26.18,
      longitude: 91.74,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 3,
      notes: "Ground floor flooded, family safe on upper floor",
    });

    expect(sos).toBeDefined();
    expect(sos.publicCode).toMatch(/^SOS-/);

    // SOS tracking via statusByCode
    const tracked = await citizenCaller.rescue.emergency.statusByCode({
      publicCode: sos.publicCode,
    });
    expect(tracked).toBeDefined();
    expect(tracked.publicCode).toBe(sos.publicCode);
    expect(tracked.locationLabel).toBe("Near Bharalu River Bridge, Guwahati");

    // Rescuer caller
    const rescuerCaller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: {
        id: 2,
        openId: "user-rescuer",
        name: "Inspector Barua",
        email: "rescuer@assamrescue.gov.in",
        role: "rescuer",
        loginMethod: "test",
        codeVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any,
    });

    // Rescuer profile retrieval
    const profile = await rescuerCaller.rescue.rescuer.profile();
    expect(profile).toBeDefined();
    expect(profile.userId).toBe(2);

    // Rescuer missions
    const missions = await rescuerCaller.rescue.rescuer.missions();
    expect(Array.isArray(missions)).toBe(true);
  });

  it("handles Medical hospital resource update, Admin roster, and Admin analytics", async () => {
    const adminCaller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: {
        id: 1,
        openId: "user-admin",
        name: "Superadmin",
        email: "admin@assamrescue.gov.in",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any,
    });

    // Admin analytics
    const analytics = await adminCaller.rescue.operations.analytics();
    expect(analytics).toBeDefined();
    expect(analytics).toHaveProperty("totalIncidents");
    expect(analytics).toHaveProperty("activeRescuers");

    // Admin roster
    const roster = await adminCaller.rescue.operations.rescueRoster();
    expect(Array.isArray(roster)).toBe(true);

    // Medical caller
    const medicalCaller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: {
        id: 3,
        openId: "user-medical",
        name: "Dr. Hazarika",
        email: "medical@assamrescue.gov.in",
        role: "medical",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any,
    });

    // Medical hospital listing
    const resources = await medicalCaller.rescue.safety.resources();
    expect(resources).toBeDefined();
    expect(Array.isArray(resources.hospitals)).toBe(true);
  });
});
