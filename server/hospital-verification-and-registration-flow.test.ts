import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import {
  _memoryHospitals,
  _memoryHospitalRequests,
  _memoryHospitalStaffProfiles,
  _memoryUsers,
  listHospitals,
} from "./rescue.db";
import {
  setRoleAccessCode,
  upsertUser,
  getUserByEmail,
} from "./db";
import { hashPassword } from "./auth.password";
import { getBranchesForOwner } from "./services/hospitalBranches";
import { discoverNearbyHospitals } from "./services/nearbyHospitals";

function createTrpcCaller(user?: any, portal?: "citizen" | "rescuer" | "hospital" | "admin") {
  const cookies: Record<string, string> = {};
  return {
    caller: appRouter.createCaller({
      user: user || null,
      portal: portal || undefined,
      req: {
        headers: {},
        cookies,
        protocol: "http",
      } as any,
      res: {
        cookie: (name: string, val: string) => {
          cookies[name] = val;
        },
        clearCookie: (name: string) => {
          delete cookies[name];
        },
      } as any,
    }),
    cookies,
  };
}

describe("End-to-End Hospital Verification, Approval, and Live Capacity Lifecycle", () => {
  beforeEach(async () => {
    _memoryHospitals.clear();
    _memoryHospitalRequests.clear();
    _memoryHospitalStaffProfiles.clear();
    await setRoleAccessCode("hospital", "HOSP-VERIFY-2026", 1);
  });

  it("completes full flow: Citizen requests hospital -> Admin approves -> Hospital officer logs in & updates live resources -> Citizen discovers verified hospital", async () => {
    const timestamp = Date.now();
    const citizenEmail = `facility.admin.${timestamp}@guwahaticlinic.org`;
    const password = "HospitalPassword!2026";

    // 1. Citizen registers on the platform
    const { caller: publicCaller } = createTrpcCaller(null, "citizen");
    const regResult = await publicCaller.auth.register({
      name: "Dr. Himanta Deka",
      email: citizenEmail,
      password,
      role: "user",
      portal: "citizen",
    });

    expect(regResult.success).toBe(true);
    expect(regResult.user.role).toBe("user");
    const citizenUserId = regResult.user.id;

    // 2. Citizen submits Hospital Registration for verification
    const { caller: citizenCaller } = createTrpcCaller(regResult.user, "citizen");
    const requestResult = await citizenCaller.rescue.hospital.requestRegistration({
      hospitalName: "Brahmaputra Emergency Trauma Care",
      address: "GS Road, Dispur, Guwahati, Assam 781005",
      contactPhone: "+91 361 223344",
      latitude: 26.1445,
      longitude: 91.7362,
      note: "NABH accredited trauma center with 24/7 cardiac ICU",
    });

    expect(requestResult.success).toBe(true);
    expect(requestResult.requestId).toBeDefined();

    // Verify request is pending
    const statusQuery = await citizenCaller.rescue.hospital.mine();
    expect(statusQuery).toBeDefined();
    expect(statusQuery?.hospitalName).toBe("Brahmaputra Emergency Trauma Care");
    expect(statusQuery?.status).toBe("pending");

    // 3. Admin views pending hospital requests in Admin Command
    const adminUser = {
      id: 1,
      openId: "user-admin",
      name: "State Command Administrator",
      email: "admin@assamrescue.gov.in",
      role: "admin" as const,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { caller: adminCaller } = createTrpcCaller(adminUser, "admin");

    const pendingRequests = await adminCaller.rescue.operations.hospitalRegistrationRequests();
    const targetRequest = pendingRequests.find((r) => r.request.id === requestResult.requestId);
    expect(targetRequest).toBeDefined();
    expect(targetRequest?.request.hospitalName).toBe("Brahmaputra Emergency Trauma Care");

    // 4. Admin reviews and approves the hospital registration
    const reviewResult = await adminCaller.rescue.operations.reviewHospitalRegistration({
      requestId: requestResult.requestId,
      decision: "approved",
      designation: "Chief Medical Officer",
      reviewNote: "Verified with State Health Directorate registry.",
    });

    expect(reviewResult.success).toBe(true);
    expect(reviewResult.hospitalId).toBeDefined();

    // 5. The user's role is now promoted to "hospital"
    const updatedUser = await getUserByEmail(citizenEmail, "hospital");
    expect(updatedUser).toBeDefined();
    expect(updatedUser?.role).toBe("hospital");

    // 6. Hospital officer logs in to Hospital Portal using credentials + active Government Access Code
    const { caller: hospitalLoginCaller, cookies: hospitalCookies } = createTrpcCaller(null, "hospital");
    const hospitalLoginResult = await hospitalLoginCaller.auth.login({
      email: citizenEmail,
      password,
      role: "hospital",
      portal: "hospital",
      governmentCode: "HOSP-VERIFY-2026",
    });

    expect(hospitalLoginResult.success).toBe(true);
    expect(hospitalLoginResult.user.role).toBe("hospital");
    expect(hospitalCookies["app_session_hospital"]).toBeDefined();

    // 7. Hospital officer queries their registered branches
    const sessionPayload = await sdk.verifySession(hospitalCookies["app_session_hospital"]);
    const hospitalSessionUser = {
      ...updatedUser!,
      role: "hospital" as const,
      codeVersion: sessionPayload?.codeVersion ?? 1,
    };
    const { caller: hospitalDeskCaller } = createTrpcCaller(hospitalSessionUser, "hospital");
    const myBranches = await hospitalDeskCaller.rescue.operations.myBranches();
    expect(myBranches.length).toBeGreaterThanOrEqual(1);

    const activeBranch = myBranches[0];
    expect(activeBranch.name).toContain("Brahmaputra Emergency Trauma Care");
    expect(activeBranch.latitude).toBeCloseTo(26.1445, 3);
    expect(activeBranch.longitude).toBeCloseTo(91.7362, 3);

    // 8. Hospital officer updates live capacity and essential supplies
    const updateResult = await hospitalDeskCaller.rescue.operations.updateMyHospitalResources({
      id: activeBranch.id,
      availableEmergencyBeds: 25,
      availableIcuBeds: 8,
      oxygenCylinderCount: 40,
      bloodUnitCount: 18,
      ambulanceCount: 3,
      foodSupplyStatus: "available",
      medicineSupplyStatus: "available",
      waterSupplyStatus: "available",
      powerBackupStatus: "available",
      status: "open",
    });

    expect(updateResult.success).toBe(true);

    // 9. Citizen and Rescuers discover the newly verified hospital in real time
    const discovery = await discoverNearbyHospitals({
      lat: 26.1500, // Near Guwahati
      lng: 91.7400,
      radiusKm: 25,
      includePublicDirectory: false,
    });

    expect(discovery.hospitals.length).toBeGreaterThanOrEqual(1);
    const discovered = discovery.hospitals.find((h) => h.id === activeBranch.id);
    expect(discovered).toBeDefined();
    expect(discovered?.isSahayVerified).toBe(true);
    expect(discovered?.availableEmergencyBeds).toBe(25);
    expect(discovered?.availableIcuBeds).toBe(8);
    expect(discovered?.oxygenCylinderCount).toBe(40);
    expect(discovered?.legacyStatus).toBe("open");

    // 10. Confirm independent session isolation: logging out the hospital portal does NOT destroy citizen session
    const citizenSessionToken = await sdk.createSessionToken(regResult.user.openId, {
      name: "Dr. Himanta Deka",
      portal: "citizen",
    });
    const { caller: multiSessionCaller, cookies: multiCookies } = createTrpcCaller(hospitalSessionUser, "hospital");
    multiCookies["app_session_citizen"] = citizenSessionToken;
    multiCookies["app_session_hospital"] = hospitalCookies["app_session_hospital"];

    // Hospital logs out
    await multiSessionCaller.auth.logout({ portal: "hospital" });

    // Hospital session cookie cleared, Citizen session remains completely intact
    expect(multiCookies["app_session_hospital"]).toBeUndefined();
    expect(multiCookies["app_session_citizen"]).toBe(citizenSessionToken);
  });
});
