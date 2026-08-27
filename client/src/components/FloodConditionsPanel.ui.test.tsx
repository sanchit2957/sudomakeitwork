// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FloodConditionsPanel } from "./FloodConditionsPanel";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (value: string) => value }) }));

const days = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-08-${String(index + 10).padStart(2, "0")}`,
  temperatureHighC: 32,
  temperatureLowC: 25,
  rainChance: 40 + index,
  rainMm: index + 1,
  windKmh: 12,
  weatherCode: 61,
}));

const hourly = [
  { time: "2026-08-27T12:00:00Z", temperatureC: 30, humidityPercent: 80, precipitationProbability: 70, precipitationMm: 2, weatherCode: 61, condition: "Slight rain", windKmh: 10 },
  { time: "2026-08-27T13:00:00Z", temperatureC: 31, humidityPercent: 78, precipitationProbability: 60, precipitationMm: 1, weatherCode: 61, condition: "Slight rain", windKmh: 12 },
];

describe("FloodConditionsPanel", () => {
  it("shows official river source transparency, a seven-day forecast, and opens the clickable modelled trend graph", () => {
    const view = render(
      <FloodConditionsPanel
        loading={false}
        conditions={{
          available: true,
          risk: "elevated",
          activeFloodZones: 0,
          current: { temperatureC: 30, precipitationMm: 2, windKmh: 14 },
          forecast: { rainChance: 60, rainAmountMm: 8, days },
          trend: { source: "Modelled daily weather history", days },
          river: {
            available: false,
            updatedAt: new Date("2026-06-03T12:00:00.000Z"),
            sourceName: "Assam Department telemetry via National Water Data Portal",
            sourceUrl: "https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department",
            message: "Latest official gauge reading is 1920 hours old and is not shown as live.",
          },
        }}
      />
    );
    expect(view.getByText("River level")).toBeTruthy();
    expect(view.getAllByText("Latest official gauge reading is 1920 hours old and is not shown as live.").length).toBeGreaterThan(0);
    expect(view.getByRole("link", { name: /Assam Department telemetry/i })).toHaveProperty("href", "https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department");
    expect(view.getByText("Weather forecast")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /7-day trend/i }));
    expect(view.getByLabelText("Seven-day rainfall trend")).toBeTruthy();
    expect(view.getByText("Modelled daily weather history")).toBeTruthy();
  });

  it("handles manual location picking, GPS locate toggle, and refresh triggers", () => {
    const onRefresh = vi.fn();
    const onLocationChange = vi.fn();
    const onGpsLocate = vi.fn();

    const view = render(
      <FloodConditionsPanel
        loading={false}
        onRefresh={onRefresh}
        onLocationChange={onLocationChange}
        onGpsLocate={onGpsLocate}
        selectedLocationName="Guwahati (Kamrup Metro)"
        isGpsActive={false}
        conditions={{
          available: true,
          risk: "normal",
          activeFloodZones: 0,
          current: { temperatureC: 29, precipitationMm: 0, windKmh: 10, feelsLikeC: 32, humidityPercent: 75, pressureHpa: 1009, visibilityKm: 10, uvIndex: 6 },
          forecast: { rainChance: 20, rainAmountMm: 1, days, hourly24h: hourly },
          alerts: [
            { title: "Thunderstorm Warning", severity: "WARNING", description: "Severe lightning expected.", startTime: null, endTime: null, source: "CMD" },
          ],
          airQuality: { aqiUs: 42, category: "Good", pm25: 11.2, pm10: 22.1, nitrogenDioxide: null, ozone: null, sulphurDioxide: null, carbonMonoxide: null },
          dataSource: { provider: "Open-Meteo", tier: "primary", fetchedAt: new Date().toISOString(), isCached: true },
        }}
      />
    );

    // Verify location name
    expect(view.getByText("Guwahati (Kamrup Metro)")).toBeTruthy();

    // Trigger refresh button
    const refreshBtn = view.getByRole("button", { name: /Refresh weather data/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Trigger GPS Locate button
    const gpsBtn = view.getByRole("button", { name: /Use GPS/i });
    fireEvent.click(gpsBtn);
    expect(onGpsLocate).toHaveBeenCalledTimes(1);

    // Open Location Dropdown & pick Silchar
    const locBtn = view.getByText("Guwahati (Kamrup Metro)");
    fireEvent.click(locBtn);
    expect(view.getByText(/Select Assam Location/i)).toBeTruthy();

    const silcharBtn = view.getByRole("button", { name: /Silchar \(Cachar\)/i });
    fireEvent.click(silcharBtn);
    expect(onLocationChange).toHaveBeenCalledWith(24.8333, 92.7789, "Silchar (Cachar)");

    // Verify Alerts & AQI & Cached Badge
    expect(view.getByText("Thunderstorm Warning")).toBeTruthy();
    expect(view.getByText(/Severe lightning expected/i)).toBeTruthy();
    expect(view.getByText("Good")).toBeTruthy();
    expect(view.getByText(/Cached data/i)).toBeTruthy();
    expect(view.getByText(/Hourly Forecast/i)).toBeTruthy();
  });
});
