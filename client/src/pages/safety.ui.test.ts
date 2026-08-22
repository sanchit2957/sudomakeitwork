import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafetyConditionsCard } from "./Safety";

describe("Safety local alert UI", () => {
  it("renders a high-risk weather alert with an explicit early-movement instruction", () => {
    const markup = renderToStaticMarkup(createElement(SafetyConditionsCard, { loading: false, conditions: { available: true, source: "Open-Meteo weather model", risk: "high", forecast: { rainChance: 90, rainAmountMm: 45 } } }));
    expect(markup).toContain("High rainfall risk");
    expect(markup).toContain("90% chance of rain today");
    expect(markup).toContain("Avoid low-lying routes and move early");
    expect(markup).toContain("No official river gauge is linked yet");
  });

  it("renders an honest unavailable source state rather than a fabricated local alert", () => {
    const markup = renderToStaticMarkup(createElement(SafetyConditionsCard, { loading: false, conditions: { available: false, source: "Weather source unavailable", risk: "unknown", forecast: { rainChance: null, rainAmountMm: null } } }));
    expect(markup).toContain("Weather source unavailable");
    expect(markup).toContain("Live weather information is temporarily unavailable");
  });
});
