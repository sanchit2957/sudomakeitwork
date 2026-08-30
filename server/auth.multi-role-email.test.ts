import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { setRoleAccessCode } from "./db";
import type { TrpcContext } from "./_core/context";

function createMockContext(): {
  ctx: TrpcContext;
  cookiesSet: { name: string; value?: string; options: Record<string, unknown> }[];
} {
  const cookiesSet: { name: string; value?: string; options: Record<string, unknown> }[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookiesSet.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookiesSet };
}

describe("Multi-Role Per Email Registration & Authentication", () => {
  it("allows the same email to register independently as Citizen, Rescuer, and Hospital", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `ayushi.devstudio_${Date.now()}@gmail.com`;
    const rescuerCode = "ASSAM-RESC-MULTITEST";
    const hospitalCode = "ASSAM-HOSP-MULTITEST";
    await setRoleAccessCode("rescuer", rescuerCode, 1);
    await setRoleAccessCode("hospital", hospitalCode, 1);

    // 1. Register as Citizen
    const citizenReg = await caller.auth.register({
      name: "Ayushi Citizen",
      email: testEmail,
      password: "CitizenSecretPassword123",
      role: "user",
    });
    expect(citizenReg.success).toBe(true);
    expect(citizenReg.user.email).toBe(testEmail);
    expect(citizenReg.user.role).toBe("user");
    const citizenId = citizenReg.user.id;

    // 2. Register SAME email as Rescuer with different password
    const rescuerReg = await caller.auth.register({
      name: "Ayushi NDRF Unit",
      email: testEmail,
      password: "RescuerSecretPassword456",
      role: "rescuer",
      governmentCode: rescuerCode,
      callSign: "NDRF Bravo 2",
    });
    expect(rescuerReg.success).toBe(true);
    expect(rescuerReg.user.email).toBe(testEmail);
    expect(rescuerReg.user.role).toBe("rescuer");
    const rescuerId = rescuerReg.user.id;

    // Must be distinct accounts
    expect(citizenId).not.toBe(rescuerId);

    // 3. Register SAME email as Hospital Staff with different password
    const hospitalReg = await caller.auth.register({
      name: "Ayushi Medical Officer",
      email: testEmail,
      password: "HospitalSecretPassword789",
      role: "hospital",
      governmentCode: hospitalCode,
    });
    expect(hospitalReg.success).toBe(true);
    expect(hospitalReg.user.email).toBe(testEmail);
    expect(hospitalReg.user.role).toBe("hospital");
    const hospitalId = hospitalReg.user.id;

    expect(hospitalId).not.toBe(citizenId);
    expect(hospitalId).not.toBe(rescuerId);

    // 4. Duplicate registration within the SAME role must be rejected
    await expect(
      caller.auth.register({
        name: "Ayushi Citizen Duplicate",
        email: testEmail,
        password: "AnotherPassword999",
        role: "user",
      })
    ).rejects.toThrowError(TRPCError);

    await expect(
      caller.auth.register({
        name: "Ayushi Rescuer Duplicate",
        email: testEmail,
        password: "AnotherPassword999",
        role: "rescuer",
        governmentCode: rescuerCode,
      })
    ).rejects.toThrowError(TRPCError);
  });

  it("authenticates each role account independently using its own portal and password", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `test_multirole_${Date.now()}@example.com`;
    const citizenPassword = "PasswordCitizen!1";
    const rescuerPassword = "PasswordRescuer!2";
    const rescuerCode = "ASSAM-RESC-MULTITEST-2";
    const hospitalCode = "ASSAM-HOSP-MULTITEST-2";
    await setRoleAccessCode("rescuer", rescuerCode, 1);
    await setRoleAccessCode("hospital", hospitalCode, 1);

    // Register Citizen
    await caller.auth.register({
      name: "Citizen User",
      email: testEmail,
      password: citizenPassword,
      role: "user",
    });

    // Register Rescuer
    await caller.auth.register({
      name: "Rescuer Officer",
      email: testEmail,
      password: rescuerPassword,
      role: "rescuer",
      governmentCode: rescuerCode,
      callSign: "Guwahati Marine 1",
    });

    // 1. Citizen login with Citizen credentials succeeds
    const citizenLogin = await caller.auth.login({
      email: testEmail,
      password: citizenPassword,
      role: "user",
    });
    expect(citizenLogin.success).toBe(true);
    expect(citizenLogin.user.role).toBe("user");

    // 2. Rescuer login with Rescuer credentials and code succeeds
    const rescuerLogin = await caller.auth.login({
      email: testEmail,
      password: rescuerPassword,
      role: "rescuer",
      governmentCode: rescuerCode,
    });
    expect(rescuerLogin.success).toBe(true);
    expect(rescuerLogin.user.role).toBe("rescuer");

    // 3. Attempting to log into Citizen portal with Rescuer password MUST fail
    await expect(
      caller.auth.login({
        email: testEmail,
        password: rescuerPassword,
        role: "user",
      })
    ).rejects.toThrowError(TRPCError);

    // 4. Attempting to log into Rescuer portal with Citizen password MUST fail
    await expect(
      caller.auth.login({
        email: testEmail,
        password: citizenPassword,
        role: "rescuer",
        governmentCode: rescuerCode,
      })
    ).rejects.toThrowError(TRPCError);

    // 5. Attempting to log into Hospital portal (where this email has no account) MUST fail
    await expect(
      caller.auth.login({
        email: testEmail,
        password: citizenPassword,
        role: "hospital",
        governmentCode: hospitalCode,
      })
    ).rejects.toThrowError(TRPCError);
  });
});
