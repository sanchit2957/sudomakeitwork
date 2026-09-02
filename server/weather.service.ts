import { type OfficialRiverGauge } from "./assam-river-gauge";
import { interpretWmoCode as openMeteoInterpretWmoCode } from "./weather/providers/openMeteo.provider";
import { weatherProviderManager, WeatherProviderManager } from "./weather/weather.provider-manager";
import type {
  AirQualityNormalized,
  CurrentWeatherNormalized,
  DailyForecastItemNormalized,
  FloodRiskNormalized,
  HourlyForecastItemNormalized,
  NormalizedWeatherReport,
  ProviderHealthStats,
  WeatherAlert,
  WeatherSeverity,
} from "./weather/weather.types";
import {
  INDIA_CENTER,
  INDIA_MAP_BOUNDS,
  PAN_INDIA_WEATHER_HUBS,
  POPULAR_INDIAN_LOCATIONS,
  type WeatherRiskLevel,
  type WeatherRiskPoint,
  type MeteorologicalHub,
} from "../shared/india-locations";

export type WeatherConditionCode = {
  code: number;
  description: string;
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
};

export type CurrentWeather = CurrentWeatherNormalized;
export type HourlyForecastItem = HourlyForecastItemNormalized;
export type DailyForecastItem = DailyForecastItemNormalized;
export type FloodRiskAssessment = FloodRiskNormalized;
export type AirQualityData = AirQualityNormalized;
export type ComprehensiveWeatherReport = NormalizedWeatherReport;

export {
  type WeatherAlert,
  type WeatherSeverity,
  type ProviderHealthStats,
  type NormalizedWeatherReport,
  type WeatherRiskLevel,
  type WeatherRiskPoint,
  type MeteorologicalHub,
  INDIA_CENTER,
  INDIA_MAP_BOUNDS,
  PAN_INDIA_WEATHER_HUBS,
  POPULAR_INDIAN_LOCATIONS,
  WeatherProviderManager,
  weatherProviderManager,
};

export function interpretWmoCode(code: number | null | undefined): WeatherConditionCode {
  return openMeteoInterpretWmoCode(code);
}

/**
 * Deterministic Weather & Environmental Risk Classification
 * Classifies real weather metrics into Good (Green), Moderate (Orange), or Critical (Red).
 */
export function classifyWeatherRisk(report: NormalizedWeatherReport | null | undefined): {
  riskLevel: WeatherRiskLevel;
  riskScore: number;
  reason: string;
} {
  if (!report || (report.available === false && report.source?.tier === "offline")) {
    return {
      riskLevel: "unknown",
      riskScore: 0,
      reason: "Weather station temporarily offline",
    };
  }

  const cur = report.current;
  const flood = report.floodRisk;
  const aqi = report.airQuality?.aqiUs ?? null;
  const alerts = report.alerts || [];
  const rainMm = cur?.precipitationMm ?? cur?.rainMm ?? 0;
  const forecastRainMm = report.forecast?.rainAmountMm ?? 0;
  const rainChance = report.forecast?.rainChance ?? 0;
  const windKmh = cur?.windKmh ?? 0;
  const gustKmh = cur?.windGustsKmh ?? 0;
  const category = cur?.category ?? "cloudy";
  const tempC = cur?.temperatureC ?? null;

  // 1. CRITICAL (RED) - Severe threat to life, operations or high flood risk
  const severeAlert = alerts.find(
    (a) => a.severity === "SEVERE" || a.severity === "EMERGENCY" || a.severity === "WARNING"
  );
  if (severeAlert) {
    return {
      riskLevel: "critical",
      riskScore: 0.95,
      reason: severeAlert.title,
    };
  }
  if (flood?.riskLevel === "critical" || flood?.riskLevel === "high") {
    return {
      riskLevel: "critical",
      riskScore: 0.90,
      reason: flood.title || "High Flood / Waterlogging Risk",
    };
  }
  if (rainMm >= 25 || forecastRainMm >= 40) {
    return {
      riskLevel: "critical",
      riskScore: 0.88,
      reason: `Torrential rainfall (${Math.round(rainMm || forecastRainMm)} mm)`,
    };
  }
  if (gustKmh >= 60 || windKmh >= 45) {
    return {
      riskLevel: "critical",
      riskScore: 0.85,
      reason: `Severe gale winds (${Math.round(gustKmh || windKmh)} km/h)`,
    };
  }
  if (category === "extreme" || (category === "thunderstorm" && (rainMm >= 15 || gustKmh >= 45))) {
    return {
      riskLevel: "critical",
      riskScore: 0.82,
      reason: `Dangerous thunderstorm activity`,
    };
  }
  if (aqi !== null && aqi >= 250) {
    return {
      riskLevel: "critical",
      riskScore: 0.80,
      reason: `Severe air pollution (AQI ${aqi})`,
    };
  }

  // 2. MODERATE (ORANGE) - Caution warranted, notable weather activity
  const moderateAlert = alerts.find((a) => a.severity === "ADVISORY" || a.severity === "WATCH");
  if (moderateAlert) {
    return {
      riskLevel: "moderate",
      riskScore: 0.65,
      reason: moderateAlert.title,
    };
  }
  if (flood?.riskLevel === "elevated") {
    return {
      riskLevel: "moderate",
      riskScore: 0.60,
      reason: flood.title || "Elevated Water Watch",
    };
  }
  if (rainMm >= 5 || forecastRainMm >= 15 || rainChance >= 65) {
    return {
      riskLevel: "moderate",
      riskScore: 0.55,
      reason: `Active precipitation (${Math.round(rainMm || forecastRainMm)} mm, ${Math.round(rainChance)}% chance)`,
    };
  }
  if (gustKmh >= 35 || windKmh >= 25) {
    return {
      riskLevel: "moderate",
      riskScore: 0.50,
      reason: `Elevated winds (${Math.round(gustKmh || windKmh)} km/h)`,
    };
  }
  if (category === "rain" || category === "thunderstorm" || category === "fog") {
    return {
      riskLevel: "moderate",
      riskScore: 0.45,
      reason: cur?.condition || "Precipitation & low visibility",
    };
  }
  if (aqi !== null && aqi >= 120) {
    return {
      riskLevel: "moderate",
      riskScore: 0.40,
      reason: `Unhealthy Air Quality (AQI ${aqi})`,
    };
  }
  if (tempC !== null && (tempC >= 42 || tempC <= 2)) {
    return {
      riskLevel: "moderate",
      riskScore: 0.42,
      reason: tempC >= 42 ? `Extreme Heatwave (${tempC}°C)` : `Severe Cold Wave (${tempC}°C)`,
    };
  }

  // 3. GOOD (GREEN) - Normal / Low Risk Conditions
  return {
    riskLevel: "good",
    riskScore: 0.15,
    reason: cur?.condition ? `Normal conditions (${cur.condition})` : "Low risk / normal conditions",
  };
}

