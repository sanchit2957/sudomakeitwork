import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SafetyConditionsCard } from "./Safety";

describe("Safety local alert UI", () => {
  it("renders a high-risk weather alert with an explicit early-movement instruction", () => {
    const markup = renderToStaticMarkup(createElement(SafetyConditionsCard, { loading: false, conditions: { available: true, source: "Open-Meteo weather model", risk: "high", forecast: { rainChance: 90, rainAmountMm: 45 } } }));
    expect(markup).toContain("High rainfall risk");
    expect(markup).toContain("90% chance of rain today");
    expect(markup).toContain("Avoid low-lying routes and move early");
    expect(markup).toContain("Official river-gauge data is temporarily unavailable");
  });

  it("renders an honest unavailable source state rather than a fabricated local alert", () => {
    const markup = renderToStaticMarkup(createElement(SafetyConditionsCard, { loading: false, conditions: { available: false, source: "Weather source unavailable", risk: "unknown", forecast: { rainChance: null, rainAmountMm: null } } }));
    expect(markup).toContain("Weather source unavailable");
    expect(markup).toContain("Live weather information is temporarily unavailable");
  });

  it("shows a fresh official gauge station, trend, and attribution when the conditions contract provides one", () => {
    const markup = renderToStaticMarkup(createElement(SafetyConditionsCard, { loading: false, conditions: { available: true, source: "Open-Meteo weather model", risk: "normal", forecast: { rainChance: 10, rainAmountMm: 2 }, river: { available: true, levelMetres: 47.32, trend: "falling", stationName: "Guwahati D.C. Court", updatedAt: "2026-08-22T10:00:00.000Z", sourceName: "Central Water Commission", sourceUrl: "https://ffs.india-water.gov.in/" , message: null } } }));
    expect(markup).toContain("Guwahati D.C. Court · 47.32 m · falling");
    expect(markup).toContain("Central Water Commission");
    expect(markup).toContain('href="https://ffs.india-water.gov.in/"');
  });

  it("keeps a device-local readiness plan and location-aware verified-support path in the Safety workflow", () => {
    const source = readFileSync(new URL("./Safety.tsx", import.meta.url), "utf8");
    expect(source).toContain('const readinessStorageKey = "sudo-makeitwork-safety-readiness"');
    expect(source).toContain("Three things to check now");
    expect(source).toContain("This checklist stays only on this device. It does not notify response teams.");
    expect(source).toContain("Find help or share a need");
    expect(source).toContain("nearby resources are ordered by distance");
    expect(source).toContain("requestPosition(); return;");
  });
});
