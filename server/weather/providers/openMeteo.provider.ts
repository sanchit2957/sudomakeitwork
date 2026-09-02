import dns from "node:dns";
dns.setDefaultResultOrder?.("ipv4first");
import { getOfficialAssamRiverGauge } from "../../assam-river-gauge";
import type {
  AirQualityNormalized,
  CurrentWeatherNormalized,
  DailyForecastItemNormalized,
  FloodRiskNormalized,
  HourlyForecastItemNormalized,
  IWeatherProvider,
  NormalizedWeatherReport,
  WeatherAlert,
} from "../weather.types";

export function interpretWmoCode(code: number | null | undefined): {
  code: number;
  description: string;
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
} {
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

function classifyAqi(aqi: number | null): AirQualityNormalized["category"] {
  if (aqi === null || aqi === undefined) return "Unavailable";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

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

async function fetchAirQuality(latitude: number, longitude: number): Promise<AirQualityNormalized> {
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

export class OpenMeteoProvider implements IWeatherProvider {
  readonly id = "open-meteo";
  readonly name = "Open-Meteo High-Resolution Ensemble";
  readonly isConfigured = true; // Does not require private API key

  async fetchWeather(latitude: number, longitude: number): Promise<NormalizedWeatherReport> {
    const startTime = Date.now();

    const [riverGauge, dischargeData, airQuality] = await Promise.all([
      getOfficialAssamRiverGauge(latitude, longitude),
      fetchRiverDischarge(latitude, longitude),
      fetchAirQuality(latitude, longitude),
    ]);

    const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
    endpoint.searchParams.set("latitude", String(latitude));
    endpoint.searchParams.set("longitude", String(longitude));
    endpoint.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility"
    );
    endpoint.searchParams.set(
      "hourly",
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m"
    );
    endpoint.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max,sunrise,sunset"
    );
    endpoint.searchParams.set("past_days", "7");
    endpoint.searchParams.set("forecast_days", "7");
    endpoint.searchParams.set("timezone", "auto");

    const response = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo returned HTTP ${response.status}`);
    }

    const raw = (await response.json()) as any;
    const cur = raw.current || {};
    const hourly = raw.hourly || {};
    const daily = raw.daily || {};

    const curCondition = interpretWmoCode(cur.weather_code);

    const currentWeather: CurrentWeatherNormalized = {
      temperatureC: cur.temperature_2m ?? null,
      feelsLikeC: cur.apparent_temperature ?? null,
      humidityPercent: cur.relative_humidity_2m ?? null,
      pressureHpa: cur.surface_pressure ?? null,
      windKmh: cur.wind_speed_10m ?? null,
      windDirectionDeg: cur.wind_direction_10m ?? null,
      windGustsKmh: cur.wind_gusts_10m ?? null,
      visibilityKm: cur.visibility != null ? Math.round((cur.visibility / 1000) * 10) / 10 : null,
      cloudCoverPercent: cur.cloud_cover ?? null,
      precipitationMm: cur.precipitation ?? null,
      rainMm: cur.rain ?? null,
      weatherCode: cur.weather_code ?? null,
      condition: curCondition.description,
      category: curCondition.category,
      icon: curCondition.icon,
      uvIndex: daily.uv_index_max?.[7] ?? daily.uv_index_max?.[0] ?? null,
    };

    // Hourly Forecast (Next 24 Hours)
    const hourly24h: HourlyForecastItemNormalized[] = [];
    const hourlyTimes = (hourly.time || []) as string[];
    const nowIsoHour = new Date().toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex((t) => t.startsWith(nowIsoHour));
    if (startIndex < 0) startIndex = 0;

    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      const wCode = hourly.weather_code?.[i] ?? null;
      const cond = interpretWmoCode(wCode);
      hourly24h.push({
        time: hourlyTimes[i],
        temperatureC: hourly.temperature_2m?.[i] ?? null,
        feelsLikeC: hourly.apparent_temperature?.[i] ?? null,
        humidityPercent: hourly.relative_humidity_2m?.[i] ?? null,
        precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
        precipitationMm: hourly.precipitation?.[i] ?? null,
        weatherCode: wCode,
        condition: cond.description,
        icon: cond.icon,
        windKmh: hourly.wind_speed_10m?.[i] ?? null,
      });
    }

    // Daily Forecast & 7-Day History
    const allDailyRows: DailyForecastItemNormalized[] = (daily.time || []).map((date: string, index: number) => {
      const wCode = daily.weather_code?.[index] ?? null;
      const cond = interpretWmoCode(wCode);
      return {
        date,
        temperatureHighC: daily.temperature_2m_max?.[index] ?? null,
        temperatureLowC: daily.temperature_2m_min?.[index] ?? null,
        rainChance: daily.precipitation_probability_max?.[index] ?? null,
        rainMm: daily.precipitation_sum?.[index] ?? null,
        weatherCode: wCode,
        condition: cond.description,
        icon: cond.icon,
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

    // Severe Alerts Detection from Real Weather Forecast
    const alerts: WeatherAlert[] = [];
    const maxRainChance = rainChance ?? 0;
    const maxRainAmount = rainAmount ?? 0;
    const curWind = cur.wind_speed_10m ?? 0;
    const curGust = cur.wind_gusts_10m ?? 0;

    if (maxRainAmount >= 70 || curCondition.category === "extreme") {
      alerts.push({
        title: "Severe Weather Warning: Torrential Downpours",
        severity: "SEVERE",
        description: `Heavy rainfall of ${maxRainAmount} mm predicted. Risk of rapid water accumulation in low-lying zones.`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        source: "Open-Meteo High-Resolution Ensemble",
      });
    } else if (maxRainAmount >= 35 || curCondition.category === "thunderstorm") {
      alerts.push({
        title: "Weather Advisory: Thunderstorms & Heavy Showers",
        severity: "ADVISORY",
        description: "Active thunderstorms and localized heavy showers detected. Exercise caution on active transport routes.",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
        source: "Open-Meteo High-Resolution Ensemble",
      });
    }

    if (curWind > 45 || curGust > 60) {
      alerts.push({
        title: "High Wind Alert",
        severity: "WARNING",
        description: `Strong gusts reaching ${Math.round(curGust || curWind)} km/h. Boat and aerial rescue operations may be impacted.`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        source: "Open-Meteo High-Resolution Ensemble",
      });
    }

    // Flood Risk Assessment
    let riskLevel: FloodRiskNormalized["riskLevel"] = "normal";
    let riskTitle = "Normal Monsoon Conditions";
    let riskSummary = "Rainfall within typical regional drainage capacity.";

    if (maxRainAmount >= 50 || (maxRainChance >= 85 && maxRainAmount >= 30) || (dischargeData.trend === "rising" && (dischargeData.dischargeM3s ?? 0) > 800)) {
      riskLevel = "high";
      riskTitle = "High Flood & Waterlogging Risk";
      riskSummary = "Intense rainfall and major river discharge detected in nearby zones.";
    } else if (maxRainAmount >= 20 || maxRainChance >= 70 || (dischargeData.dischargeM3s !== null && dischargeData.dischargeM3s > 500)) {
      riskLevel = "elevated";
      riskTitle = "Elevated Flood Watch";
      riskSummary = "Moderate precipitation and localized water runoff expected.";
    }

    const floodRisk: FloodRiskNormalized = {
      riskLevel,
      title: riskTitle,
      summary: riskSummary,
      precipitation24hMm: maxRainAmount,
      precipitationProbabilityMax: maxRainChance,
      riverDischargeM3s: dischargeData.dischargeM3s,
      riverDischargeTrend: dischargeData.trend,
      activeFloodZonesCount: 0,
      riverGauge,
    };

    const latencyMs = Date.now() - startTime;

    return {
      available: true,
      provider: this.name,
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
      alerts,
      floodRisk,
      airQuality,
      river: riverGauge,
      source: {
        provider: this.name,
        tier: "primary",
        fetchedAt: new Date().toISOString(),
        isCached: false,
        latencyMs,
      },
    };
  }
}