/**
 * Main Comprehensive Weather Aggregator
 */
export async function getComprehensiveWeather(
  latitude: number = INDIA_CENTER.lat,
  longitude: number = INDIA_CENTER.lng,
  activeFloodZonesCount: number = 0
): Promise<ComprehensiveWeatherReport> {
  return weatherProviderManager.getWeather(latitude, longitude, activeFloodZonesCount);
}

export type IndiaWeatherRiskGridResponse = {
  points: WeatherRiskPoint[];
  generatedAt: string;
  timestamp: number;
  cacheTtlMs: number;
  counts: { good: number; moderate: number; critical: number; unknown: number; total: number };
};

// In-memory cache for Pan-India Risk Grid aggregation
const GRID_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
let _cachedRiskGrid: {
  timestamp: number;
  data: IndiaWeatherRiskGridResponse;
} | null = null;
let _inFlightGridPromise: Promise<IndiaWeatherRiskGridResponse> | null = null;

/**
 * Aggregates live weather across the Pan-India meteorological grid and converts to color-coded risk points.
 * Fully cached with deduplication to guarantee zero request storm and zero DB pressure.
 */
export async function getIndiaWeatherRiskGrid(): Promise<IndiaWeatherRiskGridResponse> {
  const now = Date.now();
  if (_cachedRiskGrid && now - _cachedRiskGrid.timestamp < GRID_CACHE_TTL_MS) {
    return _cachedRiskGrid.data;
  }

  if (_inFlightGridPromise) {
    return _inFlightGridPromise;
  }

  _inFlightGridPromise = (async () => {
    try {
      const results = await Promise.allSettled(
        PAN_INDIA_WEATHER_HUBS.map(async (hub): Promise<WeatherRiskPoint> => {
          try {
            const report = await weatherProviderManager.getWeather(hub.latitude, hub.longitude);
            const { riskLevel, riskScore, reason } = classifyWeatherRisk(report);

            return {
              id: hub.id,
              name: hub.name,
              state: hub.state,
              region: hub.region,
              latitude: hub.latitude,
              longitude: hub.longitude,
              riskLevel,
              riskScore,
              temperatureC: report.current?.temperatureC ?? null,
              feelsLikeC: report.current?.feelsLikeC ?? null,
              humidityPercent: report.current?.humidityPercent ?? null,
              precipitationMm: report.current?.precipitationMm ?? report.current?.rainMm ?? null,
              rainChancePercent: report.forecast?.rainChance ?? null,
              windSpeedKmh: report.current?.windKmh ?? null,
              windGustsKmh: report.current?.windGustsKmh ?? null,
              condition: report.current?.condition || "Calm",
              weatherCode: report.current?.weatherCode ?? null,
              aqiUs: report.airQuality?.aqiUs ?? null,
              aqiCategory: report.airQuality?.category,
              activeAlertsCount: (report.alerts || []).length,
              alertSummary: reason,
              updatedAt: report.updatedAt,
            };
          } catch {
            return {
              id: hub.id,
              name: hub.name,
              state: hub.state,
              region: hub.region,
              latitude: hub.latitude,
              longitude: hub.longitude,
              riskLevel: "unknown",
              riskScore: 0,
              temperatureC: null,
              feelsLikeC: null,
              humidityPercent: null,
              precipitationMm: null,
              rainChancePercent: null,
              windSpeedKmh: null,
              windGustsKmh: null,
              condition: "Station temporarily unreachable",
              weatherCode: null,
              aqiUs: null,
              activeAlertsCount: 0,
              alertSummary: "Offline fallback",
              updatedAt: new Date().toISOString(),
            };
          }
        })
      );

      const points: WeatherRiskPoint[] = results.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        const hub = PAN_INDIA_WEATHER_HUBS[i];
        return {
          id: hub.id,
          name: hub.name,
          state: hub.state,
          region: hub.region,
          latitude: hub.latitude,
          longitude: hub.longitude,
          riskLevel: "unknown",
          riskScore: 0,
          temperatureC: null,
          feelsLikeC: null,
          humidityPercent: null,
          precipitationMm: null,
          rainChancePercent: null,
          windSpeedKmh: null,
          windGustsKmh: null,
          condition: "Station temporarily unreachable",
          weatherCode: null,
          aqiUs: null,
          activeAlertsCount: 0,
          alertSummary: "Offline fallback",
          updatedAt: new Date().toISOString(),
        };
      });

      const counts = {
        good: points.filter((p) => p.riskLevel === "good").length,
        moderate: points.filter((p) => p.riskLevel === "moderate").length,
        critical: points.filter((p) => p.riskLevel === "critical").length,
        unknown: points.filter((p) => p.riskLevel === "unknown").length,
        total: points.length,
      };

      const data = {
        points,
        generatedAt: new Date().toISOString(),
        timestamp: Date.now(),
        cacheTtlMs: GRID_CACHE_TTL_MS,
        counts,
      };

      _cachedRiskGrid = { timestamp: Date.now(), data };
      return data;
    } finally {
      _inFlightGridPromise = null;
    }
  })();

  return _inFlightGridPromise;
}

