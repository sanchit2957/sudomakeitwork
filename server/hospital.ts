import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { hospitals } from "../drizzle/schema";
import { writeAudit, listHospitals, _memoryHospitals, type MemoryHospital } from "./rescue.db";

export type ShortageLevel = "adequate" | "low" | "critical" | "unknown";

export interface HospitalResourceDetails {
  emergencyBeds: { available: number; total: number; status: "adequate" | "low" | "critical" };
  icuBeds: { available: number; total: number; status: "adequate" | "low" | "critical" };
  oxygenCylinders: { count: number; status: "adequate" | "low" | "critical" };
  bloodUnits: { count: number; status: "adequate" | "low" | "critical" };
  ambulances: { count: number; status: "adequate" | "low" | "critical" };
}

export interface HospitalSupplyDetails {
  medicine: "available" | "limited" | "critical" | "unavailable";
  food: "available" | "limited" | "critical" | "unavailable";
  water: "available" | "limited" | "critical" | "unavailable";
  powerBackup: "available" | "limited" | "critical" | "unavailable";
}

export interface HospitalAlertState {
  hospitalId: number;
  previousShortageLevel: ShortageLevel;
  lastAlertedShortageLevel: ShortageLevel | null;
  lastAlertedCriticalResources: string[];
  lastAlertedAt: string | null;
  suppressedCount: number;
  lastEvaluatedAt: string;
}

const _hospitalAlertStates = new Map<number, HospitalAlertState>();

export function clearHospitalAlertStateCache(): void {
  _hospitalAlertStates.clear();
}

/**
 * Evaluates individual resource and supply shortage levels for a hospital.
 */
export function evaluateHospitalResourceStatus(hospital: MemoryHospital) {
  const criticalResources: string[] = [];
  const lowResources: string[] = [];

  // Emergency Beds Evaluation
  let emergencyBedsStatus: "adequate" | "low" | "critical" = "adequate";
  if (hospital.availableEmergencyBeds < 5) {
    emergencyBedsStatus = "critical";
    criticalResources.push("emergencyBeds");
  } else if (hospital.availableEmergencyBeds < 15) {
    emergencyBedsStatus = "low";
    lowResources.push("emergencyBeds");
  }

  // ICU Beds Evaluation
  let icuBedsStatus: "adequate" | "low" | "critical" = "adequate";
  if (hospital.availableIcuBeds < 3) {
    icuBedsStatus = "critical";
    criticalResources.push("icuBeds");
  } else if (hospital.availableIcuBeds < 8) {
    icuBedsStatus = "low";
    lowResources.push("icuBeds");
  }

  // Oxygen Cylinders Evaluation
  let oxygenStatus: "adequate" | "low" | "critical" = "adequate";
  if (hospital.oxygenCylinderCount < 10) {
    oxygenStatus = "critical";
    criticalResources.push("oxygenCylinders");
  } else if (hospital.oxygenCylinderCount < 25) {
    oxygenStatus = "low";
    lowResources.push("oxygenCylinders");
  }

  // Blood Units Evaluation
  let bloodStatus: "adequate" | "low" | "critical" = "adequate";
  if (hospital.bloodUnitCount < 15) {
    bloodStatus = "critical";
    criticalResources.push("bloodUnits");
  } else if (hospital.bloodUnitCount < 40) {
    bloodStatus = "low";
    lowResources.push("bloodUnits");
  }

  // Ambulances Evaluation
  let ambulanceStatus: "adequate" | "low" | "critical" = "adequate";
  if (hospital.ambulanceCount < 2) {
    ambulanceStatus = "critical";
    criticalResources.push("ambulances");
  } else if (hospital.ambulanceCount < 5) {
    ambulanceStatus = "low";
    lowResources.push("ambulances");
  }

  // Supplies Evaluation
  const evalSupply = (key: string, val: string) => {
    if (val === "critical" || val === "unavailable") {
      criticalResources.push(key);
    } else if (val === "limited") {
      lowResources.push(key);
    }
  };

  evalSupply("medicineSupply", hospital.medicineSupplyStatus);
  evalSupply("foodSupply", hospital.foodSupplyStatus);
  evalSupply("waterSupply", hospital.waterSupplyStatus);
  evalSupply("powerBackup", hospital.powerBackupStatus);

  // Overall Facility Status Evaluation
  let overallShortageLevel: ShortageLevel = "adequate";
  if (hospital.status === "critical" || hospital.status === "closed" || criticalResources.length > 0) {
    overallShortageLevel = "critical";
  } else if (hospital.status === "limited" || lowResources.length > 0) {
    overallShortageLevel = "low";
  }

  const details: { resources: HospitalResourceDetails; supplies: HospitalSupplyDetails } = {
    resources: {
      emergencyBeds: { available: hospital.availableEmergencyBeds, total: hospital.totalEmergencyBeds, status: emergencyBedsStatus },
      icuBeds: { available: hospital.availableIcuBeds, total: hospital.totalIcuBeds, status: icuBedsStatus },
      oxygenCylinders: { count: hospital.oxygenCylinderCount, status: oxygenStatus },
      bloodUnits: { count: hospital.bloodUnitCount, status: bloodStatus },
      ambulances: { count: hospital.ambulanceCount, status: ambulanceStatus },
    },
    supplies: {
      medicine: hospital.medicineSupplyStatus,
      food: hospital.foodSupplyStatus,
      water: hospital.waterSupplyStatus,
      powerBackup: hospital.powerBackupStatus,
    },
  };

  return {
    overallShortageLevel,
    criticalResources,
    lowResources,
    details,
  };
}

