import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import {
  calculateRiskScore,
  clearFloodAlertStateCache,
  getConsolidatedFloodConditions,
  getFloodAlertStatus,
  registerFloodRoutes,
} from "./flood";
import { weatherProviderManager } from "./weather.service";

describe("Feature #2: Flood Risk Early-Warning & Operations Alert Workflow", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    clearFloodAlertStateCache();
    weatherProviderManager.clearCache();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("TEST 1: Flood conditions endpoint returns valid available project data", async () => {
    const conditions = await getConsolidatedFloodConditions(26.1445, 91.7362);

    expect(conditions).toBeDefined();
    expect(conditions.timestamp).toBeDefined();
    expect(conditions.overallRisk).toBeDefined();
    expect(typeof conditions.riskScore).toBe("number");
    expect(conditions.weather).toBeDefined();
    expect(conditions.river).toBeDefined();
    expect(conditions.floodZones).toBeDefined();
    expect(conditions.dataFreshness).toBeDefined();
  }, 30000);

  it("TEST 2: Stale or unavailable data is correctly indicated with isFresh=false and staleSources", async () => {
    // Mock weather service fallback to simulate offline/unavailable provider
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: false,
      provider: "Offline / Safe Fallback",
      location: { latitude: 26.1445, longitude: 91.7362 },
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
        condition: "Service offline",
        category: "cloudy",
        icon: "cloud",
        uvIndex: null,
      },
      forecast: { rainChance: null, rainAmountMm: null, hourly24h: [], days7: [] },
      trend: { source: "Unavailable", pastDays7: [] },
      alerts: [],
      floodRisk: {
        riskLevel: "normal",
        title: "Conditions Unavailable",
        summary: "Weather station temporarily unreachable.",
        precipitation24hMm: 0,
        precipitationProbabilityMax: 0,
        riverDischargeM3s: null,
        riverDischargeTrend: "unknown",
        activeFloodZonesCount: 0,
        riverGauge: null,
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
      river: {
        available: false,
        levelMetres: null,
        trend: null,
        updatedAt: null,
        stationName: null,
        riverName: null,
        distanceKm: null,
        sourceName: "Official Assam Telemetry",
        sourceUrl: "https://nwdp.nwic.gov.in",
        message: "Telemetry offline",
      },
      source: {
        provider: "Offline",
        tier: "offline",
        fetchedAt: new Date().toISOString(),
        isCached: false,
      },
    });

    const conditions = await getConsolidatedFloodConditions(26.1445, 91.7362);

    expect(conditions.dataFreshness.isFresh).toBe(false);
    expect(conditions.dataFreshness.providerTier).toBe("offline");
    expect(conditions.dataFreshness.staleSources).toContain("weather_provider");
    expect(conditions.overallRisk).toBe("unknown");
  });

  it("TEST 3: Existing flood risk values (normal, elevated, high, critical) are preserved", () => {
    const normalScore = calculateRiskScore("normal", 5, 20, "steady");
    const elevatedScore = calculateRiskScore("elevated", 25, 65, "steady");
    const highScore = calculateRiskScore("high", 60, 90, "rising");
    const criticalScore = calculateRiskScore("critical", 120, 100, "rising");

    expect(normalScore).toBeGreaterThanOrEqual(0.0);
    expect(normalScore).toBeLessThan(0.40);

    expect(elevatedScore).toBeGreaterThanOrEqual(0.40);
    expect(elevatedScore).toBeLessThan(0.70);

    expect(highScore).toBeGreaterThanOrEqual(0.70);
    expect(highScore).toBeLessThan(0.88);

    expect(criticalScore).toBeGreaterThanOrEqual(0.88);
    expect(criticalScore).toBeLessThanOrEqual(1.0);
  });

  it("TEST 4: High-risk conditions can be distinguished from normal conditions", async () => {
    // Mock initial normal flood risk
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: { temperatureC: 28, feelsLikeC: 29, humidityPercent: 60, pressureHpa: 1012, windKmh: 10, windDirectionDeg: 120, windGustsKmh: 15, visibilityKm: 10, cloudCoverPercent: 20, precipitationMm: 0, rainMm: 0, weatherCode: 1, condition: "Mainly clear", category: "clear", icon: "sun", uvIndex: 5 },
      forecast: { rainChance: 10, rainAmountMm: 2, hourly24h: [], days7: [] },
      trend: { source: "Forecast", pastDays7: [] },
      alerts: [],
      floodRisk: { riskLevel: "normal", title: "Normal Monsoon Conditions", summary: "Typical regional drainage capacity", precipitation24hMm: 2, precipitationProbabilityMax: 10, riverDischargeM3s: 200, riverDischargeTrend: "steady", activeFloodZonesCount: 0, riverGauge: null },
      airQuality: { aqiUs: 40, category: "Good", pm25: 10, pm10: 20, nitrogenDioxide: 5, ozone: 15, sulphurDioxide: 2, carbonMonoxide: 0.3 },
      river: { available: true, levelMetres: 45.0, trend: "steady", updatedAt: new Date(), stationName: "Gauge", riverName: "Brahmaputra", distanceKm: 5.2, sourceName: "NWDP", sourceUrl: "https://nwdp.nwic.gov.in", message: "Live" },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });
    const statusLow = await getFloodAlertStatus(26.1445, 91.7362);
    expect(statusLow.currentRisk).toBe("normal");

    weatherProviderManager.clearCache();
    // Mock high flood risk
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: {
        temperatureC: 27,
        feelsLikeC: 29,
        humidityPercent: 90,
        pressureHpa: 1005,
        windKmh: 20,
        windDirectionDeg: 180,
        windGustsKmh: 35,
        visibilityKm: 5,
        cloudCoverPercent: 100,
        precipitationMm: 15,
        rainMm: 15,
        weatherCode: 65,
        condition: "Heavy torrential rain",
        category: "rain",
        icon: "cloud-rain",
        uvIndex: 2,
      },
      forecast: { rainChance: 95, rainAmountMm: 80, hourly24h: [], days7: [] },
      trend: { source: "Forecast Model", pastDays7: [] },
      alerts: [],
      floodRisk: {
        riskLevel: "high",
        title: "High Flood Risk",
        summary: "Intense rainfall detected.",
        precipitation24hMm: 80,
        precipitationProbabilityMax: 95,
        riverDischargeM3s: 650,
        riverDischargeTrend: "rising",
        activeFloodZonesCount: 2,
        riverGauge: null,
      },
      airQuality: {
        aqiUs: 40,
        category: "Good",
        pm25: 10,
        pm10: 20,
        nitrogenDioxide: 5,
        ozone: 15,
        sulphurDioxide: 2,
        carbonMonoxide: 0.3,
      },
      river: {
        available: true,
        levelMetres: 49.2,
        trend: "rising",
        updatedAt: new Date(),
        stationName: "Guwahati Gauge",
        riverName: "Brahmaputra",
        distanceKm: 5.2,
        sourceName: "Official Assam Telemetry",
        sourceUrl: "https://nwdp.nwic.gov.in",
        message: "Live telemetry",
      },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });

    const statusHigh = await getFloodAlertStatus(26.1445, 91.7362);

    expect(statusHigh.currentRisk).toBe("high");
    expect(statusHigh.shouldAlert).toBe(true);
    expect(statusHigh.action).toBe("trigger_alert");
  });

  it("TEST 5: Duplicate alert state can be identified and suppressed", async () => {
    // Helper to generate mock high risk report
    const mockHighReport = (): NormalizedWeatherReport => ({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: {
        temperatureC: 27, feelsLikeC: 29, humidityPercent: 90, pressureHpa: 1005, windKmh: 20, windDirectionDeg: 180, windGustsKmh: 35, visibilityKm: 5, cloudCoverPercent: 100, precipitationMm: 15, rainMm: 15, weatherCode: 65, condition: "Torrential Rain", category: "rain", icon: "cloud-rain", uvIndex: 2,
      },
      forecast: { rainChance: 95, rainAmountMm: 80, hourly24h: [], days7: [] },
      trend: { source: "Forecast", pastDays7: [] },
      alerts: [],
      floodRisk: {
        riskLevel: "high",
        title: "High Flood Risk",
        summary: "Intense rainfall detected.",
        precipitation24hMm: 80,
        precipitationProbabilityMax: 95,
        riverDischargeM3s: 650,
        riverDischargeTrend: "rising",
        activeFloodZonesCount: 2,
        riverGauge: null,
      },
      airQuality: { aqiUs: 40, category: "Good", pm25: 10, pm10: 20, nitrogenDioxide: 5, ozone: 15, sulphurDioxide: 2, carbonMonoxide: 0.3 },
      river: { available: true, levelMetres: 49.2, trend: "rising", updatedAt: new Date(), stationName: "Guwahati Gauge", riverName: "Brahmaputra", distanceKm: 5.2, sourceName: "Official Telemetry", sourceUrl: "https://nwdp.nwic.gov.in", message: "Live telemetry" },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });

    // First evaluation: High risk triggered
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce(mockHighReport());
    const firstCheck = await getFloodAlertStatus(26.1445, 91.7362);
    expect(firstCheck.currentRisk).toBe("high");
    expect(firstCheck.shouldAlert).toBe(true);
    expect(firstCheck.action).toBe("trigger_alert");

    // Second evaluation: Repeated High risk check -> Should be SUPPRESSED
    weatherProviderManager.clearCache();
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce(mockHighReport());
    const secondCheck = await getFloodAlertStatus(26.1445, 91.7362);
    expect(secondCheck.currentRisk).toBe("high");
    expect(secondCheck.shouldAlert).toBe(false);
    expect(secondCheck.action).toBe("suppress_duplicate");
    expect(secondCheck.stateSummary.suppressedCount).toBe(1);
  });

  it("TEST 6: Risk escalation from HIGH to CRITICAL is correctly represented", async () => {
    // 1st step: Set state to HIGH
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: { temperatureC: 27, feelsLikeC: 29, humidityPercent: 90, pressureHpa: 1005, windKmh: 20, windDirectionDeg: 180, windGustsKmh: 35, visibilityKm: 5, cloudCoverPercent: 100, precipitationMm: 15, rainMm: 15, weatherCode: 65, condition: "Heavy rain", category: "rain", icon: "cloud-rain", uvIndex: 2 },
      forecast: { rainChance: 90, rainAmountMm: 60, hourly24h: [], days7: [] },
      trend: { source: "Forecast", pastDays7: [] },
      alerts: [],
      floodRisk: { riskLevel: "high", title: "High Risk", summary: "High rain", precipitation24hMm: 60, precipitationProbabilityMax: 90, riverDischargeM3s: 500, riverDischargeTrend: "rising", activeFloodZonesCount: 1, riverGauge: null },
      airQuality: { aqiUs: 40, category: "Good", pm25: 10, pm10: 20, nitrogenDioxide: 5, ozone: 15, sulphurDioxide: 2, carbonMonoxide: 0.3 },
      river: { available: true, levelMetres: 48.5, trend: "rising", updatedAt: new Date(), stationName: "Gauge", riverName: "Brahmaputra", distanceKm: 5.2, sourceName: "NWDP", sourceUrl: "https://nwdp.nwic.gov.in", message: "Live" },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });
    await getFloodAlertStatus(26.1445, 91.7362);

    // 2nd step: Risk escalates to CRITICAL
    weatherProviderManager.clearCache();
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: { temperatureC: 27, feelsLikeC: 29, humidityPercent: 90, pressureHpa: 1005, windKmh: 20, windDirectionDeg: 180, windGustsKmh: 35, visibilityKm: 5, cloudCoverPercent: 100, precipitationMm: 15, rainMm: 15, weatherCode: 65, condition: "Torrential Downpour", category: "extreme", icon: "cloud-rain-wind", uvIndex: 2 },
      forecast: { rainChance: 100, rainAmountMm: 140, hourly24h: [], days7: [] },
      trend: { source: "Forecast", pastDays7: [] },
      alerts: [],
      floodRisk: { riskLevel: "critical", title: "Critical Flood Emergency", summary: "Extreme flooding expected", precipitation24hMm: 140, precipitationProbabilityMax: 100, riverDischargeM3s: 1200, riverDischargeTrend: "rising", activeFloodZonesCount: 3, riverGauge: null },
      airQuality: { aqiUs: 40, category: "Good", pm25: 10, pm10: 20, nitrogenDioxide: 5, ozone: 15, sulphurDioxide: 2, carbonMonoxide: 0.3 },
      river: { available: true, levelMetres: 51.0, trend: "rising", updatedAt: new Date(), stationName: "Gauge", riverName: "Brahmaputra", distanceKm: 5.2, sourceName: "NWDP", sourceUrl: "https://nwdp.nwic.gov.in", message: "Live" },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });

    const escalated = await getFloodAlertStatus(26.1445, 91.7362);

    expect(escalated.previousRisk).toBe("high");
    expect(escalated.currentRisk).toBe("critical");
    expect(escalated.shouldAlert).toBe(true);
    expect(escalated.action).toBe("trigger_escalation");
  });

  it("TEST 7: Risk normalization after a previous alert is correctly represented", async () => {
    // 1st step: Set state to CRITICAL
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: { temperatureC: 27, feelsLikeC: 29, humidityPercent: 90, pressureHpa: 1005, windKmh: 20, windDirectionDeg: 180, windGustsKmh: 35, visibilityKm: 5, cloudCoverPercent: 100, precipitationMm: 15, rainMm: 15, weatherCode: 65, condition: "Torrential Downpour", category: "extreme", icon: "cloud-rain-wind", uvIndex: 2 },
      forecast: { rainChance: 100, rainAmountMm: 140, hourly24h: [], days7: [] },
      trend: { source: "Forecast", pastDays7: [] },
      alerts: [],
      floodRisk: { riskLevel: "critical", title: "Critical Flood Emergency", summary: "Extreme flooding expected", precipitation24hMm: 140, precipitationProbabilityMax: 100, riverDischargeM3s: 1200, riverDischargeTrend: "rising", activeFloodZonesCount: 3, riverGauge: null },
      airQuality: { aqiUs: 40, category: "Good", pm25: 10, pm10: 20, nitrogenDioxide: 5, ozone: 15, sulphurDioxide: 2, carbonMonoxide: 0.3 },
      river: { available: true, levelMetres: 51.0, trend: "rising", updatedAt: new Date(), stationName: "Gauge", riverName: "Brahmaputra", distanceKm: 5.2, sourceName: "NWDP", sourceUrl: "https://nwdp.nwic.gov.in", message: "Live" },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });
    await getFloodAlertStatus(26.1445, 91.7362);

    // 2nd step: Risk normalizes to NORMAL
    weatherProviderManager.clearCache();
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValueOnce({
      available: true,
      provider: "Open-Meteo",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: { temperatureC: 29, feelsLikeC: 30, humidityPercent: 65, pressureHpa: 1012, windKmh: 10, windDirectionDeg: 120, windGustsKmh: 15, visibilityKm: 10, cloudCoverPercent: 20, precipitationMm: 0, rainMm: 0, weatherCode: 1, condition: "Mainly clear", category: "clear", icon: "sun", uvIndex: 6 },
      forecast: { rainChance: 10, rainAmountMm: 2, hourly24h: [], days7: [] },
      trend: { source: "Forecast", pastDays7: [] },
      alerts: [],
      floodRisk: { riskLevel: "normal", title: "Normal Monsoon Conditions", summary: "Typical regional drainage capacity", precipitation24hMm: 2, precipitationProbabilityMax: 10, riverDischargeM3s: 200, riverDischargeTrend: "falling", activeFloodZonesCount: 0, riverGauge: null },
      airQuality: { aqiUs: 40, category: "Good", pm25: 10, pm10: 20, nitrogenDioxide: 5, ozone: 15, sulphurDioxide: 2, carbonMonoxide: 0.3 },
      river: { available: true, levelMetres: 45.0, trend: "falling", updatedAt: new Date(), stationName: "Gauge", riverName: "Brahmaputra", distanceKm: 5.2, sourceName: "NWDP", sourceUrl: "https://nwdp.nwic.gov.in", message: "Live" },
      source: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: false },
    });

    const normalized = await getFloodAlertStatus(26.1445, 91.7362);

    expect(normalized.previousRisk).toBe("critical");
    expect(normalized.currentRisk).toBe("normal");
    expect(normalized.shouldAlert).toBe(true);
    expect(normalized.action).toBe("record_normalization");
  });
});
