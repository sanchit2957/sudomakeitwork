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

function mapOwmCondition(id: number): {
  description: string;
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
} {
  if (id >= 200 && id < 300) {
    return { description: "Thunderstorm", category: "thunderstorm", icon: "cloud-lightning" };
  }
  if (id >= 300 && id < 400) {
    return { description: "Drizzle", category: "drizzle", icon: "cloud-drizzle" };
  }
  if (id >= 500 && id < 600) {
    if (id >= 502) return { description: "Heavy torrential rain", category: "rain", icon: "cloud-rain-wind" };
    return { description: "Rain", category: "rain", icon: "cloud-rain" };
  }
  if (id >= 600 && id < 700) {
    return { description: "Snow", category: "snow", icon: "cloud-snow" };
  }
  if (id >= 700 && id < 800) {
    return { description: "Mist / Fog", category: "fog", icon: "cloud-fog" };
  }
  if (id === 800) {
    return { description: "Clear sky", category: "clear", icon: "sun" };
  }
  if (id === 801) {
    return { description: "Few clouds", category: "clear", icon: "sun-cloud" };
  }
  if (id === 802) {
    return { description: "Scattered clouds", category: "cloudy", icon: "cloud-sun" };
  }
  return { description: "Overcast", category: "cloudy", icon: "cloud" };
}

export class OpenWeatherProvider implements IWeatherProvider {
  readonly id = "openweathermap";
  readonly name = "OpenWeatherMap API";

  private get apiKey(): string | undefined {
    return (
      process.env.OPENWEATHER_API_KEY ||
      process.env.WEATHER_PROVIDER_FALLBACK_API_KEY ||
      process.env.WEATHER_PRIMARY_API_KEY ||
      process.env.WEATHER_FALLBACK_API_KEY
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.apiKey !== "replace-me");
  }

