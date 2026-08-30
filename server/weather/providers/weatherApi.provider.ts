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
  WeatherSeverity,
} from "../weather.types";

function mapWeatherApiCondition(text: string, code: number): {
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
} {
  const t = text.toLowerCase();
  if (t.includes("thunder") || t.includes("lightning") || code === 1087 || code >= 1273) {
    return { category: "thunderstorm", icon: "cloud-lightning" };
  }
  if (t.includes("torrential") || t.includes("heavy rain") || code === 1195 || code === 1246) {
    return { category: "rain", icon: "cloud-rain-wind" };
  }
  if (t.includes("rain") || t.includes("shower") || code >= 1180) {
    return { category: "rain", icon: "cloud-rain" };
  }
  if (t.includes("drizzle") || code === 1150 || code === 1153) {
    return { category: "drizzle", icon: "cloud-drizzle" };
  }
  if (t.includes("snow") || t.includes("blizzard") || t.includes("sleet") || code >= 1210) {
    return { category: "snow", icon: "cloud-snow" };
  }
  if (t.includes("fog") || t.includes("mist") || code === 1030 || code === 1135 || code === 1147) {
    return { category: "fog", icon: "cloud-fog" };
  }
  if (t.includes("clear") || t.includes("sunny") || code === 1000) {
    return { category: "clear", icon: "sun" };
  }
  if (t.includes("partly") || code === 1003) {
    return { category: "cloudy", icon: "cloud-sun" };
  }
  return { category: "cloudy", icon: "cloud" };
}

function mapEpaAqi(epaIndex: number | null | undefined): AirQualityNormalized["category"] {
  if (epaIndex === null || epaIndex === undefined) return "Unavailable";
  switch (epaIndex) {
    case 1:
      return "Good";
    case 2:
      return "Moderate";
    case 3:
      return "Unhealthy for Sensitive Groups";
    case 4:
      return "Unhealthy";
    case 5:
      return "Very Unhealthy";
    case 6:
      return "Hazardous";
    default:
      return "Moderate";
  }
}

function mapAlertSeverity(severityStr?: string): WeatherSeverity {
  if (!severityStr) return "ADVISORY";
  const s = severityStr.toUpperCase();
  if (s.includes("EXTREME") || s.includes("EMERGENCY")) return "EMERGENCY";
  if (s.includes("SEVERE")) return "SEVERE";
  if (s.includes("WARNING")) return "WARNING";
  if (s.includes("WATCH")) return "WATCH";
  if (s.includes("ADVISORY")) return "ADVISORY";
  return "INFO";
}

export class WeatherApiProvider implements IWeatherProvider {
  readonly id = "weatherapi";
  readonly name = "WeatherAPI.com Intelligence";

  private get apiKey(): string | undefined {
    return (
      process.env.WEATHERAPI_API_KEY ||
      process.env.WEATHER_PROVIDER_SECONDARY_API_KEY ||
      process.env.WEATHER_SECONDARY_API_KEY
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.apiKey !== "replace-me");
  }