/**
 * Returns a consolidated snapshot of hospital resources and shortage evaluation.
 */
export async function getConsolidatedHospitalResources(hospitalId: number) {
  let hospital: MemoryHospital | null = null;
  try {
    const db = await getDb();
    if (db) {
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
      if (rows.length > 0) hospital = rows[0] as any;
    }
  } catch {}

  if (!hospital) {
    hospital = _memoryHospitals.get(hospitalId) || null;
  }

  if (!hospital) {
    return null;
  }

  const evaluation = evaluateHospitalResourceStatus(hospital);
  const isFresh = Boolean(hospital.updatedAt);

  return {
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    address: hospital.address,
    contactPhone: hospital.contactPhone,
    latitude: hospital.latitude,
    longitude: hospital.longitude,
    timestamp: new Date().toISOString(),
    overallStatus: hospital.status,
    overallShortageLevel: evaluation.overallShortageLevel,
    criticalResources: evaluation.criticalResources,
    lowResources: evaluation.lowResources,
    resources: evaluation.details.resources,
    supplies: evaluation.details.supplies,
    dataFreshness: {
      isFresh,
      lastUpdated: hospital.updatedAt ? new Date(hospital.updatedAt).toISOString() : new Date().toISOString(),
      updatedBy: hospital.updatedBy ?? null,
    },
  };
}

/**
 * Evaluates current hospital resource status against historical alert state for duplicate suppression & escalation.
 */
