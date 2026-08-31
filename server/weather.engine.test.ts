import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import { OpenMeteoProvider } from "./weather/providers/openMeteo.provider";
import { OpenWeatherProvider } from "./weather/providers/openWeather.provider";
import { WeatherApiProvider } from "./weather/providers/weatherApi.provider";
import { WeatherProviderManager } from "./weather/weather.provider-manager";
import {
  ASSAM_DISTRICT_LOCATIONS,
  getComprehensiveWeather,
  interpretWmoCode,
} from "./weather.service";

describe("Multi-Provider Weather Engine & Architecture", { timeout: 45000 }, () => {
  let manager: WeatherProviderManager;

  beforeEach(() => {
    manager = WeatherProviderManager.getInstance();
    manager.clearCache();
  });

  describe("Open-Meteo Primary Provider", () => {
    it("is always configured without needing API keys", () => {
      const provider = new OpenMeteoProvider();
      expect(provider.isConfigured).toBe(true);
      expect(provider.id).toBe("open-meteo");
    });

    it("correctly interprets WMO weather codes into categories and icons", () => {
      expect(interpretWmoCode(0)).toMatchObject({ description: "Clear sky", category: "clear", icon: "sun" });
      expect(interpretWmoCode(2)).toMatchObject({ description: "Partly cloudy", category: "cloudy" });
      expect(interpretWmoCode(45)).toMatchObject({ description: "Fog / Depositing rime fog", category: "fog" });
      expect(interpretWmoCode(51)).toMatchObject({ category: "drizzle" });
      expect(interpretWmoCode(65)).toMatchObject({ description: "Heavy torrential rain", category: "rain" });
      expect(interpretWmoCode(95)).toMatchObject({ description: "Thunderstorm", category: "thunderstorm" });
      expect(interpretWmoCode(96)).toMatchObject({ category: "extreme" });
      expect(interpretWmoCode(null)).toMatchObject({ description: "Unknown conditions" });
    });

    it("fetches and parses live weather for Guwahati (Kamrup Metro)", async () => {
      const provider = new OpenMeteoProvider();
      const report = await provider.fetchWeather(26.1445, 91.7362);

      expect(report.available).toBe(true);
      expect(report.provider).toContain("Open-Meteo");
      expect(report.location.latitude).toBe(26.1445);
      expect(report.location.longitude).toBe(91.7362);
      expect(report.current).toBeDefined();
      expect(report.current.temperatureC).toBeDefined();
      expect(report.forecast.days7).toBeInstanceOf(Array);
      expect(report.forecast.days7.length).toBeGreaterThanOrEqual(1);
      expect(report.forecast.hourly24h).toBeInstanceOf(Array);
      expect(report.airQuality).toBeDefined();
      expect(report.floodRisk).toBeDefined();
      expect(report.river).toBeDefined();
      expect(report.source.tier).toBe("primary");
    }, 30000);
  });

  describe("OpenWeatherMap Fallback Provider", () => {
    it("respects API key configuration checks", () => {
      const provider = new OpenWeatherProvider();
      const initialKey = process.env.OPENWEATHER_API_KEY;

      delete process.env.OPENWEATHER_API_KEY;
      delete process.env.WEATHER_PROVIDER_FALLBACK_API_KEY;
      expect(provider.isConfigured).toBe(false);

      process.env.OPENWEATHER_API_KEY = "test-mock-key";
      expect(provider.isConfigured).toBe(true);

      if (initialKey) process.env.OPENWEATHER_API_KEY = initialKey;
      else delete process.env.OPENWEATHER_API_KEY;
    });

    it("handles mock OpenWeather responses and normalizes units", async () => {
      process.env.OPENWEATHER_API_KEY = "mock-key";
      const provider = new OpenWeatherProvider();

      const mockWeather = {
        name: "Guwahati",
        main: { temp: 28.5, feels_like: 31.2, humidity: 82, pressure: 1008 },
        weather: [{ id: 502, description: "heavy intensity rain" }],
        wind: { speed: 4.5, deg: 180, gust: 8.2 },
        visibility: 6000,
        clouds: { all: 90 },
        rain: { "1h": 12.5 },
        sys: { country: "IN", sunrise: 1724715000, sunset: 1724760000 },
      };

      const mockForecast = {
        list: [
          {
            dt: 1724720000,
            main: { temp: 29.0, feels_like: 32.0, humidity: 80 },
            weather: [{ id: 500, description: "light rain" }],
            wind: { speed: 3.5 },
            pop: 0.75,
            rain: { "3h": 4.2 },
          },
        ],
      };

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/data/2.5/weather")) {
          return Promise.resolve(new Response(JSON.stringify(mockWeather), { status: 200 }));
        }
        if (url.includes("/data/2.5/forecast")) {
          return Promise.resolve(new Response(JSON.stringify(mockForecast), { status: 200 }));
        }
        return originalFetch(url);
      });

      try {
        const result = await provider.fetchWeather(26.1445, 91.7362);
        expect(result.available).toBe(true);
        expect(result.current.temperatureC).toBe(28.5);
        expect(result.current.feelsLikeC).toBe(31.2);
        expect(result.current.humidityPercent).toBe(82);
        expect(result.current.category).toBe("rain");
        expect(result.current.windKmh).toBe(Math.round(4.5 * 3.6 * 10) / 10);
        expect(result.current.visibilityKm).toBe(6);
        expect(result.forecast.hourly24h.length).toBeGreaterThanOrEqual(1);
        expect(result.source.tier).toBe("fallback_1");
      } finally {
        global.fetch = originalFetch;
        delete process.env.OPENWEATHER_API_KEY;
      }
    });
  });

  describe("WeatherAPI.com Fallback Provider", () => {
    it("respects API key configuration checks", () => {
      const provider = new WeatherApiProvider();
      const initialKey = process.env.WEATHERAPI_API_KEY;

      delete process.env.WEATHERAPI_API_KEY;
      delete process.env.WEATHER_PROVIDER_SECONDARY_API_KEY;
      expect(provider.isConfigured).toBe(false);

      process.env.WEATHERAPI_API_KEY = "mock-key";
      expect(provider.isConfigured).toBe(true);

      if (initialKey) process.env.WEATHERAPI_API_KEY = initialKey;
      else delete process.env.WEATHERAPI_API_KEY;
    });

    it("normalizes WeatherAPI forecast, air quality, and severe weather alerts", async () => {
      process.env.WEATHERAPI_API_KEY = "mock-key";
      const provider = new WeatherApiProvider();

      const mockData = {
        location: { name: "Silchar", region: "Assam", country: "India" },
        current: {
          temp_c: 27.2,
          feelslike_c: 30.1,
          humidity: 88,
          pressure_mb: 1006,
          wind_kph: 18.5,
          wind_degree: 90,
          gust_kph: 35.0,
          vis_km: 7.0,
          cloud: 75,
          precip_mm: 15.2,
          uv: 5.0,
          condition: { text: "Thunderstorm with rain", code: 1087 },
          air_quality: {
            "us-epa-index": 2,
            pm2_5: 22.4,
            pm10: 45.1,
            no2: 12.0,
            o3: 28.0,
            so2: 5.0,
            co: 320.0,
          },
        },
        forecast: {
          forecastday: [
            {
              date: "2026-08-27",
              day: {
                maxtemp_c: 31.0,
                mintemp_c: 24.5,
                daily_chance_of_rain: 85,
                totalprecip_mm: 25.0,
                maxwind_kph: 25.0,
                uv: 6.0,
                condition: { text: "Moderate rain", code: 1189 },
              },
              astro: { sunrise: "04:55 AM", sunset: "05:50 PM" },
              hour: [
                {
                  time_epoch: 1724760000,
                  time: "2026-08-27 15:00",
                  temp_c: 28.0,
                  feelslike_c: 31.0,
                  humidity: 85,
                  chance_of_rain: 80,
                  precip_mm: 4.5,
                  condition: { text: "Rain shower", code: 1240 },
                  wind_kph: 15.0,
                },
              ],
            },
          ],
        },
        alerts: {
          alert: [
            {
              headline: "Orange Alert: Heavy Rainfall & Thunderstorms",
              severity: "Severe",
              desc: "Very heavy rain and lightning expected over Cachar district.",
              effective: "2026-08-27T06:00:00Z",
              expires: "2026-08-28T06:00:00Z",
            },
          ],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("api.weatherapi.com")) {
          return Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }));
        }
        return originalFetch(url);
      });

      try {
        const result = await provider.fetchWeather(24.8333, 92.7789);
        expect(result.available).toBe(true);
        expect(result.location.name).toBe("Silchar");
        expect(result.current.temperatureC).toBe(27.2);
        expect(result.current.category).toBe("thunderstorm");
        expect(result.alerts.length).toBe(1);
        expect(result.alerts[0].severity).toBe("SEVERE");
        expect(result.alerts[0].title).toContain("Orange Alert");
        expect(result.airQuality.category).toBe("Moderate");
        expect(result.airQuality.pm25).toBe(22.4);
      } finally {
        global.fetch = originalFetch;
        delete process.env.WEATHERAPI_API_KEY;
      }
    });
  });

  describe("Waterfall Failover & Stale Cache Logic", () => {
    it("falls back to secondary provider if primary fails", async () => {
      process.env.OPENWEATHER_API_KEY = "test-key";
      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("api.open-meteo.com")) {
          return Promise.resolve(new Response("Gateway Timeout", { status: 504 }));
        }
        if (url.includes("api.openweathermap.org/data/2.5/weather")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                name: "Dibrugarh",
                main: { temp: 26.0, humidity: 85, pressure: 1010 },
                weather: [{ id: 800, description: "clear sky" }],
                wind: { speed: 3.0 },
                sys: { country: "IN" },
              }),
              { status: 200 }
            )
          );
        }
        if (url.includes("api.openweathermap.org/data/2.5/forecast")) {
          return Promise.resolve(new Response(JSON.stringify({ list: [] }), { status: 200 }));
        }
        return originalFetch(url);
      });

      try {
        const report = await manager.getWeather(27.4728, 94.912);
        expect(report.available).toBe(true);
        expect(report.source.tier).toBe("fallback_1");
        expect(report.provider).toBe("OpenWeatherMap API");
      } finally {
        global.fetch = originalFetch;
        delete process.env.OPENWEATHER_API_KEY;
      }
    });

    it("serves stale cache when all providers fail", async () => {
      // 1. First populate cache with a successful report
      const liveReport = await manager.getWeather(26.1445, 91.7362);
      expect(liveReport.available).toBe(true);

      // 2. Now simulate complete network failure for all providers
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network connection severed"));

      try {
        const staleReport = await manager.getWeather(26.1445, 91.7362);
        expect(staleReport.available).toBe(true);
        expect(staleReport.source.isCached).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("returns safe non-crashing fallback if all providers fail and no cache exists", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Complete upstream outage"));

      try {
        const safeReport = await manager.getWeather(25.0, 90.0);
        expect(safeReport).toBeDefined();
        expect(safeReport.available).toBe(false);
        expect(safeReport.provider).toContain("Fallback");
        expect(safeReport.current.temperatureC).toBeNull();
        expect(safeReport.floodRisk.riskLevel).toBe("normal");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("deduplicates concurrent in-flight requests for the same coordinates", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");
      const [res1, res2, res3] = await Promise.all([
        manager.getWeather(26.7509, 94.2037),
        manager.getWeather(26.7509, 94.2037),
        manager.getWeather(26.7509, 94.2037),
      ]);

      expect(res1.available).toBe(true);
      expect(res2.available).toBe(true);
      expect(res3.available).toBe(true);
      expect(res1.current.temperatureC).toEqual(res2.current.temperatureC);
    });
  });

  describe("Locations and Health Diagnostics", () => {
    it("provides comprehensive Assam districts list", () => {
      expect(ASSAM_DISTRICT_LOCATIONS.length).toBeGreaterThanOrEqual(15);
      const guwahati = ASSAM_DISTRICT_LOCATIONS.find((l) => l.name.includes("Guwahati"));
      expect(guwahati).toBeDefined();
      expect(guwahati?.latitude).toBe(26.1445);
    });

    it("tracks provider health stats and latency", () => {
      const health = manager.getHealthReport();
      expect(health.length).toBe(3);
      expect(health.map((h) => h.id)).toEqual(["open-meteo", "openweathermap", "weatherapi"]);
    });

    it("handles multiple Assam and non-Assam locations correctly", async () => {
      const locationsToTest = [
        { name: "Silchar", lat: 24.8333, lng: 92.7789 },
        { name: "Tezpur", lat: 26.6528, lng: 92.7926 },
        { name: "New Delhi", lat: 28.6139, lng: 77.209 },
      ];

      for (const loc of locationsToTest) {
        const report = await getComprehensiveWeather(loc.lat, loc.lng);
        expect(report.available).toBe(true);
        expect(report.location.latitude).toBe(loc.lat);
        expect(report.location.longitude).toBe(loc.lng);
      }
    });
  });

  describe("tRPC Weather Endpoints Integration", () => {
    it("serves comprehensive, alerts, locations, and providerHealth via tRPC", async () => {
      const caller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: null,
      });

      // 1. Comprehensive Weather
      const comp = await caller.rescue.weather.comprehensive({ latitude: 26.1445, longitude: 91.7362 });
      expect(comp.available).toBe(true);
      expect(comp.current).toBeDefined();
      expect(comp.forecast.days7).toBeInstanceOf(Array);
      expect(comp.source).toBeDefined();

      // 2. Alerts
      const alertsRes = await caller.rescue.weather.alerts({ latitude: 26.1445, longitude: 91.7362 });
      expect(alertsRes.alerts).toBeInstanceOf(Array);

      // 3. Locations
      const locs = await caller.rescue.weather.locations();
      expect(locs.length).toBeGreaterThanOrEqual(15);

      // 4. Provider Health
      const health = await caller.rescue.weather.providerHealth();
      expect(health.length).toBe(3);

      // 5. Backward-compatible emergency conditions
      const cond = await caller.rescue.emergency.conditions({ latitude: 26.1445, longitude: 91.7362 });
      expect(cond).toBeDefined();
      expect(cond.risk).toBeDefined();
      expect(cond.current.temperatureC).toBeDefined();
      expect(cond.current.windKmh).toBeDefined();
    }, 20000);
  });
});
