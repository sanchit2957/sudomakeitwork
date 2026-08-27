import { describe, expect, it } from "vitest";
import {
  getComprehensiveWeather,
  interpretWmoCode,
} from "./weather.service";
import { appRouter } from "./routers";

describe("Comprehensive Weather & Open-Meteo Integration", () => {
  it("correctly maps WMO weather codes to descriptive categories and icons", () => {
    expect(interpretWmoCode(0)).toMatchObject({ description: "Clear sky", category: "clear", icon: "sun" });
    expect(interpretWmoCode(3)).toMatchObject({ description: "Overcast", category: "cloudy", icon: "cloud" });
    expect(interpretWmoCode(65)).toMatchObject({ description: "Heavy torrential rain", category: "rain" });
    expect(interpretWmoCode(95)).toMatchObject({ description: "Thunderstorm", category: "thunderstorm" });
    expect(interpretWmoCode(null)).toMatchObject({ description: "Unknown conditions" });
  });

  it("aggregates weather forecast, flood risk, air quality, and river gauges", async () => {
    const report = await getComprehensiveWeather(26.1445, 91.7362, 1);
    expect(report).toBeDefined();
    expect(report.location).toMatchObject({ latitude: 26.1445, longitude: 91.7362 });
    expect(report.current).toBeDefined();
    expect(report.forecast).toBeDefined();
    expect(report.forecast.days7).toBeInstanceOf(Array);
    expect(report.floodRisk).toBeDefined();
    expect(["normal", "elevated", "high", "critical"]).toContain(report.floodRisk.riskLevel);
    expect(report.floodRisk.activeFloodZonesCount).toBe(1);
    expect(report.airQuality).toBeDefined();
    expect(report.river).toBeDefined();
  });

  it("serves dedicated weather procedures via tRPC router", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: null,
    });

    // 1. Current Weather Endpoint
    const current = await caller.rescue.weather.current({ latitude: 26.1445, longitude: 91.7362 });
    expect(current.available).toBe(true);
    expect(current.provider).toBeDefined();
    expect(current.current).toBeDefined();

    // 2. Forecast Endpoint (Hourly & 7-Day)
    const forecast = await caller.rescue.weather.forecast({ latitude: 26.1445, longitude: 91.7362 });
    expect(forecast.available).toBe(true);
    expect(forecast.forecast.days7.length).toBeGreaterThanOrEqual(0);

    // 3. Flood Alerts & Discharge Endpoint
    const flood = await caller.rescue.weather.floodAlerts({ latitude: 26.1445, longitude: 91.7362 });
    expect(flood.floodRisk).toBeDefined();
    expect(flood.floodRisk.title).toBeDefined();

    // 4. Air Quality Endpoint
    const aqi = await caller.rescue.weather.airQuality({ latitude: 26.1445, longitude: 91.7362 });
    expect(aqi.airQuality).toBeDefined();
  });
});
