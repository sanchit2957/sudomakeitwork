import { describe, expect, it } from "vitest";
import { classifyWeatherRisk, getIndiaWeatherRiskGrid } from "./weather.service";
import { PAN_INDIA_WEATHER_HUBS, INDIA_CENTER, INDIA_MAP_BOUNDS } from "@shared/india-locations";
import type { WeatherComprehensiveReport } from "./weather/weather.types";

describe("Pan-India Locations and Boundary", () => {
  it("defines accurate India map center and bounds", () => {
    expect(INDIA_CENTER.lat).toBeCloseTo(20.5937, 2);
    expect(INDIA_CENTER.lng).toBeCloseTo(78.9629, 2);
    expect(INDIA_MAP_BOUNDS.minLat).toBeLessThan(INDIA_MAP_BOUNDS.maxLat);
    expect(INDIA_MAP_BOUNDS.minLng).toBeLessThan(INDIA_MAP_BOUNDS.maxLng);
  });

  it("includes at least 25 strategic meteorological hubs covering all regions of India", () => {
    expect(PAN_INDIA_WEATHER_HUBS.length).toBeGreaterThanOrEqual(25);

    const regions = new Set(PAN_INDIA_WEATHER_HUBS.map((h) => h.region));
    expect(regions.has("North")).toBe(true);
    expect(regions.has("South")).toBe(true);
    expect(regions.has("East")).toBe(true);
    expect(regions.has("West")).toBe(true);
    expect(regions.has("Central")).toBe(true);
    expect(regions.has("North-East")).toBe(true);

    for (const hub of PAN_INDIA_WEATHER_HUBS) {
      expect(hub.id).toBeTruthy();
      expect(hub.name).toBeTruthy();
      expect(hub.state).toBeTruthy();
      expect(hub.latitude).toBeGreaterThanOrEqual(6.0);
      expect(hub.latitude).toBeLessThanOrEqual(38.0);
      expect(hub.longitude).toBeGreaterThanOrEqual(68.0);
      expect(hub.longitude).toBeLessThanOrEqual(98.0);
    }
  });
});

