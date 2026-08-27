import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { canEditHospitalResources } from "./hospital-registration.policy";
import { canRequestRescuerRegistration } from "./registration.policy";
import { getInitialSeedPassword } from "./seed";
import { _memoryRescuerRequests, _memoryHospitalRequests, _memoryUsers, _memoryRescueProfiles, _memoryHospitals, _memoryHospitalStaffProfiles } from "./rescue.db";

describe("Master Implementation — Approval Lifecycle, Role Hierarchy & Security Matrix", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  describe("Phase 4 & 5 — Seed Credential Security", () => {
    it("uses secure environment variable in production and isolates demo passwords to dev/test", () => {
      // In non-production (test/dev)
      process.env.NODE_ENV = "test";
      expect(getInitialSeedPassword("admin", "admin")).toBe("admin");
      expect(getInitialSeedPassword("rescuer", "rescuer")).toBe("rescuer");

      // In production
      process.env.NODE_ENV = "production";
      process.env.ADMIN_INITIAL_PASSWORD = "my-custom-super-secret-admin-pass";
      expect(getInitialSeedPassword("admin", "admin")).toBe("my-custom-super-secret-admin-pass");

      // If ADMIN_INITIAL_PASSWORD is not set in production, generates a 32-char hex random token
      delete process.env.ADMIN_INITIAL_PASSWORD;
      const generated = getInitialSeedPassword("admin", "admin");
      expect(generated.length).toBe(32);
      expect(generated).not.toBe("admin");

      process.env.NODE_ENV = "test";
    });
  });

  describe("Phase 6, 8, 9, 10 — Rescuer Approval Lifecycle (PENDING -> ACTIVE)", () => {
    it("handles Rescuer registration (PENDING), access block, and Admin approval (ACTIVE)", async () => {
      const publicCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: null,
      });

      const uniqueEmail = `applicant.rescuer.${Date.now()}@example.com`;
      const regUserRes = await publicCaller.auth.register({
        name: "Applicant Rescuer",
        email: uniqueEmail,
        password: "password123",
      });

      const applicantUser = regUserRes.user!;
      expect(applicantUser.role).toBe("user");

      const applicantCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: applicantUser as any,
      });

      // 1. Applicant submits Rescuer registration request (creates PENDING)
      const regRes = await applicantCaller.rescue.rescuer.requestRegistration({
        phone: "+91 94350 99999",
        note: "NDRF Diver with 5 years experience",
      });
      expect(regRes.success).toBe(true);

      // Verify pending request exists
      const myReg = await applicantCaller.rescue.rescuer.myRegistration();
      expect(myReg).toBeDefined();
      expect(myReg?.status).toBe("pending");
      expect(myReg?.userId).toBe(applicantUser.id);

      // 2. While PENDING, applicant is still role "user" and CANNOT access protected rescuer procedures
      await expect(applicantCaller.rescue.rescuer.profile()).rejects.toThrow(/Rescuer access is required/i);
      await expect(applicantCaller.rescue.rescuer.missions()).rejects.toThrow(/Rescuer access is required/i);

      // 3. Admin views and approves registration request
      const adminLogin = await publicCaller.auth.login({
        email: "admin@assamrescue.gov.in",
        password: "admin",
      });

      const adminCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: adminLogin.user as any,
      });

      const pendingList = await adminCaller.rescue.operations.rescuerRegistrationRequests();
      const targetReq = pendingList.find(r => r.request.userId === applicantUser.id);
      expect(targetReq).toBeDefined();

      const approvalRes = await adminCaller.rescue.operations.reviewRescuerRegistration({
        requestId: targetReq!.request.id,
        decision: "approved",
        callSign: "Guwahati Fast Boat 9",
        reviewNote: "Approved after NDRF credential check",
      });
      expect(approvalRes.success).toBe(true);

      // 4. After approval, user re-authenticates to get their updated role (ACTIVE rescuer)
      const refreshedLogin = await publicCaller.auth.login({
        email: uniqueEmail,
        password: "password123",
      });
      expect(refreshedLogin.user?.role).toBe("rescuer");

      const activeRescuerCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: refreshedLogin.user as any,
      });

      const profile = await activeRescuerCaller.rescue.rescuer.profile();
      expect(profile).toBeDefined();
      expect(profile.callSign).toBe("Guwahati Fast Boat 9");
      expect(profile.userId).toBe(applicantUser.id);

      const missions = await activeRescuerCaller.rescue.rescuer.missions();
      expect(Array.isArray(missions)).toBe(true);
    });

    it("handles Rescuer rejection (PENDING -> REJECTED), leaving user role blocked from rescuer ops", async () => {
      const publicCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: null,
      });

      const uniqueEmail = `rejected.rescuer.${Date.now()}@example.com`;
      const regUserRes = await publicCaller.auth.register({
        name: "Rejected Rescuer",
        email: uniqueEmail,
        password: "password123",
      });

      const rejectedUser = regUserRes.user!;

      const caller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: rejectedUser as any,
      });

      await caller.rescue.rescuer.requestRegistration({
        phone: "+91 94350 88888",
        note: "Unqualified applicant",
      });

      const adminLogin = await publicCaller.auth.login({
        email: "admin@assamrescue.gov.in",
        password: "admin",
      });

      const adminCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: adminLogin.user as any,
      });

      const pendingList = await adminCaller.rescue.operations.rescuerRegistrationRequests();
      const targetReq = pendingList.find(r => r.request.userId === rejectedUser.id);
      expect(targetReq).toBeDefined();

      await adminCaller.rescue.operations.reviewRescuerRegistration({
        requestId: targetReq!.request.id,
        decision: "rejected",
        reviewNote: "Missing required certifications",
      });

      // Role remains "user" and rescuer procedures remain blocked
      await expect(caller.rescue.rescuer.profile()).rejects.toThrow(/Rescuer access is required/i);
    });
  });

  describe("Phase 6, 8, 9, 10 — Hospital Approval Lifecycle (PENDING -> ACTIVE)", () => {
    it("handles Hospital registration (PENDING), access block, and Admin approval (ACTIVE)", async () => {
      const publicCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: null,
      });

      const uniqueEmail = `applicant.medical.${Date.now()}@example.com`;
      const regUserRes = await publicCaller.auth.register({
        name: "Dr. Baruah",
        email: uniqueEmail,
        password: "password123",
      });

      const applicantMedical = regUserRes.user!;

      const applicantCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: applicantMedical as any,
      });

      // 1. Submit Hospital registration request
      const regRes = await applicantCaller.rescue.hospital.requestRegistration({
        hospitalName: "Dispur Emergency Trauma Center",
        address: "GS Road, Dispur, Guwahati 781005",
        contactPhone: "+91 361 2233445",
        latitude: 26.14,
        longitude: 91.79,
        note: "24/7 Trauma Coordinator",
      });
      expect(regRes.status).toBe("pending");

      // Verify pending request exists
      const myReq = await applicantCaller.rescue.hospital.mine();
      expect(myReq).toBeDefined();
      expect(myReq?.status).toBe("pending");
      expect(myReq?.hospitalName).toBe("Dispur Emergency Trauma Center");

      // 2. While PENDING, applicant cannot access protected hospital operations
      await expect(applicantCaller.rescue.operations.hospitals()).rejects.toThrow(/medical operations access is required/i);

      // 3. Admin reviews and approves Hospital registration
      const adminLogin = await publicCaller.auth.login({
        email: "admin@assamrescue.gov.in",
        password: "admin",
      });

      const adminCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: adminLogin.user as any,
      });

      const pendingHospitalList = await adminCaller.rescue.operations.hospitalRegistrationRequests();
      const targetReq = pendingHospitalList.find(r => r.request.userId === applicantMedical.id);
      expect(targetReq).toBeDefined();

      const approval = await adminCaller.rescue.operations.reviewHospitalRegistration({
        requestId: targetReq!.request.id,
        decision: "approved",
        designation: "Chief Medical Officer",
      });
      expect(approval.success).toBe(true);
      expect(approval.hospitalId).toBeDefined();

      // 4. After approval, user re-authenticates to get their updated role (ACTIVE medical)
      const refreshedMedicalLogin = await publicCaller.auth.login({
        email: uniqueEmail,
        password: "password123",
      });
      expect(refreshedMedicalLogin.user?.role).toBe("medical");

      const activeMedicalCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: refreshedMedicalLogin.user as any,
      });

      const myHospitals = await activeMedicalCaller.rescue.operations.hospitals();
      expect(Array.isArray(myHospitals)).toBe(true);
      expect(myHospitals.length).toBeGreaterThan(0);
      expect(myHospitals[0].name).toBe("Dispur Emergency Trauma Center");
    });
  });

  describe("Phase 12 & 13 — Server-Side Role Enforcement & IDOR Protection", () => {
    it("blocks standard user from calling Admin procedures", async () => {
      const citizenCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: { id: 4, openId: "user-citizen", role: "user" } as any,
      });

      await expect(citizenCaller.auth.createUser({
        name: "Fake Admin",
        email: "fake.admin@example.com",
        password: "pass",
        role: "admin",
      })).rejects.toThrow();

      await expect(citizenCaller.rescue.operations.analytics()).rejects.toThrow();
      await expect(citizenCaller.rescue.operations.rescueRoster()).rejects.toThrow();
    });

    it("blocks Rescuer from calling Admin procedures", async () => {
      const rescuerCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: { id: 2, openId: "user-rescuer", role: "rescuer" } as any,
      });

      await expect(rescuerCaller.auth.createUser({
        name: "Escalate",
        email: "escalate@example.com",
        password: "pass",
        role: "admin",
      })).rejects.toThrow();

      await expect(rescuerCaller.rescue.operations.analytics()).rejects.toThrow();
    });

    it("blocks Medical staff from calling Admin procedures", async () => {
      const medicalCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        user: { id: 3, openId: "user-medical", role: "medical" } as any,
      });

      await expect(medicalCaller.rescue.operations.rescueRoster()).rejects.toThrow();
    });

    it("prevents Hospital IDOR: Medical staff cannot modify unauthorized hospital resources", () => {
      const myHospitalId = 1;
      const otherHospitalId = 2;

      // Authorized on assigned hospital
      expect(canEditHospitalResources("medical", myHospitalId, myHospitalId)).toBe(true);

      // Blocked on other hospital
      expect(canEditHospitalResources("medical", myHospitalId, otherHospitalId)).toBe(false);

      // Blocked for standard citizen
      expect(canEditHospitalResources("user", myHospitalId, myHospitalId)).toBe(false);

      // Admin has overall authority
      expect(canEditHospitalResources("admin", null, otherHospitalId)).toBe(true);
    });
  });
});
