// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FloodConditionsPanel } from "./FloodConditionsPanel";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (value: string) => value }) }));

const days = Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-${String(index + 10).padStart(2, "0")}`, temperatureHighC: 32, temperatureLowC: 25, rainChance: 40 + index, rainMm: index + 1, windKmh: 12, weatherCode: 61 }));

describe("FloodConditionsPanel", () => {
  it("shows official river source transparency, a seven-day forecast, and opens the clickable modelled trend graph", () => {
    const view = render(<FloodConditionsPanel loading={false} conditions={{ available: true, risk: "elevated", activeFloodZones: 0, current: { temperatureC: 30, precipitationMm: 2, windKmh: 14 }, forecast: { rainChance: 60, rainAmountMm: 8, days }, trend: { source: "Modelled daily weather history", days }, river: { available: false, updatedAt: new Date("2026-06-03T12:00:00.000Z"), sourceName: "Assam Department telemetry via National Water Data Portal", sourceUrl: "https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department", message: "Latest official gauge reading is 1920 hours old and is not shown as live." } }} />);
    expect(view.getByText("River level")).toBeTruthy();
    expect(view.getAllByText("Latest official gauge reading is 1920 hours old and is not shown as live.").length).toBeGreaterThan(0);
    expect(view.getByRole("link", { name: /Assam Department telemetry/i })).toHaveProperty("href", "https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department");
    expect(view.getByText("Weather forecast")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /7-day trend/i }));
    expect(view.getByLabelText("Seven-day rainfall trend")).toBeTruthy();
    expect(view.getByText("Modelled daily weather history")).toBeTruthy();
  });
});
