import type { FloodConditionsData, WeatherDay, WeatherHour } from "@/components/FloodConditionsPanel";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const weatherCache = new Map<string, { timestamp: number; data: FloodConditionsData }>();
const inFlightRequests = new Map<string, Promise<FloodConditionsData>>();

export function interpretClientWmoCode(code: number | null | undefined): {
  description: string;
  category: string;
  icon: string;
} {
  if (code === null || code === undefined) {
    return { description: "Normal conditions", category: "cloudy", icon: "cloud" };
  }

  switch (code) {
    case 0:
      return { description: "Clear sky", category: "clear", icon: "sun" };
    case 1:
      return { description: "Mainly clear", category: "clear", icon: "sun-cloud" };
    case 2:
      return { description: "Partly cloudy", category: "cloudy", icon: "cloud-sun" };
    case 3:
      return { description: "Overcast", category: "cloudy", icon: "cloud" };
    case 45:
    case 48:
      return { description: "Foggy", category: "fog", icon: "cloud-fog" };
    case 51:
    case 53:
    case 55:
      return { description: "Light drizzle", category: "drizzle", icon: "cloud-drizzle" };
    case 56:
    case 57:
      return { description: "Freezing drizzle", category: "drizzle", icon: "cloud-drizzle" };
    case 61:
      return { description: "Light rain", category: "rain", icon: "cloud-rain" };
    case 63:
      return { description: "Moderate rain", category: "rain", icon: "cloud-rain" };
    case 65:
      return { description: "Heavy rain", category: "rain", icon: "cloud-rain-wind" };
    case 66:
    case 67:
      return { description: "Freezing rain", category: "rain", icon: "cloud-rain" };
    case 71:
    case 73:
    case 75:
    case 77:
      return { description: "Snowfall", category: "snow", icon: "cloud-snow" };
    case 80:
    case 81:
      return { description: "Rain showers", category: "rain", icon: "cloud-rain" };
    case 82:
      return { description: "Torrential downpours", category: "rain", icon: "cloud-rain-wind" };
    case 85:
    case 86:
      return { description: "Snow showers", category: "snow", icon: "cloud-snow" };
    case 95:
      return { description: "Thunderstorms", category: "thunderstorm", icon: "cloud-lightning" };
    case 96:
    case 99:
      return { description: "Severe thunderstorm with hail", category: "extreme", icon: "cloud-lightning" };
    default:
      return { description: "Moderate weather", category: "cloudy", icon: "cloud" };
  }
}

export async function fetchDirectClientWeather(
  latitude: number,
  longitude: number
): Promise<FloodConditionsData> {
  const cacheKey = `${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
  const now = Date.now();

  const cached = weatherCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const fetchPromise = (async () => {
    try {
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
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo returned status ${response.status}`);
      }

      const raw = await response.json();
      const cur = raw.current || {};
      const daily = raw.daily || {};
      const hourly = raw.hourly || {};

      const curInterpretation = interpretClientWmoCode(cur.weather_code);

      const allDailyRows: WeatherDay[] = (daily.time || []).map((date: string, index: number) => {
        const wCode = daily.weather_code?.[index] ?? null;
        const cond = interpretClientWmoCode(wCode);
        return {
          date,
          temperatureHighC: daily.temperature_2m_max?.[index] ?? null,
          temperatureLowC: daily.temperature_2m_min?.[index] ?? null,
          rainChance: daily.precipitation_probability_max?.[index] ?? null,
          rainMm: daily.precipitation_sum?.[index] ?? null,
          windKmh: daily.wind_speed_10m_max?.[index] ?? null,
          weatherCode: wCode,
          condition: cond.description,
          icon: cond.icon,
          uvIndexMax: daily.uv_index_max?.[index] ?? null,
          sunrise: daily.sunrise?.[index] ?? null,
          sunset: daily.sunset?.[index] ?? null,
        };
      });

      const forecastDays = allDailyRows.slice(-7);
      const pastDays = allDailyRows.slice(0, Math.max(0, allDailyRows.length - 7)).slice(-7);

      const hourlyRows: WeatherHour[] = [];
      const hourlyTimes = (hourly.time || []) as string[];
      const nowHourPrefix = new Date().toISOString().slice(0, 13);
      let startIndex = hourlyTimes.findIndex((t) => t.startsWith(nowHourPrefix));
      if (startIndex < 0) startIndex = 0;

      for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
        const wCode = hourly.weather_code?.[i] ?? null;
        const cond = interpretClientWmoCode(wCode);
        hourlyRows.push({
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

      const todayRainChance = daily.precipitation_probability_max?.[7] ?? daily.precipitation_probability_max?.[0] ?? 0;
      const todayRainAmount = daily.precipitation_sum?.[7] ?? daily.precipitation_sum?.[0] ?? 0;

      let risk = "good";
      if (todayRainAmount >= 50 || (todayRainChance >= 80 && todayRainAmount >= 30)) {
        risk = "critical";
      } else if (todayRainAmount >= 15 || todayRainChance >= 60) {
        risk = "moderate";
      }

      const result: FloodConditionsData = {
        available: true,
        source: "Open-Meteo High-Resolution Ensemble",
        updatedAt: new Date().toISOString(),
        risk,
        activeFloodZones: 0,
        location: {
          latitude,
          longitude,
        },
        current: {
          temperatureC: cur.temperature_2m ?? null,
          feelsLikeC: cur.apparent_temperature ?? null,
          humidityPercent: cur.relative_humidity_2m ?? null,
          pressureHpa: cur.surface_pressure ?? null,
          precipitationMm: cur.precipitation ?? cur.rain ?? 0,
          windKmh: cur.wind_speed_10m ?? null,
          windDirectionDeg: cur.wind_direction_10m ?? null,
          windGustsKmh: cur.wind_gusts_10m ?? null,
          visibilityKm: cur.visibility != null ? Math.round((cur.visibility / 1000) * 10) / 10 : null,
          cloudCoverPercent: cur.cloud_cover ?? null,
          condition: curInterpretation.description,
          category: curInterpretation.category,
          icon: curInterpretation.icon,
          weatherCode: cur.weather_code ?? null,
          uvIndex: daily.uv_index_max?.[7] ?? daily.uv_index_max?.[0] ?? null,
        },
        forecast: {
          rainChance: todayRainChance,
          rainAmountMm: todayRainAmount,
          days: forecastDays,
          hourly24h: hourlyRows,
        },
        trend: {
          source: "Modelled daily weather history",
          days: pastDays,
        },
        river: {
          available: false,
          levelMetres: null,
          trend: null,
          updatedAt: null,
          stationName: null,
          riverName: null,
          distanceKm: null,
          sourceName: "",
          sourceUrl: "",
          message: "No nearby official flood gauge available",
        },
        alerts: [],
      };

      weatherCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch {
      return {
        available: false,
        source: "Weather source unavailable",
        updatedAt: new Date().toISOString(),
        risk: "good",
        activeFloodZones: 0,
        current: {
          temperatureC: null,
          precipitationMm: null,
          windKmh: null,
          weatherCode: null,
        },
        forecast: {
          rainChance: null,
          rainAmountMm: null,
          days: [],
          hourly24h: [],
        },
        trend: {
          source: "Unavailable",
          days: [],
        },
        river: {
          available: false,
          levelMetres: null,
          trend: null,
          updatedAt: null,
          stationName: null,
          riverName: null,
          distanceKm: null,
          sourceName: "",
          sourceUrl: "",
          message: "No nearby official flood gauge available",
        },
      };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