  async fetchWeather(latitude: number, longitude: number): Promise<NormalizedWeatherReport> {
    if (!this.isConfigured || !this.apiKey) {
      throw new Error("WeatherAPI.com key is not configured.");
    }

    const startTime = Date.now();
    const key = this.apiKey.trim();

    const [riverGauge, res] = await Promise.all([
      getOfficialAssamRiverGauge(latitude, longitude),
      fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${latitude},${longitude}&days=7&aqi=yes&alerts=yes`,
        { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json" } }
      ),
    ]);

    if (!res.ok) {
      throw new Error(`WeatherAPI returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    const cur = data.current || {};
    const loc = data.location || {};
    const condInfo = mapWeatherApiCondition(cur.condition?.text || "", cur.condition?.code || 1000);

    const currentWeather: CurrentWeatherNormalized = {
      temperatureC: cur.temp_c != null ? Math.round(cur.temp_c * 10) / 10 : null,
      feelsLikeC: cur.feelslike_c != null ? Math.round(cur.feelslike_c * 10) / 10 : null,
      humidityPercent: cur.humidity ?? null,
      pressureHpa: cur.pressure_mb ?? null,
      windKmh: cur.wind_kph != null ? Math.round(cur.wind_kph * 10) / 10 : null,
      windDirectionDeg: cur.wind_degree ?? null,
      windGustsKmh: cur.gust_kph != null ? Math.round(cur.gust_kph * 10) / 10 : null,
      visibilityKm: cur.vis_km != null ? Math.round(cur.vis_km * 10) / 10 : null,
      cloudCoverPercent: cur.cloud ?? null,
      precipitationMm: cur.precip_mm ?? null,
      rainMm: cur.precip_mm ?? null,
      weatherCode: cur.condition?.code ?? null,
      condition: cur.condition?.text || "Moderate weather",
      category: condInfo.category,
      icon: condInfo.icon,
      uvIndex: cur.uv ?? null,
    };

    // Hourly
    const hourly24h: HourlyForecastItemNormalized[] = [];
    const forecastDays = data.forecast?.forecastday || [];
    const nowIsoHour = new Date().toISOString().slice(0, 13);

    for (const fDay of forecastDays) {
      const hours = fDay.hour || [];
      for (const h of hours) {
        if (hourly24h.length >= 24) break;
        if (h.time && h.time >= nowIsoHour) {
          const hCond = mapWeatherApiCondition(h.condition?.text || "", h.condition?.code || 1000);
          hourly24h.push({
            time: new Date(h.time_epoch * 1000).toISOString(),
            temperatureC: h.temp_c != null ? Math.round(h.temp_c * 10) / 10 : null,
            feelsLikeC: h.feelslike_c != null ? Math.round(h.feelslike_c * 10) / 10 : null,
            humidityPercent: h.humidity ?? null,
            precipitationProbability: h.chance_of_rain ? Number(h.chance_of_rain) : 0,
            precipitationMm: h.precip_mm != null ? Math.round(h.precip_mm * 10) / 10 : null,
            weatherCode: h.condition?.code ?? null,
            condition: h.condition?.text || "Moderate",
            icon: hCond.icon,
            windKmh: h.wind_kph != null ? Math.round(h.wind_kph * 10) / 10 : null,
          });
        }
      }
    }

    // Daily
    const days7: DailyForecastItemNormalized[] = forecastDays.map((fDay: any) => {
      const d = fDay.day || {};
      const astro = fDay.astro || {};
      const dCond = mapWeatherApiCondition(d.condition?.text || "", d.condition?.code || 1000);
      return {
        date: fDay.date,
        temperatureHighC: d.maxtemp_c != null ? Math.round(d.maxtemp_c * 10) / 10 : null,
        temperatureLowC: d.mintemp_c != null ? Math.round(d.mintemp_c * 10) / 10 : null,
        rainChance: d.daily_chance_of_rain != null ? Number(d.daily_chance_of_rain) : null,
        rainMm: d.totalprecip_mm != null ? Math.round(d.totalprecip_mm * 10) / 10 : null,
        weatherCode: d.condition?.code ?? null,
        condition: d.condition?.text || "Moderate",
        icon: dCond.icon,
        windKmh: d.maxwind_kph != null ? Math.round(d.maxwind_kph * 10) / 10 : null,
        uvIndexMax: d.uv ?? null,
        sunrise: astro.sunrise || null,
        sunset: astro.sunset || null,
      };
    });

    const rainChance = days7[0]?.rainChance ?? null;
    const rainAmount = days7[0]?.rainMm ?? (cur.precip_mm || null);

    // Alerts
    const alerts: WeatherAlert[] = [];
    const apiAlerts = data.alerts?.alert || [];
    for (const a of apiAlerts) {
      alerts.push({
        title: a.headline || a.event || "Weather Alert",
        severity: mapAlertSeverity(a.severity),
        description: a.desc || a.headline || "",
        startTime: a.effective || null,
        endTime: a.expires || null,
        source: "WeatherAPI.com Official Alerts",
      });
    }

    // Air Quality
    const aqiObj = cur.air_quality || {};
    const usEpa = aqiObj["us-epa-index"];
    const airQuality: AirQualityNormalized = {
      aqiUs: usEpa ? usEpa * 50 : null,
      category: mapEpaAqi(usEpa),
      pm25: aqiObj.pm2_5 != null ? Math.round(aqiObj.pm2_5 * 10) / 10 : null,
      pm10: aqiObj.pm10 != null ? Math.round(aqiObj.pm10 * 10) / 10 : null,
      nitrogenDioxide: aqiObj.no2 != null ? Math.round(aqiObj.no2 * 10) / 10 : null,
      ozone: aqiObj.o3 != null ? Math.round(aqiObj.o3 * 10) / 10 : null,
      sulphurDioxide: aqiObj.so2 != null ? Math.round(aqiObj.so2 * 10) / 10 : null,
      carbonMonoxide: aqiObj.co != null ? Math.round(aqiObj.co * 10) / 10 : null,
    };

    const floodRisk: FloodRiskNormalized = {
      riskLevel: (rainAmount && rainAmount > 40) ? "high" : (rainAmount && rainAmount > 15) ? "elevated" : "normal",
      title: (rainAmount && rainAmount > 40) ? "Heavy Rain Flood Watch" : "Normal Conditions",
      summary: "Forecast based on live WeatherAPI atmospheric feed.",
      precipitation24hMm: rainAmount ?? 0,
      precipitationProbabilityMax: rainChance ?? 0,
      riverDischargeM3s: null,
      riverDischargeTrend: "unknown",
      activeFloodZonesCount: 0,
      riverGauge,
    };

    const latencyMs = Date.now() - startTime;

    return {
      available: true,
      provider: this.name,
      location: {
        name: loc.name || undefined,
        region: loc.region || undefined,
        country: loc.country || undefined,
        latitude,
        longitude,
      },
      updatedAt: new Date().toISOString(),
      current: currentWeather,
      forecast: {
        rainChance,
        rainAmountMm: rainAmount,
        hourly24h,
        days7,
      },
      trend: {
        source: "WeatherAPI Outlook",
        pastDays7: [],
      },
      alerts,
      floodRisk,
      airQuality,
      river: riverGauge,
      source: {
        provider: this.name,
        tier: "fallback_2",
        fetchedAt: new Date().toISOString(),
        isCached: false,
        latencyMs,
      },
    };
  }
}
