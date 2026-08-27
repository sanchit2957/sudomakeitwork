/**
 * Comprehensive Weather, Flood & Atmospheric Intelligence Service
 * Integrates Open-Meteo Forecast, Global Flood River Discharge, Air Quality,
 * OpenWeatherMap (optional API key), and Assam CWC River Gauges.
 */

import { getOfficialAssamRiverGauge, type OfficialRiverGauge } from "./assam-river-gauge";

export type WeatherConditionCode = {
  code: number;
  description: string;
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
};

export type CurrentWeather = {
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  weatherCode: number | null;
  condition: string;
  category: string;
  icon: string;
  windKmh: number | null;
  windDirectionDeg: number | null;
  windGustsKmh: number | null;
  uvIndex: number | null;
  visibilityKm: number | null;
};

export type HourlyForecastItem = {
  time: string;
  temperatureC: number | null;
  humidityPercent: number | null;
  precipitationProbability: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  condition: string;
  windKmh: number | null;
};

export type DailyForecastItem = {
  date: string;
  temperatureHighC: number | null;
  temperatureLowC: number | null;
  rainChance: number | null;
  rainMm: number | null;
  weatherCode: number | null;
  condition: string;
  windKmh: number | null;
  uvIndexMax: number | null;
  sunrise: string | null;
  sunset: string | null;
};

export type FloodRiskAssessment = {
  riskLevel: "normal" | "elevated" | "high" | "critical";
  title: string;
  summary: string;
  precipitation24hMm: number;
  precipitationProbabilityMax: number;
  riverDischargeM3s: number | null;
  riverDischargeTrend: "rising" | "falling" | "steady" | "unknown";
  activeFloodZonesCount: number;
  riverGauge: OfficialRiverGauge | null;
};

export type AirQualityData = {
  aqiUs: number | null;
  category: "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous" | "Unavailable";
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  sulphurDioxide: number | null;
  carbonMonoxide: number | null;
};

export type ComprehensiveWeatherReport = {
  available: boolean;
  provider: string;
  location: { latitude: number; longitude: number };
  updatedAt: string;
  current: CurrentWeather;
  forecast: {
    rainChance: number | null;
    rainAmountMm: number | null;
    hourly24h: HourlyForecastItem[];
    days7: DailyForecastItem[];
  };
  trend: {
    source: string;
    pastDays7: DailyForecastItem[];
  };
  floodRisk: FloodRiskAssessment;
  airQuality: AirQualityData;
  river: OfficialRiverGauge;
};

// In-Memory Cache (TTL: 5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;
const weatherCache = new Map<string, { timestamp: number; data: ComprehensiveWeatherReport }>();

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

export function interpretWmoCode(code: number | null | undefined): WeatherConditionCode {
  if (code === null || code === undefined) {
    return { code: -1, description: "Unknown conditions", category: "cloudy", icon: "cloud" };
  }

  switch (code) {
    case 0:
      return { code: 0, description: "Clear sky", category: "clear", icon: "sun" };
    case 1:
      return { code: 1, description: "Mainly clear", category: "clear", icon: "sun-cloud" };
    case 2:
      return { code: 2, description: "Partly cloudy", category: "cloudy", icon: "cloud-sun" };
    case 3:
      return { code: 3, description: "Overcast", category: "cloudy", icon: "cloud" };
    case 45:
    case 48:
      return { code, description: "Fog / Depositing rime fog", category: "fog", icon: "cloud-fog" };
    case 51:
    case 53:
    case 55:
      return { code, description: "Drizzle (Light to Dense)", category: "drizzle", icon: "cloud-drizzle" };
    case 56:
    case 57:
      return { code, description: "Freezing drizzle", category: "drizzle", icon: "cloud-drizzle" };
    case 61:
      return { code: 61, description: "Slight rain", category: "rain", icon: "cloud-rain" };
    case 63:
      return { code: 63, description: "Moderate rain", category: "rain", icon: "cloud-rain" };
    case 65:
      return { code: 65, description: "Heavy torrential rain", category: "rain", icon: "cloud-rain-wind" };
    case 66:
    case 67:
      return { code, description: "Freezing rain", category: "rain", icon: "cloud-rain" };
    case 71:
    case 73:
    case 75:
      return { code, description: "Snow fall", category: "snow", icon: "cloud-snow" };
    case 77:
      return { code: 77, description: "Snow grains", category: "snow", icon: "cloud-snow" };
    case 80:
    case 81:
      return { code, description: "Rain showers", category: "rain", icon: "cloud-rain" };
    case 82:
      return { code: 82, description: "Violent rain showers", category: "rain", icon: "cloud-rain-wind" };
    case 85:
    case 86:
      return { code, description: "Snow showers", category: "snow", icon: "cloud-snow" };
    case 95:
      return { code: 95, description: "Thunderstorm", category: "thunderstorm", icon: "cloud-lightning" };
    case 96:
    case 99:
      return { code, description: "Severe thunderstorm with hail", category: "extreme", icon: "cloud-lightning" };
    default:
      return { code, description: "Moderate weather", category: "cloudy", icon: "cloud" };
  }
}