describe("Weather Risk Classification Engine", () => {
  it("classifies severe alerts, torrential rain, and extreme storms as CRITICAL (Red)", () => {
    const torrentialReport: WeatherComprehensiveReport = {
      current: {
        temperatureC: 28,
        feelsLikeC: 32,
        humidityPercent: 95,
        pressureHpa: 1002,
        windKmh: 50,
        windDirectionDeg: 180,
        windGustsKmh: 65,
        visibilityKm: 4,
        cloudCoverPercent: 100,
        precipitationMm: 35,
        rainMm: 35,
        weatherCode: 95,
        condition: "Torrential Rain & Thunderstorm",
        category: "thunderstorm",
        icon: "thunderstorm",
        uvIndex: 1,
      },
      forecast: {
        daily: [],
        hourly: [],
        rainAmountMm: 45,
        rainChance: 90,
      },
      floodAlert: {
        riskLevel: "critical",
        title: "Flash Flood Warning",
        description: "Severe inundation expected",
      },
      alerts: [
        {
          title: "Red Alert: Severe Cyclone / Gale",
          severity: "SEVERE",
          description: "High impact storm",
          startTime: null,
          endTime: null,
          source: "IMD",
        },
      ],
      airQuality: {
        aqiUs: 80,
        category: "Moderate",
        pm25: 25,
        pm10: 45,
        dominantPollutant: "pm25",
      },
      providerHealth: {
        name: "Open-Meteo",
        status: "healthy",
        lastChecked: Date.now(),
      },
      meta: {
        latitude: 26.14,
        longitude: 91.73,
        source: "open-meteo",
        cacheTimestamp: Date.now(),
      },
    };

    const result = classifyWeatherRisk(torrentialReport);
    expect(result.riskLevel).toBe("critical");
    expect(result.riskScore).toBeGreaterThanOrEqual(0.75);
    expect(result.reason).toBeTruthy();
  });

  it("classifies moderate rain, elevated wind, and advisory alerts as MODERATE (Orange)", () => {
    const moderateReport: WeatherComprehensiveReport = {
      current: {
        temperatureC: 26,
        feelsLikeC: 27,
        humidityPercent: 80,
        pressureHpa: 1010,
        windKmh: 28,
        windDirectionDeg: 90,
        windGustsKmh: 38,
        visibilityKm: 8,
        cloudCoverPercent: 85,
        precipitationMm: 8,
        rainMm: 8,
        weatherCode: 61,
        condition: "Moderate Rain",
        category: "rain",
        icon: "rain",
        uvIndex: 3,
      },
      forecast: {
        daily: [],
        hourly: [],
        rainAmountMm: 12,
        rainChance: 70,
      },
      floodAlert: {
        riskLevel: "elevated",
        title: "Waterlogging Advisory",
        description: "Low lying areas may experience localized pooling",
      },
      alerts: [
        {
          title: "Yellow Advisory: Gusty Winds",
          severity: "ADVISORY",
          description: "Winds up to 40 km/h",
          startTime: null,
          endTime: null,
          source: "IMD",
        },
      ],
      airQuality: {
        aqiUs: 130,
        category: "Unhealthy for Sensitive Groups",
        pm25: 48,
        pm10: 80,
        dominantPollutant: "pm25",
      },
      providerHealth: {
        name: "Open-Meteo",
        status: "healthy",
        lastChecked: Date.now(),
      },
      meta: {
        latitude: 19.07,
        longitude: 72.87,
        source: "open-meteo",
        cacheTimestamp: Date.now(),
      },
    };

    const result = classifyWeatherRisk(moderateReport);
    expect(result.riskLevel).toBe("moderate");
    expect(result.riskScore).toBeGreaterThanOrEqual(0.4);
    expect(result.riskScore).toBeLessThan(0.75);
  });

  it("classifies calm, clear weather as GOOD (Green)", () => {
    const calmReport: WeatherComprehensiveReport = {
      current: {
        temperatureC: 24,
        feelsLikeC: 24,
        humidityPercent: 55,
        pressureHpa: 1014,
        windKmh: 10,
        windDirectionDeg: 45,
        windGustsKmh: 14,
        visibilityKm: 10,
        cloudCoverPercent: 20,
        precipitationMm: 0,
        rainMm: 0,
        weatherCode: 0,
        condition: "Clear Sky",
        category: "clear",
        icon: "clear",
        uvIndex: 5,
      },
      forecast: {
        daily: [],
        hourly: [],
        rainAmountMm: 0,
        rainChance: 10,
      },
      floodAlert: {
        riskLevel: "normal",
        title: "No Flood Threat",
        description: "Normal seasonal water levels",
      },
      alerts: [],
      airQuality: {
        aqiUs: 45,
        category: "Good",
        pm25: 11,
        pm10: 22,
        dominantPollutant: "pm25",
      },
      providerHealth: {
        name: "Open-Meteo",
        status: "healthy",
        lastChecked: Date.now(),
      },
      meta: {
        latitude: 28.61,
        longitude: 77.20,
        source: "open-meteo",
        cacheTimestamp: Date.now(),
      },
    };

    const result = classifyWeatherRisk(calmReport);
    expect(result.riskLevel).toBe("good");
    expect(result.riskScore).toBeLessThan(0.4);
  });

  it("classifies null/empty weather reports as unknown gracefully", () => {
    const result = classifyWeatherRisk(null);
    expect(result.riskLevel).toBe("unknown");
    expect(result.riskScore).toBe(0);
  });
});

describe("getIndiaWeatherRiskGrid procedure", () => {
  it("generates a complete Pan-India grid containing all hubs with summary metrics", async () => {
    const grid = await getIndiaWeatherRiskGrid();

    expect(grid).toBeTruthy();
    expect(grid.points.length).toBe(PAN_INDIA_WEATHER_HUBS.length);
    expect(grid.timestamp).toBeGreaterThan(0);
    expect(grid.cacheTtlMs).toBeGreaterThan(0);
    expect(grid.counts).toBeDefined();
    expect(
      grid.counts.critical + grid.counts.moderate + grid.counts.good + grid.counts.unknown
    ).toBe(grid.points.length);

    // Verify each point has valid structure
    for (const pt of grid.points) {
      expect(["good", "moderate", "critical", "unknown"]).toContain(pt.riskLevel);
      expect(pt.name).toBeTruthy();
      expect(pt.state).toBeTruthy();
      expect(pt.latitude).toBeDefined();
      expect(pt.longitude).toBeDefined();
      expect(typeof pt.riskScore).toBe("number");
    }
  });

  it("serves from cache on immediate consecutive calls without refetching", async () => {
    const first = await getIndiaWeatherRiskGrid();
    const second = await getIndiaWeatherRiskGrid();

    expect(first.timestamp).toBe(second.timestamp);
    expect(first.points.length).toBe(second.points.length);
  });
});
