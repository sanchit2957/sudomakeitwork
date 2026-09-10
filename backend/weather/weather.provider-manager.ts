import { INDIA_CENTER } from "../../shared/india-locations";
import { getOfficialAssamRiverGauge } from "../assam-river-gauge";
import { OpenMeteoProvider } from "./providers/openMeteo.provider";
import { OpenWeatherProvider } from "./providers/openWeather.provider";
import { WeatherApiProvider } from "./providers/weatherApi.provider";
import type {
  IWeatherProvider,
  NormalizedWeatherReport,
  ProviderHealthStats,
} from "./weather.types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
const STALE_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours stale fallback
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

export class WeatherProviderManager {
  private static instance: WeatherProviderManager;

  private providers: IWeatherProvider[];
  private healthStats: Map<string, ProviderHealthStats> = new Map();
  private cache: Map<string, { timestamp: number; data: NormalizedWeatherReport }> = new Map();
  private inFlightRequests: Map<string, Promise<NormalizedWeatherReport>> = new Map();

  private constructor() {
    this.providers = [
      new OpenMeteoProvider(),
      new OpenWeatherProvider(),
      new WeatherApiProvider(),
    ];

    for (const p of this.providers) {
      this.healthStats.set(p.id, {
        id: p.id,
        name: p.name,
        isConfigured: p.isConfigured,
        totalRequests: 0,
        successes: 0,
        failures: 0,
        consecutiveFailures: 0,
        avgLatencyMs: 0,
      });
    }
  }

  public static getInstance(): WeatherProviderManager {
    if (!WeatherProviderManager.instance) {
      WeatherProviderManager.instance = new WeatherProviderManager();
    }
    return WeatherProviderManager.instance;
  }

  public getHealthReport(): ProviderHealthStats[] {
    return Array.from(this.healthStats.values()).map((h) => {
      const provider = this.providers.find((p) => p.id === h.id);
      return {
        ...h,
        isConfigured: provider ? provider.isConfigured : h.isConfigured,
      };
    });
  }

  /**
   * Resets internal cache and circuit breaker status (useful in tests)
   */
  public clearCache(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
    this.healthStats.forEach((stats) => {
      stats.disabledUntil = undefined;
      stats.consecutiveFailures = 0;
    });
  }