function classifyAqi(aqi: number | null): AirQualityData["category"] {
  if (aqi === null || aqi === undefined) return "Unavailable";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

/**
 * Fetches real-time River Discharge from Open-Meteo Global Flood API
 */
async function fetchRiverDischarge(latitude: number, longitude: number): Promise<{ dischargeM3s: number | null; trend: "rising" | "falling" | "steady" | "unknown" }> {
  try {
    const url = new URL("https://flood-api.open-meteo.com/v1/flood");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("daily", "river_discharge");
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("past_days", "3");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6_000),
      headers: { accept: "application/json" },
    });

    if (!res.ok) return { dischargeM3s: null, trend: "unknown" };
    const data = (await res.json()) as { daily?: { river_discharge?: number[] } };
    const dischargeList = data.daily?.river_discharge || [];
    if (!dischargeList.length) return { dischargeM3s: null, trend: "unknown" };

    const currentDischarge = dischargeList[3] ?? dischargeList[0] ?? null;
    const previousDischarge = dischargeList[2] ?? dischargeList[0] ?? null;

    let trend: "rising" | "falling" | "steady" | "unknown" = "steady";
    if (currentDischarge !== null && previousDischarge !== null) {
      const diff = currentDischarge - previousDischarge;
      if (diff > 5) trend = "rising";
      else if (diff < -5) trend = "falling";
      else trend = "steady";
    }

    return { dischargeM3s: currentDischarge, trend };
  } catch {
    return { dischargeM3s: null, trend: "unknown" };
  }
}

/**
 * Fetches Air Quality & Atmospheric Pollution Index
 */
async function fetchAirQuality(latitude: number, longitude: number): Promise<AirQualityData> {
  try {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6_000),
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return {
        aqiUs: null,
        category: "Unavailable",
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
        carbonMonoxide: null,
      };
    }

    const data = (await res.json()) as {
      current?: {
        us_aqi?: number;
        pm2_5?: number;
        pm10?: number;
        nitrogen_dioxide?: number;
        ozone?: number;
        sulphur_dioxide?: number;
        carbon_monoxide?: number;
      };
    };

    const cur = data.current || {};
    const aqi = cur.us_aqi ?? null;

    return {
      aqiUs: aqi,
      category: classifyAqi(aqi),
      pm25: cur.pm2_5 ?? null,
      pm10: cur.pm10 ?? null,
      nitrogenDioxide: cur.nitrogen_dioxide ?? null,
      ozone: cur.ozone ?? null,
      sulphurDioxide: cur.sulphur_dioxide ?? null,
      carbonMonoxide: cur.carbon_monoxide ?? null,
    };
  } catch {
    return {
      aqiUs: null,
      category: "Unavailable",
      pm25: null,
      pm10: null,
      nitrogenDioxide: null,
      ozone: null,
      sulphurDioxide: null,
      carbonMonoxide: null,
    };
  }
}

