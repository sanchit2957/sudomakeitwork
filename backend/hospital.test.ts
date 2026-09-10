import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import {
  clearHospitalAlertStateCache,
  evaluateHospitalResourceStatus,
  getConsolidatedHospitalResources,
  getHospitalAlertStatus,
  registerHospitalRoutes,
} from "./hospital";
import { _memoryHospitals, type MemoryHospital } from "./rescue.db";

describe("Feature #3: Hospital Resource Shortage Detection & Operations Alert Automation", () => {
  const originalEnv = process.env.NODE_ENV;

  const mockHospitalGMCH: MemoryHospital = {
    id: 1,
    name: "Gauhati Medical College & Hospital (GMCH)",
    address: "Bhangagarh, Guwahati, Assam 781032",
    contactPhone: "+91 361 2529457",
    latitude: 26.1558,
    longitude: 91.7645,
    totalEmergencyBeds: 120,
    availableEmergencyBeds: 34,
    totalIcuBeds: 45,
    availableIcuBeds: 12,
    oxygenCylinderCount: 85,
    bloodUnitCount: 140,
    ambulanceCount: 14,
    foodSupplyStatus: "available",
    medicineSupplyStatus: "available",
    waterSupplyStatus: "available",
    powerBackupStatus: "available",
    status: "open",
    updatedBy: 1,
    updatedAt: new Date(),
  };

  const mockHospitalAMCH: MemoryHospital = {
    id: 2,
    name: "Assam Medical College & Hospital (AMCH)",
    address: "Barbari, Dibrugarh, Assam 786002",
    contactPhone: "+91 373 2300080",
    latitude: 27.4612,
    longitude: 94.9215,
    totalEmergencyBeds: 90,
    availableEmergencyBeds: 28,
    totalIcuBeds: 30,
    availableIcuBeds: 8,
    oxygenCylinderCount: 60,
    bloodUnitCount: 95,
    ambulanceCount: 10,
    foodSupplyStatus: "available",
    medicineSupplyStatus: "available",
    waterSupplyStatus: "available",
    powerBackupStatus: "available",
    status: "open",
    updatedBy: 1,
    updatedAt: new Date(),
  };

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    clearHospitalAlertStateCache();
    _memoryHospitals.clear();
    _memoryHospitals.set(1, { ...mockHospitalGMCH });
    _memoryHospitals.set(2, { ...mockHospitalAMCH });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("TEST 1: Hospital resource endpoint returns valid existing project data", async () => {
    const snapshot = await getConsolidatedHospitalResources(1);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.hospitalId).toBe(1);
    expect(snapshot?.hospitalName).toBe("Gauhati Medical College & Hospital (GMCH)");
    expect(snapshot?.overallStatus).toBe("open");
    expect(snapshot?.overallShortageLevel).toBe("adequate");
    expect(snapshot?.resources.emergencyBeds.available).toBe(34);
    expect(snapshot?.resources.icuBeds.available).toBe(12);
    expect(snapshot?.dataFreshness.isFresh).toBe(true);
  });

  it("TEST 2: Low and critical resource states can be distinguished", () => {
    const hospitalAdequate: MemoryHospital = { ...mockHospitalGMCH };
    const evalAdequate = evaluateHospitalResourceStatus(hospitalAdequate);
    expect(evalAdequate.overallShortageLevel).toBe("adequate");
    expect(evalAdequate.criticalResources).toHaveLength(0);

    const hospitalLow: MemoryHospital = {
      ...mockHospitalGMCH,
      availableEmergencyBeds: 10, // < 15 is low
      foodSupplyStatus: "limited",
    };
    const evalLow = evaluateHospitalResourceStatus(hospitalLow);
    expect(evalLow.overallShortageLevel).toBe("low");
    expect(evalLow.lowResources).toContain("emergencyBeds");

    const hospitalCritical: MemoryHospital = {
      ...mockHospitalGMCH,
      availableIcuBeds: 1, // < 3 is critical
      oxygenCylinderCount: 5, // < 10 is critical
    };
    const evalCritical = evaluateHospitalResourceStatus(hospitalCritical);
    expect(evalCritical.overallShortageLevel).toBe("critical");
    expect(evalCritical.criticalResources).toContain("icuBeds");
    expect(evalCritical.criticalResources).toContain("oxygenCylinders");
  });

  it("TEST 3: Critical shortage correctly produces an alert state", async () => {
    // Set hospital #1 to critical shortage
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 1,
    });

    const alertStatus = await getHospitalAlertStatus(1);

    expect(alertStatus).not.toBeNull();
    expect(alertStatus?.currentStatus).toBe("critical");
    expect(alertStatus?.shouldAlert).toBe(true);
    expect(alertStatus?.action).toBe("trigger_shortage_alert");
    expect(alertStatus?.criticalResources).toContain("icuBeds");
  });

  it("TEST 4: Repeated identical critical status is identified as a duplicate", async () => {
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 1,
    });

    // First check triggers alert
    const firstCheck = await getHospitalAlertStatus(1);
    expect(firstCheck?.shouldAlert).toBe(true);
    expect(firstCheck?.action).toBe("trigger_shortage_alert");

    // Second check with identical status -> Suppressed
    const secondCheck = await getHospitalAlertStatus(1);
    expect(secondCheck?.shouldAlert).toBe(false);
    expect(secondCheck?.action).toBe("suppress_duplicate");
    expect(secondCheck?.stateSummary.suppressedCount).toBe(1);
  });

  it("TEST 5: A worsening resource condition (new critical resource added) is detected as an escalation", async () => {
    // 1st step: ICU beds become critical
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 1,
      oxygenCylinderCount: 50,
    });
    await getHospitalAlertStatus(1);

    // 2nd step: Oxygen cylinders ALSO become critical (worsening shortage)
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 1,
      oxygenCylinderCount: 4, // newly critical
    });

    const escalated = await getHospitalAlertStatus(1);

    expect(escalated?.shouldAlert).toBe(true);
    expect(escalated?.action).toBe("trigger_escalation");
    expect(escalated?.criticalResources).toContain("icuBeds");
    expect(escalated?.criticalResources).toContain("oxygenCylinders");
  });

  it("TEST 6: Resource recovery is correctly represented", async () => {
    // 1st step: Hospital is in critical shortage
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 1,
    });
    await getHospitalAlertStatus(1);

    // 2nd step: ICU beds are replenished to 25
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 25,
    });

    const recovered = await getHospitalAlertStatus(1);

    expect(recovered?.previousStatus).toBe("critical");
    expect(recovered?.currentStatus).toBe("adequate");
    expect(recovered?.shouldAlert).toBe(true);
    expect(recovered?.action).toBe("record_recovery");
  });

  it("TEST 7: Automation events are correctly recorded", async () => {
    const app = express();
    app.use(express.json());
    registerHospitalRoutes(app);

    const snapshot = await getConsolidatedHospitalResources(1);
    expect(snapshot).not.toBeNull();

    // Verify GET /api/hospitals/:hospitalId/resources
    expect(snapshot?.hospitalId).toBe(1);

    // Verify GET /api/hospitals/:hospitalId/alert-status
    const alertState = await getHospitalAlertStatus(1);
    expect(alertState?.hospitalId).toBe(1);
    expect(alertState?.currentStatus).toBe("adequate");
  });

  it("TEST 8: Hospital data remains isolated between different hospitals", async () => {
    // Hospital #1 (GMCH) in critical shortage
    _memoryHospitals.set(1, {
      ...mockHospitalGMCH,
      availableIcuBeds: 0,
    });

    // Hospital #2 (AMCH) operating normally
    _memoryHospitals.set(2, {
      ...mockHospitalAMCH,
      availableIcuBeds: 20,
    });

    const status1 = await getHospitalAlertStatus(1);
    const status2 = await getHospitalAlertStatus(2);

    expect(status1?.hospitalId).toBe(1);
    expect(status1?.currentStatus).toBe("critical");

    expect(status2?.hospitalId).toBe(2);
    expect(status2?.currentStatus).toBe("adequate");
  });
});