export const ASSAM_DISTRICT_LOCATIONS = [
  { name: "Guwahati (Kamrup Metro)", latitude: 26.1445, longitude: 91.7362, region: "Lower Assam" },
  { name: "Silchar (Cachar)", latitude: 24.8333, longitude: 92.7789, region: "Barak Valley" },
  { name: "Dibrugarh", latitude: 27.4728, longitude: 94.912, region: "Upper Assam" },
  { name: "Jorhat", latitude: 26.7509, longitude: 94.2037, region: "Upper Assam" },
  { name: "Tezpur (Sonitpur)", latitude: 26.6528, longitude: 92.7926, region: "North Assam" },
  { name: "Nagaon", latitude: 26.3452, longitude: 92.684, region: "Central Assam" },
  { name: "Bongaigaon", latitude: 26.4952, longitude: 90.5432, region: "Lower Assam" },
  { name: "Tinsukia", latitude: 27.4922, longitude: 95.3468, region: "Upper Assam" },
  { name: "Dhubri", latitude: 26.0197, longitude: 89.9749, region: "Lower Assam" },
  { name: "Karimganj", latitude: 24.8649, longitude: 92.3592, region: "Barak Valley" },
  { name: "Golaghat", latitude: 26.5167, longitude: 93.9667, region: "Upper Assam" },
  { name: "Barpeta", latitude: 26.3216, longitude: 91.0069, region: "Lower Assam" },
  { name: "North Lakhimpur", latitude: 27.2366, longitude: 94.1037, region: "North Assam" },
  { name: "Dhemaji", latitude: 27.4817, longitude: 94.5824, region: "North Assam" },
  { name: "Haflong (Dima Hasao)", latitude: 25.1764, longitude: 93.0177, region: "Hills" },
  { name: "Diphu (Karbi Anglong)", latitude: 25.8456, longitude: 93.4338, region: "Hills" },
];