/**
 * Main Comprehensive Weather Aggregator
 */
export async function getComprehensiveWeather(
  latitude: number = 26.1445,
  longitude: number = 91.7362,
  activeFloodZonesCount: number = 0
): Promise<ComprehensiveWeatherReport> {
  const cacheKey = getCacheKey(latitude, longitude);
  const cached = weatherCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.data,
      floodRisk: {
        ...cached.data.floodRisk,
        activeFloodZonesCount,
      },
    };
  }

  // Concurrently fetch Official River Gauges, Open-Meteo Forecast, Flood Discharge, and Air Quality
  const [riverGauge, dischargeData, airQuality] = await Promise.all([
    getOfficialAssamRiverGauge(latitude, longitude),
    fetchRiverDischarge(latitude, longitude),
    fetchAirQuality(latitude, longitude),
  ]);

  try {
    const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
    endpoint.searchParams.set("latitude", String(latitude));
    endpoint.searchParams.set("longitude", String(longitude));
    endpoint.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
    );
    endpoint.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m"
    );
    endpoint.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max,sunrise,sunset"
    );
    endpoint.searchParams.set("past_days", "7");
    endpoint.searchParams.set("forecast_days", "7");
    endpoint.searchParams.set("timezone", "auto");

    const response = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "application/json" },
    });

    if (!response.ok) throw new Error(`Weather source responded ${response.status}`);

    const raw = (await response.json()) as any;
    const cur = raw.current || {};
    const hourly = raw.hourly || {};
    const daily = raw.daily || {};

    const curCondition = interpretWmoCode(cur.weather_code);

    const currentWeather: CurrentWeather = {
      temperatureC: cur.temperature_2m ?? null,
      feelsLikeC: cur.apparent_temperature ?? null,
      humidityPercent: cur.relative_humidity_2m ?? null,
      pressureHpa: cur.surface_pressure ?? null,
      precipitationMm: cur.precipitation ?? null,
      rainMm: cur.rain ?? null,
      weatherCode: cur.weather_code ?? null,
      condition: curCondition.description,
      category: curCondition.category,
      icon: curCondition.icon,
      windKmh: cur.wind_speed_10m ?? null,
      windDirectionDeg: cur.wind_direction_10m ?? null,
      windGustsKmh: cur.wind_gusts_10m ?? null,
      uvIndex: daily.uv_index_max?.[7] ?? null,
      visibilityKm: null,
    };

    // Parse Hourly (Next 24 Hours)
    const hourly24h: HourlyForecastItem[] = [];
    const hourlyTimes = (hourly.time || []) as string[];
    const nowIsoHour = new Date().toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex((t) => t.startsWith(nowIsoHour));
    if (startIndex < 0) startIndex = 0;

    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      const wCode = hourly.weather_code?.[i] ?? null;
      hourly24h.push({
        time: hourlyTimes[i],
        temperatureC: hourly.temperature_2m?.[i] ?? null,
        humidityPercent: hourly.relative_humidity_2m?.[i] ?? null,
        precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
        precipitationMm: hourly.precipitation?.[i] ?? null,
        weatherCode: wCode,
        condition: interpretWmoCode(wCode).description,
        windKmh: hourly.wind_speed_10m?.[i] ?? null,
      });
    }

    // Parse 7 Past Days & 7 Forecast Days
    const allDailyRows: DailyForecastItem[] = (daily.time || []).map((date: string, index: number) => {
      const wCode = daily.weather_code?.[index] ?? null;
      return {
        date,
        temperatureHighC: daily.temperature_2m_max?.[index] ?? null,
        temperatureLowC: daily.temperature_2m_min?.[index] ?? null,
        rainChance: daily.precipitation_probability_max?.[index] ?? null,
        rainMm: daily.precipitation_sum?.[index] ?? null,
        weatherCode: wCode,
        condition: interpretWmoCode(wCode).description,
        windKmh: daily.wind_speed_10m_max?.[index] ?? null,
        uvIndexMax: daily.uv_index_max?.[index] ?? null,
        sunrise: daily.sunrise?.[index] ?? null,
        sunset: daily.sunset?.[index] ?? null,
      };
    });

    const days7 = allDailyRows.slice(-7);
    const pastDays7 = allDailyRows.slice(0, Math.max(0, allDailyRows.length - 7)).slice(-7);

    const rainChance = daily.precipitation_probability_max?.[7] ?? daily.precipitation_probability_max?.[0] ?? null;
    const rainAmount = daily.precipitation_sum?.[7] ?? daily.precipitation_sum?.[0] ?? null;

    // Determine Flood Risk
    let riskLevel: FloodRiskAssessment["riskLevel"] = "normal";
    let riskTitle = "Normal Monsoon Conditions";
    let riskSummary = "Rainfall within typical drainage capacity.";

    const maxRainChance = rainChance ?? 0;
    const maxRainAmount = rainAmount ?? 0;

    if (maxRainChance >= 85 || maxRainAmount >= 50 || dischargeData.trend === "rising" || activeFloodZonesCount > 0) {
      riskLevel = "high";
      riskTitle = "High Flood & Waterlogging Risk";
      riskSummary = "Intense rainfall and rising river drainage detected in nearby zones.";
    } else if (maxRainChance >= 50 || maxRainAmount >= 20 || dischargeData.dischargeM3s !== null && dischargeData.dischargeM3s > 500) {
      riskLevel = "elevated";
      riskTitle = "Elevated Flood Watch";
      riskSummary = "Moderate precipitation and localized water runoff expected.";
    }

    const floodRisk: FloodRiskAssessment = {
      riskLevel,
      title: riskTitle,
      summary: riskSummary,
      precipitation24hMm: maxRainAmount,
      precipitationProbabilityMax: maxRainChance,
      riverDischargeM3s: dischargeData.dischargeM3s,
      riverDischargeTrend: dischargeData.trend,
      activeFloodZonesCount,
      riverGauge,
    };

    const report: ComprehensiveWeatherReport = {
      available: true,
      provider: "Open-Meteo High-Resolution Ensemble + CWC India",
      location: { latitude, longitude },
      updatedAt: new Date().toISOString(),
      current: currentWeather,
      forecast: {
        rainChance,
        rainAmountMm: rainAmount,
        hourly24h,
        days7,
      },
      trend: {
        source: "Modelled 7-Day Rainfall History",
        pastDays7,
      },
      floodRisk,
      airQuality,
      river: riverGauge,
    };

    weatherCache.set(cacheKey, { timestamp: now, data: report });
    return report;
  } catch (err) {
    console.warn("[WeatherService] Live fetch failed, generating safe fallback:", err);

    return {
      available: false,
      provider: "Offline / Fallback",
      location: { latitude, longitude },
      updatedAt: new Date().toISOString(),
      current: {
        temperatureC: null,
        feelsLikeC: null,
        humidityPercent: null,
        pressureHpa: null,
        precipitationMm: null,
        rainMm: null,
        weatherCode: null,
        condition: "Weather source unavailable",
        category: "cloudy",
        icon: "cloud",
        windKmh: null,
        windDirectionDeg: null,
        windGustsKmh: null,
        uvIndex: null,
        visibilityKm: null,
      },
      forecast: {
        rainChance: null,
        rainAmountMm: null,
        hourly24h: [],
        days7: [],
      },
      trend: {
        source: "Unavailable",
        pastDays7: [],
      },
      floodRisk: {
        riskLevel: "normal",
        title: "Conditions Unavailable",
        summary: "Weather station temporarily unreachable.",
        precipitation24hMm: 0,
        precipitationProbabilityMax: 0,
        riverDischargeM3s: dischargeData.dischargeM3s,
        riverDischargeTrend: dischargeData.trend,
        activeFloodZonesCount,
        riverGauge,
      },
      airQuality,
      river: riverGauge,
    };
  }
}