  /**
   * Main entrypoint to obtain weather for coordinates
   */
  public async getWeather(
    latitude: number = INDIA_CENTER.lat,
    longitude: number = INDIA_CENTER.lng,
    activeFloodZonesCount: number = 0
  ): Promise<NormalizedWeatherReport> {
    // Validate coordinates
    const validLat = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : INDIA_CENTER.lat;
    const validLng = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : INDIA_CENTER.lng;

    const cacheKey = getCacheKey(validLat, validLng);
    const now = Date.now();

    // 1. Check Fresh In-Memory Cache
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.data,
        source: {
          ...cached.data.source,
          isCached: true,
          cacheTimestamp: cached.timestamp,
        },
        floodRisk: {
          ...cached.data.floodRisk,
          activeFloodZonesCount,
        },
      };
    }

    // 2. In-flight Request Deduplication
    const activePromise = this.inFlightRequests.get(cacheKey);
    if (activePromise) {
      const result = await activePromise;
      return {
        ...result,
        floodRisk: {
          ...result.floodRisk,
          activeFloodZonesCount,
        },
      };
    }

    // 3. Initiate fetch with automatic failover
    const fetchPromise = this.executeWaterfallWithFailover(validLat, validLng, activeFloodZonesCount, cacheKey);
    this.inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const report = await fetchPromise;
      if (this.cache.size >= 50) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(cacheKey, { timestamp: Date.now(), data: report });
      return report;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  private async executeWaterfallWithFailover(
    latitude: number,
    longitude: number,
    activeFloodZonesCount: number,
    cacheKey: string
  ): Promise<NormalizedWeatherReport> {
    const now = Date.now();
    const candidateProviders = this.providers.filter((p) => {
      if (!p.isConfigured) return false;
      const stats = this.healthStats.get(p.id);
      if (stats?.disabledUntil && stats.disabledUntil > now) {
        return false; // In circuit-breaker cooldown
      }
      return true;
    });

    const errors: Array<{ providerId: string; error: any }> = [];

    for (let i = 0; i < candidateProviders.length; i++) {
      const provider = candidateProviders[i];
      const stats = this.healthStats.get(provider.id)!;
      const tier = i === 0 ? "primary" : i === 1 ? "fallback_1" : "fallback_2";
      const start = Date.now();

      try {
        stats.totalRequests++;
        stats.lastUsedAt = new Date().toISOString();

        const report = await provider.fetchWeather(latitude, longitude);
        const duration = Date.now() - start;

        // Record health success
        stats.successes++;
        stats.consecutiveFailures = 0;
        stats.lastLatencyMs = duration;
        stats.avgLatencyMs = stats.avgLatencyMs === 0 ? duration : Math.round((stats.avgLatencyMs * 0.8) + (duration * 0.2));
        delete stats.disabledUntil;

        return {
          ...report,
          floodRisk: {
            ...report.floodRisk,
            activeFloodZonesCount,
          },
          source: {
            ...report.source,
            tier,
            latencyMs: duration,
          },
        };
      } catch (err: any) {
        const duration = Date.now() - start;
        stats.failures++;
        stats.consecutiveFailures++;
        stats.lastFailureReason = err?.message || "Unknown error";
        stats.lastLatencyMs = duration;

        if (stats.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          stats.disabledUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
          console.warn(`[WeatherProviderManager] Provider ${provider.name} failed ${stats.consecutiveFailures} times consecutively. Tripping circuit breaker for 2m.`);
        }

        errors.push({ providerId: provider.id, error: err });
        console.warn(`[WeatherProviderManager] Provider ${provider.name} failed (${err?.message}). Attempting next fallback...`);
      }
    }

    // 4. If all live providers fail, attempt to return Stale Cache
    const stale = this.cache.get(cacheKey);
    if (stale && now - stale.timestamp < STALE_CACHE_MAX_AGE_MS) {
      console.warn(`[WeatherProviderManager] All live providers failed. Serving stale cached data from ${new Date(stale.timestamp).toISOString()}`);
      return {
        ...stale.data,
        source: {
          ...stale.data.source,
          tier: "cached",
          isCached: true,
          cacheTimestamp: stale.timestamp,
        },
        floodRisk: {
          ...stale.data.floodRisk,
          activeFloodZonesCount,
        },
      };
    }

    // 5. If no cache exists, return Graceful Safe Fallback
    console.error("[WeatherProviderManager] All providers and stale cache failed. Generating safe offline model.", errors);
    const riverGauge = await getOfficialAssamRiverGauge(latitude, longitude);

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
        windKmh: null,
        windDirectionDeg: null,
        windGustsKmh: null,
        visibilityKm: null,
        cloudCoverPercent: null,
        precipitationMm: null,
        rainMm: null,
        weatherCode: null,
        condition: "Weather service temporarily unavailable",
        category: "cloudy",
        icon: "cloud",
        uvIndex: null,
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
      alerts: [],
      floodRisk: {
        riskLevel: "normal",
        title: "Conditions Unavailable",
        summary: "Weather station temporarily unreachable. Follow local authority guidance.",
        precipitation24hMm: 0,
        precipitationProbabilityMax: 0,
        riverDischargeM3s: null,
        riverDischargeTrend: "unknown",
        activeFloodZonesCount,
        riverGauge,
      },
      airQuality: {
        aqiUs: null,
        category: "Unavailable",
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
        carbonMonoxide: null,
      },
      river: riverGauge,
      source: {
        provider: "Offline / Safe Fallback",
        tier: "offline",
        fetchedAt: new Date().toISOString(),
        isCached: false,
        latencyMs: 0,
      },
    };
  }
}

export const weatherProviderManager = WeatherProviderManager.getInstance();
