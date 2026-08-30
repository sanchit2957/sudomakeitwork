import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { floodZones } from "../drizzle/schema";
import { writeAudit, _memoryFloodZones } from "./rescue.db";
import { getComprehensiveWeather } from "./weather.service";
import type { FloodRiskNormalized, NormalizedWeatherReport } from "./weather/weather.types";

export type FloodRiskLevel = "normal" | "elevated" | "high" | "critical" | "unknown";

export interface FloodAlertState {
  locationKey: string;
  previousRisk: FloodRiskLevel;
  lastAlertedRisk: FloodRiskLevel | null;
  lastAlertedAt: string | null;
  suppressedCount: number;
  lastEvaluatedAt: string;
}

const _floodAlertStates = new Map<string, FloodAlertState>();

export function getLocationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
}

export function clearFloodAlertStateCache(): void {
  _floodAlertStates.clear();
}

/**
 * Calculates a normalized numeric risk score (0.00 to 1.00) based on project risk factors.
 */
export function calculateRiskScore(
  riskLevel: "normal" | "elevated" | "high" | "critical",
  precipitation24hMm: number,
  precipitationProbabilityMax: number,
  riverDischargeTrend?: string,
  riverGaugeLevel?: number | null
): number {
  let baseScore = 0.20;
  if (riskLevel === "critical") baseScore = 0.90;
  else if (riskLevel === "high") baseScore = 0.72;
  else if (riskLevel === "elevated") baseScore = 0.48;
  else baseScore = 0.15;

  const rainBonus = Math.min(0.08, (precipitation24hMm / 100) * 0.08);
  const probBonus = Math.min(0.05, (precipitationProbabilityMax / 100) * 0.05);
  const trendBonus = riverDischargeTrend === "rising" ? 0.05 : 0;

  const finalScore = Math.min(1.0, Math.max(0.0, baseScore + rainBonus + probBonus + trendBonus));
  return Math.round(finalScore * 100) / 100;
}

/**
 * Returns a consolidated snapshot of flood conditions and risk intelligence.
 */
export async function getConsolidatedFloodConditions(
  latitude: number = 26.1445,
  longitude: number = 91.7362
) {
  let activeZonesCount = 0;
  try {
    const db = await getDb();
    if (db) {
      const zones = await db.select({ id: floodZones.id }).from(floodZones).where(floodZones.active.enumValues ? undefined : undefined);
      activeZonesCount = zones.length;
    } else {
      activeZonesCount = Array.from(_memoryFloodZones.values()).filter((z) => z.active === "yes").length;
    }
  } catch {
    activeZonesCount = Array.from(_memoryFloodZones.values()).filter((z) => z.active === "yes").length;
  }

  const weatherReport: NormalizedWeatherReport = await getComprehensiveWeather(latitude, longitude, activeZonesCount);

  const staleSources: string[] = [];
  if (!weatherReport.available) {
    staleSources.push("weather_provider");
  }
  if (weatherReport.river && !weatherReport.river.available) {
    staleSources.push("river_gauge");
  }

  const isFresh = weatherReport.available && weatherReport.source.tier !== "offline" && staleSources.length === 0;

  const overallRisk: FloodRiskLevel = !weatherReport.available || weatherReport.source.tier === "offline"
    ? "unknown"
    : weatherReport.floodRisk.riskLevel;

  const riskScore = overallRisk === "unknown"
    ? 0.0
    : calculateRiskScore(
        weatherReport.floodRisk.riskLevel,
        weatherReport.floodRisk.precipitation24hMm,
        weatherReport.floodRisk.precipitationProbabilityMax,
        weatherReport.floodRisk.riverDischargeTrend,
        weatherReport.river?.levelMetres
      );

  return {
    timestamp: new Date().toISOString(),
    location: {
      latitude: weatherReport.location.latitude,
      longitude: weatherReport.location.longitude,
      name: weatherReport.location.name || "Assam Emergency Sector",
    },
    overallRisk,
    riskScore,
    weather: {
      rainProbability: weatherReport.forecast.rainChance,
      forecastRainfallMm: weatherReport.forecast.rainAmountMm,
      temperatureC: weatherReport.current.temperatureC,
      condition: weatherReport.current.condition,
      category: weatherReport.current.category,
    },
    river: {
      available: weatherReport.river.available,
      stationName: weatherReport.river.stationName,
      riverName: weatherReport.river.riverName,
      levelMetres: weatherReport.river.levelMetres,
      trend: weatherReport.river.trend,
      updatedAt: weatherReport.river.updatedAt ? new Date(weatherReport.river.updatedAt).toISOString() : null,
      sourceName: weatherReport.river.sourceName,
      message: weatherReport.river.message,
    },
    floodZones: {
      activeCount: activeZonesCount,
    },
    dataFreshness: {
      isFresh,
      lastUpdated: weatherReport.updatedAt,
      providerTier: weatherReport.source.tier,
      isCached: weatherReport.source.isCached,
      staleSources,
    },
  };
}

/**
 * Evaluates current flood risk against historical alert state for duplicate suppression & escalation.
 */
