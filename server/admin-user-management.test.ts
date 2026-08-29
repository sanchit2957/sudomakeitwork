import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { _memoryUsers, upsertUser } from "./db";
import { _memoryAuditLogs } from "./rescue.db";

function createMockContext(
  role?: "admin" | "rescuer" | "hospital" | "medical" | "user",
  options: { id?: number; status?: "active" | "disabled"; email?: string; openId?: string } = {}
): TrpcContext {
  const now = new Date();
  const userId = options.id ?? (role === "admin" ? 1 : role === "rescuer" ? 2 : role === "hospital" ? 3 : 4);
  const user = role
    ? {
        id: userId,
        openId: options.openId || `test-${role}-${userId}`,
        name: `Test ${role}`,
        email: options.email || `${role}-${userId}@assamrescue.gov.in`,
        password: "hashed-test-password",
        loginMethod: "test",
        role,
        status: options.status || "active",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      }
    : null;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Admin User Management & RBAC Security Suite", () => {
  it("enforces canonical role 'user' and status 'active' on public registration regardless of requested role", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `citizen.test.${Date.now()}@example.com`;
    const res = await caller.auth.register({
      name: "Public Registrant",
      email: testEmail,
      password: "securePassword123!",
      role: "admin" as any, // Client attempts privilege escalation
    });

    expect(res.success).toBe(true);
    expect(res.user.role).toBe("user"); // Must be strictly forced to "user"
    expect(res.user.status).toBe("active");
  });

  it("adminUsersList returns enriched user list, search filtering, and dashboard summary counters", async () => {
    const adminCtx = createMockContext("admin", { id: 1 });
    const adminCaller = appRouter.createCaller(adminCtx);

    const result = await adminCaller.rescue.operations.adminUsersList({
      role: "all",
      status: "all",
      limit: 50,
    });

    expect(result.users).toBeDefined();
    expect(Array.isArray(result.users)).toBe(true);
    expect(result.users.length).toBeGreaterThanOrEqual(1);

    // Summary counts must be present
    expect(result.summary).toBeDefined();
    expect(result.summary.total).toBeGreaterThanOrEqual(1);
    expect(result.summary.admins).toBeGreaterThanOrEqual(1);
    expect(result.summary.active).toBeGreaterThanOrEqual(1);

    // Verify search filter works
    const searchRes = await adminCaller.rescue.operations.adminUsersList({
      search: "Superadmin",
      role: "all",
      status: "all",
    });
    expect(searchRes.users.some(u => u.name?.includes("Superadmin"))).toBe(true);
  });

  it("rejects non-admin calls to adminUsersList with FORBIDDEN", async () => {
    const citizenCtx = createMockContext("user", { id: 4 });
    const citizenCaller = appRouter.createCaller(citizenCtx);

    await expect(
      citizenCaller.rescue.operations.adminUsersList({ role: "all", status: "all" })
    ).rejects.toThrowError(TRPCError);
  });

  it("adminGetUser returns comprehensive profile details and audit records", async () => {
    const adminCtx = createMockContext("admin", { id: 1 });
    const adminCaller = appRouter.createCaller(adminCtx);

    const details = await adminCaller.rescue.operations.adminGetUser({ userId: 1 });
    expect(details.user).toBeDefined();
    expect(details.user.id).toBe(1);
    expect(details.user.role).toBe("admin");
    expect(Array.isArray(details.auditHistory)).toBe(true);
  });

  it("admin can change a citizen's role to 'rescuer' with call sign and records audit log", async () => {
    const adminCtx = createMockContext("admin", { id: 1 });
    const adminCaller = appRouter.createCaller(adminCtx);

    // Create a citizen user to modify
    const citizenEmail = `citizen.to.rescuer.${Date.now()}@assamrescue.gov.in`;
    const openId = `user-rescuer-target-${Date.now()}`;
    await upsertUser({
      openId,
      name: "Prospective Rescuer",
      email: citizenEmail,
      role: "user",
      status: "active",
      loginMethod: "platform-login",
    });

    const citizen = Array.from(_memoryUsers.values()).find(u => u.email === citizenEmail);
    expect(citizen).toBeDefined();

    const updateRes = await adminCaller.rescue.operations.adminUpdateUserRole({
      userId: citizen.id,
      role: "rescuer",
      callSign: "NDRF-ALPHA-99",
      phone: "+91 98765 00099",
      reason: "Promoted to rapid response field unit lead",
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.newRole).toBe("rescuer");

    // Verify user list shows new rescuer profile
    const userDetail = await adminCaller.rescue.operations.adminGetUser({ userId: citizen.id });
    expect(userDetail.user.role).toBe("rescuer");
    expect(userDetail.rescuerProfile?.callSign).toBe("NDRF-ALPHA-99");
  });

  it("admin can change a citizen's role to 'hospital' with facility linkage", async () => {
    const adminCtx = createMockContext("admin", { id: 1 });
    const adminCaller = appRouter.createCaller(adminCtx);

    const citizenEmail = `citizen.to.hospital.${Date.now()}@assamrescue.gov.in`;
    const openId = `user-hospital-target-${Date.now()}`;
    await upsertUser({
      openId,
      name: "Prospective Medical Staff",
      email: citizenEmail,
      role: "user",
      status: "active",
      loginMethod: "platform-login",
    });

    const citizen = Array.from(_memoryUsers.values()).find(u => u.email === citizenEmail);
    expect(citizen).toBeDefined();

    // Requires hospitalId
    await expect(
      adminCaller.rescue.operations.adminUpdateUserRole({
        userId: citizen.id,
        role: "hospital",
        // missing hospitalId
      })
    ).rejects.toThrowError(TRPCError);

    // Succeeds with hospitalId = 1
    const updateRes = await adminCaller.rescue.operations.adminUpdateUserRole({
      userId: citizen.id,
      role: "hospital",
      hospitalId: 1,
      designation: "ICU Triage Coordinator",
      reason: "Assigned to Gauhati Medical College emergency desk",
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.newRole).toBe("hospital");

    const userDetail = await adminCaller.rescue.operations.adminGetUser({ userId: citizen.id });
    expect(userDetail.user.role).toBe("hospital");
    expect(userDetail.hospitalStaffProfile?.hospitalId).toBe(1);
  });

  it("admin can toggle user status (disable / activate), preventing self-lockout", async () => {
    const adminCtx = createMockContext("admin", { id: 1 });
    const adminCaller = appRouter.createCaller(adminCtx);

    // Admin attempts to disable their own account -> Must be rejected
    await expect(
      adminCaller.rescue.operations.adminSetUserStatus({
        userId: 1,
        status: "disabled",
        reason: "Accidental self-disable",
      })
    ).rejects.toThrowError("Administrators cannot disable their own account.");

    // Admin disables a standard citizen account -> Must succeed
    const targetEmail = `target.disable.${Date.now()}@assamrescue.gov.in`;
    const openId = `user-disable-target-${Date.now()}`;
    await upsertUser({
      openId,
      name: "User To Disable",
      email: targetEmail,
      role: "user",
      status: "active",
      loginMethod: "platform-login",
    });

    const targetUser = Array.from(_memoryUsers.values()).find(u => u.email === targetEmail);
    expect(targetUser).toBeDefined();

    const disableRes = await adminCaller.rescue.operations.adminSetUserStatus({
      userId: targetUser.id,
      status: "disabled",
      reason: "Account suspended due to policy check",
    });

    expect(disableRes.success).toBe(true);
    expect(disableRes.status).toBe("disabled");

    // Disabled user attempts to call protected procedures -> Must be rejected with FORBIDDEN
    const disabledCtx = createMockContext("user", { id: targetUser.id, status: "disabled" });
    const disabledCaller = appRouter.createCaller(disabledCtx);

    await expect(
      disabledCaller.rescue.emergency.mine()
    ).rejects.toThrowError("Your account has been disabled. Please contact an administrator.");

    // Admin re-activates the account -> Must succeed
    const activateRes = await adminCaller.rescue.operations.adminSetUserStatus({
      userId: targetUser.id,
      status: "active",
      reason: "Account reactivated after review",
    });

    expect(activateRes.success).toBe(true);
    expect(activateRes.status).toBe("active");
  });
});