export async function getHospitalAlertStatus(hospitalId: number) {
  const snapshot = await getConsolidatedHospitalResources(hospitalId);
  if (!snapshot) {
    return null;
  }

  let state = _hospitalAlertStates.get(hospitalId);
  if (!state) {
    state = {
      hospitalId,
      previousShortageLevel: "adequate",
      lastAlertedShortageLevel: null,
      lastAlertedCriticalResources: [],
      suppressedCount: 0,
      lastAlertedAt: null,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }

  const currentLevel = snapshot.overallShortageLevel;
  const previousLevel = state.previousShortageLevel;

  let shouldAlert = false;
  let action:
    | "trigger_shortage_alert"
    | "trigger_escalation"
    | "suppress_duplicate"
    | "record_recovery"
    | "record_monitoring"
    | "monitoring_adequate" = "monitoring_adequate";
  let reason = "Hospital resources are within adequate operating bounds.";

  if (currentLevel === "adequate" || currentLevel === "low") {
    if (previousLevel === "critical") {
      action = "record_recovery";
      shouldAlert = true;
      reason = `Hospital resource recovery detected! Shortage level reduced from CRITICAL to ${currentLevel.toUpperCase()}.`;
    } else if (currentLevel === "low") {
      action = "record_monitoring";
      shouldAlert = false;
      reason = `Low hospital resource levels detected (${snapshot.lowResources.join(", ")}). Monitoring active.`;
    } else {
      action = "monitoring_adequate";
      shouldAlert = false;
      reason = "Hospital resources are adequate.";
    }
  } else if (currentLevel === "critical") {
    // Check if new critical resources appeared compared to last alerted set
    const currentCriticalSorted = [...snapshot.criticalResources].sort();
    const lastAlertedSorted = [...state.lastAlertedCriticalResources].sort();

    const hasNewCriticalResource = currentCriticalSorted.some(r => !lastAlertedSorted.includes(r));

    if (hasNewCriticalResource && state.lastAlertedCriticalResources.length > 0) {
      action = "trigger_escalation";
      shouldAlert = true;
      reason = `Shortage worsened! Additional critical resources detected: [${currentCriticalSorted.filter(r => !lastAlertedSorted.includes(r)).join(", ")}]. Triggering Escalation.`;
    } else if (previousLevel === "critical") {
      action = "suppress_duplicate";
      shouldAlert = false;
      reason = `Duplicate shortage alert suppressed. Hospital remains in CRITICAL state for [${currentCriticalSorted.join(", ")}].`;
      state.suppressedCount++;
    } else {
      action = "trigger_shortage_alert";
      shouldAlert = true;
      reason = `Critical hospital resource shortage detected for [${currentCriticalSorted.join(", ")}]. Triggering Operations Alert.`;
    }
  }

  // Update tracking state
  state.previousShortageLevel = currentLevel;
  state.lastEvaluatedAt = new Date().toISOString();
  if (shouldAlert) {
    state.lastAlertedShortageLevel = currentLevel;
    state.lastAlertedCriticalResources = [...snapshot.criticalResources];
    state.lastAlertedAt = new Date().toISOString();
  }
  _hospitalAlertStates.set(hospitalId, state);

  return {
    hospitalId: snapshot.hospitalId,
    hospitalName: snapshot.hospitalName,
    shouldAlert,
    action,
    reason,
    previousStatus: previousLevel,
    currentStatus: currentLevel,
    criticalResources: snapshot.criticalResources,
    lowResources: snapshot.lowResources,
    dataFreshness: snapshot.dataFreshness,
    timestamp: new Date().toISOString(),
    stateSummary: {
      lastAlertedShortageLevel: state.lastAlertedShortageLevel,
      lastAlertedCriticalResources: state.lastAlertedCriticalResources,
      lastAlertedAt: state.lastAlertedAt,
      suppressedCount: state.suppressedCount,
    },
    snapshot,
  };
}

/**
 * Registers REST API endpoints for hospital resource querying, shortage alert status, and automation event logging.
 */
export function registerHospitalRoutes(app: Express) {
  // GET /api/hospitals
  app.get("/api/hospitals", async (_req: Request, res: Response) => {
    try {
      const all = await listHospitals();
      const summaryList = await Promise.all(
        all.map(async (h) => {
          const snapshot = await getConsolidatedHospitalResources(h.id);
          return {
            hospitalId: h.id,
            hospitalName: h.name,
            overallStatus: h.status,
            overallShortageLevel: snapshot?.overallShortageLevel ?? "unknown",
            criticalResourcesCount: snapshot?.criticalResources.length ?? 0,
            lowResourcesCount: snapshot?.lowResources.length ?? 0,
            updatedAt: h.updatedAt,
          };
        })
      );
      return res.json({ count: summaryList.length, hospitals: summaryList });
    } catch (err: any) {
      console.error("[REST API] Error listing hospitals:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/hospitals/:hospitalId/resources
  app.get("/api/hospitals/:hospitalId/resources", async (req: Request, res: Response) => {
    try {
      const rawId = req.params.hospitalId;
      const hospitalId = parseInt(rawId, 10);
      if (Number.isNaN(hospitalId)) {
        return res.status(400).json({ error: "Invalid hospitalId parameter." });
      }

      const snapshot = await getConsolidatedHospitalResources(hospitalId);
      if (!snapshot) {
        return res.status(404).json({ error: "Hospital not found" });
      }

      return res.json(snapshot);
    } catch (err: any) {
      console.error("[REST API] Error fetching hospital resources:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/hospitals/:hospitalId/alert-status
  app.get("/api/hospitals/:hospitalId/alert-status", async (req: Request, res: Response) => {
    try {
      const rawId = req.params.hospitalId;
      const hospitalId = parseInt(rawId, 10);
      if (Number.isNaN(hospitalId)) {
        return res.status(400).json({ error: "Invalid hospitalId parameter." });
      }

      const status = await getHospitalAlertStatus(hospitalId);
      if (!status) {
        return res.status(404).json({ error: "Hospital not found" });
      }

      return res.json(status);
    } catch (err: any) {
      console.error("[REST API] Error fetching hospital alert status:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/hospitals/:hospitalId/automation-event
  app.post("/api/hospitals/:hospitalId/automation-event", async (req: Request, res: Response) => {
    try {
      const rawId = req.params.hospitalId;
      const hospitalId = parseInt(rawId, 10);
      if (Number.isNaN(hospitalId)) {
        return res.status(400).json({ error: "Invalid hospitalId parameter." });
      }

      const snapshot = await getConsolidatedHospitalResources(hospitalId);
      if (!snapshot) {
        return res.status(404).json({ error: "Hospital not found" });
      }

      const { eventType, overallStatus, affectedResources, detail } = req.body || {};
      const actualEventType = eventType ? String(eventType) : "hospital_automation_event";
      const actualStatus = overallStatus ? String(overallStatus) : snapshot.overallShortageLevel;
      const actualAffected = Array.isArray(affectedResources) ? affectedResources : snapshot.criticalResources;

      await writeAudit(
        null,
        `hospital.${actualEventType}`,
        "hospital",
        hospitalId,
        JSON.stringify({
          overallStatus: actualStatus,
          affectedResources: actualAffected,
          detail: detail || null,
        })
      );

      // Update in-memory state tracking
      const state = _hospitalAlertStates.get(hospitalId);
      if (state) {
        state.previousShortageLevel = actualStatus as ShortageLevel;
        state.lastAlertedShortageLevel = actualStatus as ShortageLevel;
        state.lastAlertedCriticalResources = [...actualAffected];
        state.lastAlertedAt = new Date().toISOString();
        _hospitalAlertStates.set(hospitalId, state);
      }

      return res.json({
        success: true,
        recordedEvent: {
          hospitalId,
          hospitalName: snapshot.hospitalName,
          eventType: actualEventType,
          overallStatus: actualStatus,
          affectedResources: actualAffected,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("[REST API] Error recording hospital automation event:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