export async function getFloodAlertStatus(
  latitude: number = 26.1445,
  longitude: number = 91.7362
) {
  const snapshot = await getConsolidatedFloodConditions(latitude, longitude);
  const locationKey = getLocationKey(latitude, longitude);

  let state = _floodAlertStates.get(locationKey);
  if (!state) {
    state = {
      locationKey,
      previousRisk: "normal",
      lastAlertedRisk: null,
      lastAlertedAt: null,
      suppressedCount: 0,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }

  const currentRisk = snapshot.overallRisk;
  const previousRisk = state.previousRisk;

  let shouldAlert = false;
  let action:
    | "trigger_alert"
    | "trigger_critical_alert"
    | "trigger_escalation"
    | "record_normalization"
    | "suppress_duplicate"
    | "stale_data_detected"
    | "monitoring_normal" = "monitoring_normal";
  let reason = "Conditions are normal or elevated under routine monitoring.";

  if (!snapshot.dataFreshness.isFresh || currentRisk === "unknown") {
    action = "stale_data_detected";
    shouldAlert = false;
    reason = "Underlying weather/telemetry data is stale or unavailable. Automation will pause active alerts.";
  } else if (currentRisk === "normal" || currentRisk === "elevated") {
    if (previousRisk === "high" || previousRisk === "critical") {
      action = "record_normalization";
      shouldAlert = true;
      reason = `Flood risk normalized from previous ${previousRisk.toUpperCase()} state to ${currentRisk.toUpperCase()}.`;
    } else {
      action = "monitoring_normal";
      shouldAlert = false;
      reason = `Flood risk is ${currentRisk.toUpperCase()}. Continuous background monitoring active.`;
    }
  } else if (currentRisk === "high") {
    if (previousRisk === "high" || previousRisk === "critical") {
      action = "suppress_duplicate";
      shouldAlert = false;
      reason = `Duplicate alert suppressed. Risk remains HIGH (last alerted at ${state.lastAlertedAt || "recent check"}).`;
      state.suppressedCount++;
    } else {
      action = "trigger_alert";
      shouldAlert = true;
      reason = "Flood risk elevated from normal/watch to HIGH. Triggering Operations Alert.";
    }
  } else if (currentRisk === "critical") {
    if (previousRisk === "critical") {
      action = "suppress_duplicate";
      shouldAlert = false;
      reason = "Duplicate alert suppressed. Risk remains CRITICAL and active in operations queue.";
      state.suppressedCount++;
    } else if (previousRisk === "high") {
      action = "trigger_escalation";
      shouldAlert = true;
      reason = "Flood risk escalated from HIGH to CRITICAL. Triggering Emergency Operations Escalation.";
    } else {
      action = "trigger_critical_alert";
      shouldAlert = true;
      reason = "Immediate CRITICAL flood risk detected. Dispatching top-tier operations alert.";
    }
  }

  // Update in-memory state tracking
  state.previousRisk = currentRisk;
  state.lastEvaluatedAt = new Date().toISOString();
  if (shouldAlert) {
    state.lastAlertedRisk = currentRisk;
    state.lastAlertedAt = new Date().toISOString();
  }
  _floodAlertStates.set(locationKey, state);

  return {
    locationKey,
    shouldAlert,
    action,
    reason,
    previousRisk,
    currentRisk,
    riskScore: snapshot.riskScore,
    dataFreshness: snapshot.dataFreshness,
    timestamp: new Date().toISOString(),
    stateSummary: {
      lastAlertedRisk: state.lastAlertedRisk,
      lastAlertedAt: state.lastAlertedAt,
      suppressedCount: state.suppressedCount,
    },
    snapshot,
  };
}

/**
 * Registers REST API endpoints for n8n flood conditions, alert status, and automation events.
 */
export function registerFloodRoutes(app: Express) {
  // GET /api/flood/conditions
  app.get("/api/flood/conditions", async (req: Request, res: Response) => {
    try {
      const lat = req.query.latitude ? parseFloat(String(req.query.latitude)) : 26.1445;
      const lng = req.query.longitude ? parseFloat(String(req.query.longitude)) : 91.7362;

      const result = await getConsolidatedFloodConditions(lat, lng);
      return res.json(result);
    } catch (err: any) {
      console.error("[REST API] Error fetching flood conditions:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/flood/alert-status
  app.get("/api/flood/alert-status", async (req: Request, res: Response) => {
    try {
      const lat = req.query.latitude ? parseFloat(String(req.query.latitude)) : 26.1445;
      const lng = req.query.longitude ? parseFloat(String(req.query.longitude)) : 91.7362;

      const result = await getFloodAlertStatus(lat, lng);
      return res.json(result);
    } catch (err: any) {
      console.error("[REST API] Error fetching flood alert status:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/flood/automation-event
  app.post("/api/flood/automation-event", async (req: Request, res: Response) => {
    try {
      const { eventType, riskLevel, riskScore, detail, latitude, longitude } = req.body || {};
      const actualEventType = eventType ? String(eventType) : "flood_automation_event";
      const actualRiskLevel = riskLevel ? String(riskLevel) : "unknown";

      const lat = typeof latitude === "number" ? latitude : 26.1445;
      const lng = typeof longitude === "number" ? longitude : 91.7362;
      const locationKey = getLocationKey(lat, lng);

      await writeAudit(
        null,
        `flood.${actualEventType}`,
        "flood",
        locationKey,
        JSON.stringify({ riskLevel: actualRiskLevel, riskScore, detail: detail || null })
      );

      // Update state store with reported risk level
      const existingState = _floodAlertStates.get(locationKey);
      if (existingState && (actualRiskLevel === "normal" || actualRiskLevel === "elevated" || actualRiskLevel === "high" || actualRiskLevel === "critical")) {
        existingState.previousRisk = actualRiskLevel;
        existingState.lastAlertedRisk = actualRiskLevel;
        existingState.lastAlertedAt = new Date().toISOString();
        _floodAlertStates.set(locationKey, existingState);
      }

      return res.json({
        success: true,
        recordedEvent: {
          eventType: actualEventType,
          riskLevel: actualRiskLevel,
          riskScore: riskScore ?? null,
          locationKey,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("[REST API] Error recording flood automation event:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