  async fetchWeather(latitude: number, longitude: number): Promise<NormalizedWeatherReport> {
    if (!this.isConfigured || !this.apiKey) {
      throw new Error("OpenWeatherMap API key is not configured.");
    }

    const startTime = Date.now();
    const key = this.apiKey.trim();

    const [riverGauge, currentWeatherRes, forecastRes] = await Promise.all([
      getOfficialAssamRiverGauge(latitude, longitude),
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${key}`,
        { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json" } }
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${key}`,
        { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json" } }
      ),
    ]);

    if (!currentWeatherRes.ok) {
      throw new Error(`OpenWeather current API returned HTTP ${currentWeatherRes.status}`);
    }

    const curData = (await currentWeatherRes.json()) as any;
    const forecastData = forecastRes.ok ? ((await forecastRes.json()) as any) : null;

    const weatherObj = curData.weather?.[0] || {};
    const cond = mapOwmCondition(weatherObj.id || 800);
    const windSpeedKmh = curData.wind?.speed != null ? Math.round(curData.wind.speed * 3.6 * 10) / 10 : null;
    const windGustKmh = curData.wind?.gust != null ? Math.round(curData.wind.gust * 3.6 * 10) / 10 : null;
    const rain1h = curData.rain?.["1h"] ?? curData.rain?.["3h"] ?? 0;

    const currentWeather: CurrentWeatherNormalized = {
      temperatureC: curData.main?.temp != null ? Math.round(curData.main.temp * 10) / 10 : null,
      feelsLikeC: curData.main?.feels_like != null ? Math.round(curData.main.feels_like * 10) / 10 : null,
      humidityPercent: curData.main?.humidity ?? null,
      pressureHpa: curData.main?.pressure ?? null,
      windKmh: windSpeedKmh,
      windDirectionDeg: curData.wind?.deg ?? null,
      windGustsKmh: windGustKmh,
      visibilityKm: curData.visibility != null ? Math.round((curData.visibility / 1000) * 10) / 10 : null,
      cloudCoverPercent: curData.clouds?.all ?? null,
      precipitationMm: rain1h,
      rainMm: rain1h,
      weatherCode: weatherObj.id ?? null,
      condition: weatherObj.description ? weatherObj.description.charAt(0).toUpperCase() + weatherObj.description.slice(1) : cond.description,
      category: cond.category,
      icon: cond.icon,
      uvIndex: null,
    };

    // Parse forecast items (3-hour steps -> hourly & daily aggregates)
    const hourly24h: HourlyForecastItemNormalized[] = [];
    const dailyMap = new Map<string, {
      date: string;
      temps: number[];
      rainSum: number;
      rainPopMax: number;
      weatherCodes: number[];
      windSpeeds: number[];
    }>();

    if (forecastData?.list && Array.isArray(forecastData.list)) {
      for (let i = 0; i < forecastData.list.length; i++) {
        const item = forecastData.list[i];
        const dt = new Date(item.dt * 1000);
        const iso = dt.toISOString();
        const dateStr = iso.slice(0, 10);
        const itemCond = mapOwmCondition(item.weather?.[0]?.id || 800);
        const rainMm = item.rain?.["3h"] ?? 0;
        const popPercent = item.pop != null ? Math.round(item.pop * 100) : 0;
        const windKmh = item.wind?.speed != null ? Math.round(item.wind.speed * 3.6 * 10) / 10 : null;

        if (hourly24h.length < 8) {
          hourly24h.push({
            time: iso,
            temperatureC: item.main?.temp != null ? Math.round(item.main.temp * 10) / 10 : null,
            feelsLikeC: item.main?.feels_like != null ? Math.round(item.main.feels_like * 10) / 10 : null,
            humidityPercent: item.main?.humidity ?? null,
            precipitationProbability: popPercent,
            precipitationMm: rainMm,
            weatherCode: item.weather?.[0]?.id ?? null,
            condition: itemCond.description,
            icon: itemCond.icon,
            windKmh,
          });
        }

        let dayEntry = dailyMap.get(dateStr);
        if (!dayEntry) {
          dayEntry = {
            date: dateStr,
            temps: [],
            rainSum: 0,
            rainPopMax: 0,
            weatherCodes: [],
            windSpeeds: [],
          };
          dailyMap.set(dateStr, dayEntry);
        }

        if (item.main?.temp != null) dayEntry.temps.push(item.main.temp);
        dayEntry.rainSum += rainMm;
        if (popPercent > dayEntry.rainPopMax) dayEntry.rainPopMax = popPercent;
        if (item.weather?.[0]?.id) dayEntry.weatherCodes.push(item.weather[0].id);
        if (windKmh != null) dayEntry.windSpeeds.push(windKmh);
      }
    }

    const days7: DailyForecastItemNormalized[] = Array.from(dailyMap.values()).map((d) => {
      const maxTemp = d.temps.length ? Math.round(Math.max(...d.temps) * 10) / 10 : null;
      const minTemp = d.temps.length ? Math.round(Math.min(...d.temps) * 10) / 10 : null;
      const primaryCode = d.weatherCodes[Math.floor(d.weatherCodes.length / 2)] || 800;
      const dayCond = mapOwmCondition(primaryCode);
      const maxWind = d.windSpeeds.length ? Math.max(...d.windSpeeds) : null;

      return {
        date: d.date,
        temperatureHighC: maxTemp,
        temperatureLowC: minTemp,
        rainChance: d.rainPopMax,
        rainMm: Math.round(d.rainSum * 10) / 10,
        weatherCode: primaryCode,
        condition: dayCond.description,
        icon: dayCond.icon,
        windKmh: maxWind,
        uvIndexMax: null,
        sunrise: curData.sys?.sunrise ? new Date(curData.sys.sunrise * 1000).toISOString() : null,
        sunset: curData.sys?.sunset ? new Date(curData.sys.sunset * 1000).toISOString() : null,
      };
    });

    const rainChance = days7[0]?.rainChance ?? null;
    const rainAmount = days7[0]?.rainMm ?? (rain1h || null);

    const alerts: WeatherAlert[] = [];
    if (rain1h >= 25 || (rainAmount && rainAmount >= 40)) {
      alerts.push({
        title: "Heavy Rainfall Warning",
        severity: "WARNING",
        description: `Persistent precipitation detected (${Math.round(rainAmount || rain1h)} mm). Be prepared for localized surface flooding.`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
        source: "OpenWeatherMap",
      });
    }

    const floodRisk: FloodRiskNormalized = {
      riskLevel: (rainAmount && rainAmount > 40) ? "high" : (rainAmount && rainAmount > 15) ? "elevated" : "normal",
      title: (rainAmount && rainAmount > 40) ? "Heavy Rain Flood Watch" : "Normal Conditions",
      summary: "Forecast based on live OpenWeatherMap atmospheric feed.",
      precipitation24hMm: rainAmount ?? 0,
      precipitationProbabilityMax: rainChance ?? 0,
      riverDischargeM3s: null,
      riverDischargeTrend: "unknown",
      activeFloodZonesCount: 0,
      riverGauge,
    };

    const airQuality: AirQualityNormalized = {
      aqiUs: null,
      category: "Unavailable",
      pm25: null,
      pm10: null,
      nitrogenDioxide: null,
      ozone: null,
      sulphurDioxide: null,
      carbonMonoxide: null,
    };

    const latencyMs = Date.now() - startTime;

    return {
      available: true,
      provider: this.name,
      location: {
        name: curData.name || undefined,
        latitude,
        longitude,
        country: curData.sys?.country || undefined,
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
        source: "OpenWeatherMap 5-Day Outlook",
        pastDays7: [],
      },
      alerts,
      floodRisk,
      airQuality,
      river: riverGauge,
      source: {
        provider: this.name,
        tier: "fallback_1",
        fetchedAt: new Date().toISOString(),
        isCached: false,
        latencyMs,
      },
    };
  }
}
