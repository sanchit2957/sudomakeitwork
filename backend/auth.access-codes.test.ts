import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import { setRoleAccessCode, getRoleCodeVersion } from "./db";

// Mock helper to build caller with specific user context
function createCaller(user?: any) {
  return appRouter.createCaller({
    user: user || null,
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  });
}

describe("Role Access Codes & Auth Gating", () => {
  it("should allow self-service citizen registration with email and password without code", async () => {
    const caller = createCaller();
    const uniqueEmail = `citizen_${Date.now()}@test.org`;
    const res = await caller.auth.register({
      name: "Ranjan Citizen",
      email: uniqueEmail,
      password: "password123",
      role: "user",
      isNative: true,
    });

    expect(res.user).toBeDefined();
    expect(res.user!.email).toBe(uniqueEmail);
    expect(res.user!.role).toBe("user");
    expect(res.sessionToken).toBeDefined();
  });

  it("should allow citizen login with email and password", async () => {
    const caller = createCaller();
    const uniqueEmail = `citizen_login_${Date.now()}@test.org`;
    await caller.auth.register({
      name: "Bina Citizen",
      email: uniqueEmail,
      password: "password123",
      role: "user",
    });

    const loginRes = await caller.auth.login({
      email: uniqueEmail,
      password: "password123",
    });

    expect(loginRes.user).toBeDefined();
    expect(loginRes.user!.email).toBe(uniqueEmail);
    expect(loginRes.user!.role).toBe("user");
  });

  it("should reject rescuer registration without governmentCode or with invalid code", async () => {
    const caller = createCaller();
    const uniqueEmail = `rescuer_fail_${Date.now()}@test.org`;

    // Missing code
    await expect(
      caller.auth.register({
        name: "Officer Test",
        email: uniqueEmail,
        password: "password123",
        role: "rescuer",
      })
    ).rejects.toThrow(/Government Access Code is required/i);

    // Invalid code
    await expect(
      caller.auth.register({
        name: "Officer Test",
        email: uniqueEmail,
        password: "password123",
        role: "rescuer",
        governmentCode: "WRONG-CODE-999",
      })
    ).rejects.toThrow(/Invalid Government Access Code/i);
  });

  it("should allow rescuer registration with valid active code and embed codeVersion in session", async () => {
    // Set active rescuer code
    await setRoleAccessCode("rescuer", "ASSAM-RESC-ACTIVE-2026", 1);
    const activeVersion = await getRoleCodeVersion("rescuer");

    const caller = createCaller();
    const uniqueEmail = `rescuer_success_${Date.now()}@test.org`;
    const res = await caller.auth.register({
      name: "Commander Bora",
      email: uniqueEmail,
      password: "password123",
      role: "rescuer",
      governmentCode: "ASSAM-RESC-ACTIVE-2026",
      callSign: "SDRF-01",
      isNative: true,
    });

    expect(res.user).toBeDefined();
    expect(res.user!.role).toBe("rescuer");
    expect(res.sessionToken).toBeDefined();

    // Verify session token payload contains codeVersion
    const sessionPayload = await sdk.verifySession(res.sessionToken);
    expect(sessionPayload?.codeVersion).toBe(activeVersion);
  });

  it("should gate rescuer login on valid active code", async () => {
    await setRoleAccessCode("rescuer", "ASSAM-RESC-CODE-100", 1);

    const caller = createCaller();
    const uniqueEmail = `rescuer_gated_${Date.now()}@test.org`;
    await caller.auth.register({
      name: "Officer Barman",
      email: uniqueEmail,
      password: "securepassword",
      role: "rescuer",
      governmentCode: "ASSAM-RESC-CODE-100",
    });

    // Login with wrong code fails
    await expect(
      caller.auth.login({
        email: uniqueEmail,
        password: "securepassword",
        governmentCode: "WRONG-CODE",
      })
    ).rejects.toThrow(/Invalid Government Access Code/i);

    // Login without code fails
    await expect(
      caller.auth.login({
        email: uniqueEmail,
        password: "securepassword",
      })
    ).rejects.toThrow(/Government Access Code is required/i);

    // Login with correct code succeeds
    const successRes = await caller.auth.login({
      email: uniqueEmail,
      password: "securepassword",
      governmentCode: "ASSAM-RESC-CODE-100",
    });
    expect(successRes.user).toBeDefined();
    expect(successRes.user!.role).toBe("rescuer");
  });

  it("should gate hospital login on valid active code", async () => {
    await setRoleAccessCode("hospital", "ASSAM-HOSP-CODE-200", 1);

    const caller = createCaller();
    const uniqueEmail = `hospital_staff_${Date.now()}@test.org`;
    await caller.auth.register({
      name: "Dr. Saikia",
      email: uniqueEmail,
      password: "hospitalpassword",
      role: "hospital",
      governmentCode: "ASSAM-HOSP-CODE-200",
    });

    // Login with correct code succeeds
    const loginRes = await caller.auth.login({
      email: uniqueEmail,
      password: "hospitalpassword",
      governmentCode: "ASSAM-HOSP-CODE-200",
    });
    expect(loginRes.user).toBeDefined();
    expect(loginRes.user!.role).toBe("hospital");
  });

  it("should allow admin to update code and invalidate previous codeVersion sessions", async () => {
    const adminCaller = createCaller({
      id: 1,
      role: "admin",
      loginMethod: "test",
    });

    // Admin updates rescuer code
    const updateRes = await adminCaller.auth.accessCodes.updateCode({
      role: "rescuer",
      code: "ASSAM-RESC-NEW-VERSION-999",
    });

    expect(updateRes.role).toBe("rescuer");
    expect(updateRes.codeVersion).toBeGreaterThan(1);

    const currentVersion = await getRoleCodeVersion("rescuer");
    expect(currentVersion).toBe(updateRes.codeVersion);

    // Old session with stale codeVersion
    const staleRescuerCaller = createCaller({
      id: 50,
      role: "rescuer",
      codeVersion: updateRes.codeVersion - 1, // Stale version
    });

    const checkRes = await staleRescuerCaller.auth.checkSessionVersion();
    expect(checkRes.valid).toBe(false);
    expect(checkRes.currentVersion).toBe(currentVersion);
    expect(checkRes.adminContactNumber).toBeDefined();

    // Session with fresh codeVersion
    const freshRescuerCaller = createCaller({
      id: 51,
      role: "rescuer",
      codeVersion: currentVersion,
    });
    const freshCheck = await freshRescuerCaller.auth.checkSessionVersion();
    expect(freshCheck.valid).toBe(true);
  });

  it("should allow admin to regenerate secure codes with 1-click", async () => {
    const adminCaller = createCaller({
      id: 1,
      role: "admin",
      loginMethod: "test",
    });

    const regenRes = await adminCaller.auth.accessCodes.regenerateCode({
      role: "hospital",
    });

    expect(regenRes.role).toBe("hospital");
    expect(regenRes.code).toMatch(/^ASSAM-HOSP-[A-Z0-9]{6}$/);
    expect(regenRes.codeVersion).toBeGreaterThan(1);
  });

  it("should allow brand-new custom email rescuer sign-up and subsequent login with current code", async () => {
    const activeCode = "ASSAM-RESC-2026-GOV";
    await setRoleAccessCode("rescuer", activeCode, 1);

    const caller = createCaller();
    const customEmail = `commander.saikia.${Date.now()}@customfield.org`;
    const customPassword = "SecurePassphrase!2026";

    // 1. Sign up brand new rescuer
    const registerRes = await caller.auth.register({
      name: "Commander Saikia",
      email: customEmail,
      password: customPassword,
      role: "rescuer",
      governmentCode: activeCode,
      callSign: "SDRF-BOAT-42",
      isNative: false,
    });

    expect(registerRes.success).toBe(true);
    expect(registerRes.user).toBeDefined();
    // 2. Sign in with the exact same credentials + active Government Code
    const loginRes = await caller.auth.login({
      email: customEmail,
      password: customPassword,
      governmentCode: activeCode,
    });

    expect(loginRes.success).toBe(true);
    expect(loginRes.user).toBeDefined();
    expect(loginRes.user!.email).toBe(customEmail);
    expect(loginRes.user!.role).toBe("rescuer");

    // 3. Confirm old unregistered hardcoded email fails with Invalid email or password
    await expect(
      caller.auth.login({
        email: "rescuer@assamrescue.gov.in",
        password: "rescuer",
        governmentCode: activeCode,
      })
    ).rejects.toThrow(/Invalid email or password/i);
  });
});
