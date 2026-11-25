import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getPanIndiaHospitals, findNearbyPanIndiaHospitals } from "./data/panIndiaHospitals";
import { discoverNearbyHospitals } from "./services/nearbyHospitals";
import { getRoleCodeVersion } from "./db";
import { _memoryUsers, _memoryIncidents, _memoryRescueProfiles, _memoryHospitals, _memoryMissionOffers, _memoryHospitalCaseNotifications } from "./rescue.db";

describe("Pan-India Hospital Dataset & SOS Rescuer-Hospital Workflow", () => {
  it("should have at least 250 verified hospitals per Indian state across all 36 States & UTs", () => {
    const allHospitals = getPanIndiaHospitals();
    expect(allHospitals.length).toBeGreaterThanOrEqual(9000);

    const stateCounts = new Map<string, number>();
    for (const h of allHospitals) {
      stateCounts.set(h.state, (stateCounts.get(h.state) || 0) + 1);
    }

    expect(stateCounts.size).toBe(36);
    for (const [state, count] of Array.from(stateCounts.entries())) {
      expect(count, `State ${state} should have >= 250 hospitals`).toBeGreaterThanOrEqual(250);
    }
  });

  it("should query nearby Pan-India hospitals efficiently with bounding box + haversine", () => {
    // Delhi coordinates: 28.6139, 77.2090
    const nearbyDelhi = findNearbyPanIndiaHospitals(28.6139, 77.209, 30, 10);
    expect(nearbyDelhi.length).toBeGreaterThan(0);
    for (const h of nearbyDelhi) {
      expect(h.distanceKm).toBeLessThanOrEqual(30);
    }
    // Verify distance is sorted ascending
    for (let i = 1; i < nearbyDelhi.length; i++) {
      expect(nearbyDelhi[i].distanceKm).toBeGreaterThanOrEqual(nearbyDelhi[i - 1].distanceKm);
    }

    // Mumbai coordinates: 19.0760, 72.8777
    const nearbyMumbai = findNearbyPanIndiaHospitals(19.076, 72.8777, 30, 10);
    expect(nearbyMumbai.length).toBeGreaterThan(0);
    expect(nearbyMumbai[0].state).toBe("Maharashtra");

    // Guwahati coordinates: 26.1445, 91.7362
    const nearbyAssam = findNearbyPanIndiaHospitals(26.1445, 91.7362, 50, 10);
    expect(nearbyAssam.length).toBeGreaterThan(0);
    expect(nearbyAssam[0].state).toBe("Assam");
  }); ``

  it("should provide hospitals to Citizen panel when GPS is unavailable (allRegistered=true)", async () => {
    const discovery = await discoverNearbyHospitals({
      lat: null,
      lng: null,
      radiusKm: 50,
      allRegistered: true,
      includePublicDirectory: false,
    });

    expect(discovery.hospitals.length).toBeGreaterThanOrEqual(50);
    expect(discovery.hospitals[0].isSahayVerified).toBe(true);
  });

  it("should execute end-to-end SOS flow: Citizen triggers SOS -> Rescuer alerted -> Hospital notified -> Rescuer responds", async () => {
    // 1. Setup Active Rescuer in Guwahati
    const rescuerCodeVersion = await getRoleCodeVersion("rescuer");
    const rescuerUser = {
      id: 99101,
      openId: "rescuer_test_99101",
      name: "Guwahati First Responder",
      email: "first.responder@assamrescue.gov.in",
      password: "hash",
      loginMethod: "password",
      role: "rescuer" as const,
      status: "active" as const,
      codeVersion: rescuerCodeVersion,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    _memoryUsers.set(String(rescuerUser.id), rescuerUser);
    _memoryUsers.set(rescuerUser.openId, rescuerUser);
    _memoryRescueProfiles.set(rescuerUser.id, {
      id: 99101,
      userId: rescuerUser.id,
      callSign: "EAGLE-1",
      category: "medical",
      phone: "+919876543210",
      photoKey: null,
      photoUrl: null,
      contactSharing: "yes",
      locationSharing: "yes",
      availability: "available",
      lastLatitude: 26.1445,
      lastLongitude: 91.7362,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Setup Registered Hospital in Guwahati
    const hospitalCodeVersion = await getRoleCodeVersion("hospital");
    const hospitalUser = {
      id: 99201,
      openId: "hospital_test_99201",
      name: "Guwahati Medical Officer",
      email: "er.desk@gmch.gov.in",
      password: "hash",
      loginMethod: "password",
      role: "hospital" as const,
      status: "active" as const,
      codeVersion: hospitalCodeVersion,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    _memoryUsers.set(String(hospitalUser.id), hospitalUser);
    _memoryUsers.set(hospitalUser.openId, hospitalUser);
    _memoryHospitals.set(99201, {
      id: 99201,
      ownerUserId: hospitalUser.id,
      organizationName: "Guwahati Medical College & Hospital",
      branchName: "Emergency Block",
      isPrimaryBranch: true,
      name: "Guwahati Medical College Hospital",
      address: "Bhangagarh, Guwahati, Assam 781032",
      contactPhone: "+913612529457",
      latitude: 26.1584,
      longitude: 91.7709,
      totalEmergencyBeds: 50,
      availableEmergencyBeds: 22,
      totalIcuBeds: 20,
      availableIcuBeds: 8,
      oxygenCylinderCount: 45,
      bloodUnitCount: 60,
      ambulanceCount: 5,
      foodSupplyStatus: "available",
      medicineSupplyStatus: "available",
      waterSupplyStatus: "available",
      powerBackupStatus: "available",
      status: "open",
      isSahayVerified: true,
      updatedBy: null,
      updatedAt: new Date(),
    });

    // 3. Citizen triggers SOS near Guwahati
    const citizenUser = {
      id: 99301,
      openId: "citizen_test_99301",
      name: "Bikash Sharma",
      email: "bikash@example.com",
      password: "hash",
      loginMethod: "password",
      role: "user" as const,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    _memoryUsers.set(String(citizenUser.id), citizenUser);
    _memoryUsers.set(citizenUser.openId, citizenUser);

    const citizenCaller = appRouter.createCaller({
      user: citizenUser,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: { cookie: () => { }, clearCookie: () => { } } as any,
    });

    const sosResult = await citizenCaller.rescue.emergency.create({
      emergencyType: "medical",
      severity: "high",
      peopleAffected: 2,
      locationLabel: "Near ABC Bus Stand, GS Road, Guwahati",
      latitude: 26.151,
      longitude: 91.775,
      notes: "Severe trauma after flash flooding, victim requires immediate extraction.",
    });

    expect(sosResult.incidentId).toBeDefined();
    expect(sosResult.publicCode).toMatch(/^SOS-[A-Z0-9]+$/);
    expect(sosResult.status).toBe("pending");

    // 4. Verify Rescuer can query and view the new emergency incident details
    const rescuerCaller = appRouter.createCaller({
      user: rescuerUser,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: { cookie: () => { }, clearCookie: () => { } } as any,
    });

    const incidentDetails = await rescuerCaller.rescue.emergency.statusByCode({
      publicCode: sosResult.publicCode,
    });
    expect(incidentDetails).toBeDefined();
    expect(incidentDetails.publicCode).toBe(sosResult.publicCode);
    expect(incidentDetails.locationLabel).toContain("Guwahati");

    // 5. Verify nearby hospital received inbound case notification
    const hospitalCaller = appRouter.createCaller({
      user: hospitalUser,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: { cookie: () => { }, clearCookie: () => { } } as any,
    });

    const incomingCases = await hospitalCaller.rescue.operations.hospitalCases({
      branchId: 99201,
      includeAllBranches: true,
    });
    expect(incomingCases.length).toBeGreaterThan(0);
    const caseRecord = incomingCases.find(c => c.incident.id === sosResult.incidentId);
    expect(caseRecord).toBeDefined();
    expect(caseRecord?.notification.status).toBe("notified");

    // 6. Hospital staff updates case status to 'preparing' and updates live beds
    const caseUpdate = await hospitalCaller.rescue.operations.updateHospitalCaseStatus({
      notificationId: caseRecord!.notification.id,
      status: "preparing",
      hospitalNotes: "Trauma team dispatched to ER Bay 3, oxygen ready.",
    });
    expect(caseUpdate.success).toBe(true);

    const resourceUpdate = await hospitalCaller.rescue.operations.updateMyHospitalResources({
      id: 99201,
      availableEmergencyBeds: 21,
      availableIcuBeds: 8,
      oxygenCylinderCount: 44,
      bloodUnitCount: 60,
      ambulanceCount: 4,
      foodSupplyStatus: "available",
      medicineSupplyStatus: "available",
      waterSupplyStatus: "available",
      powerBackupStatus: "available",
      status: "open",
    });
    expect(resourceUpdate.success).toBe(true);
  });
});
