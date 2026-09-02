import { describe, expect, it } from "vitest";
import { getWeatherRiskPresentation } from "./weatherRisk";

describe("getWeatherRiskPresentation", () => {
  it("1. maps 'critical' to RED / High rain risk", () => {
    const res = getWeatherRiskPresentation("critical");
    expect(res.level).toBe("critical");
    expect(res.badgeLabelKey).toBe("High rain risk");
    expect(res.hexColor).toBe("#ef4444");
    expect(res.badgeTone).toContain("bg-[#fff0ee]");
    expect(res.safetyTitleKey).toBe("High rainfall risk");
  });

  it("2. maps 'high' to RED / High rain risk (backward compatibility)", () => {
    const res = getWeatherRiskPresentation("high");
    expect(res.level).toBe("critical");
    expect(res.badgeLabelKey).toBe("High rain risk");
    expect(res.hexColor).toBe("#ef4444");
    expect(res.badgeTone).toContain("bg-[#fff0ee]");
    expect(res.safetyTitleKey).toBe("High rainfall risk");
  });

  it("3. maps 'moderate' to ORANGE / Watch conditions", () => {
    const res = getWeatherRiskPresentation("moderate");
    expect(res.level).toBe("moderate");
    expect(res.badgeLabelKey).toBe("Watch conditions");
    expect(res.hexColor).toBe("#f59e0b");
    expect(res.badgeTone).toContain("bg-[#fff5df]");
    expect(res.safetyTitleKey).toBe("Elevated rainfall risk");
  });

  it("4. maps 'elevated' to ORANGE / Watch conditions (backward compatibility)", () => {
    const res = getWeatherRiskPresentation("elevated");
    expect(res.level).toBe("moderate");
    expect(res.badgeLabelKey).toBe("Watch conditions");
    expect(res.hexColor).toBe("#f59e0b");
    expect(res.badgeTone).toContain("bg-[#fff5df]");
    expect(res.safetyTitleKey).toBe("Elevated rainfall risk");
  });

  it("5. maps 'good' to GREEN / Normal", () => {
    const res = getWeatherRiskPresentation("good");
    expect(res.level).toBe("good");
    expect(res.badgeLabelKey).toBe("Normal");
    expect(res.hexColor).toBe("#10b981");
    expect(res.badgeTone).toContain("bg-[#e6f6ef]");
    expect(res.safetyTitleKey).toBe("Current model conditions");
  });

  it("6. maps 'normal' to GREEN / Normal (backward compatibility)", () => {
    const res = getWeatherRiskPresentation("normal");
    expect(res.level).toBe("good");
    expect(res.badgeLabelKey).toBe("Normal");
    expect(res.hexColor).toBe("#10b981");
    expect(res.badgeTone).toContain("bg-[#e6f6ef]");
    expect(res.safetyTitleKey).toBe("Current model conditions");
  });

  it("7. maps 'unknown' or empty/null to GRAY / Data unavailable", () => {
    const resUnknown = getWeatherRiskPresentation("unknown");
    expect(resUnknown.level).toBe("unknown");
    expect(resUnknown.badgeLabelKey).toBe("Data unavailable");
    expect(resUnknown.hexColor).toBe("#9ca3af");

    const resNull = getWeatherRiskPresentation(null);
    expect(resNull.level).toBe("unknown");
    expect(resNull.badgeLabelKey).toBe("Data unavailable");
    expect(resNull.hexColor).toBe("#9ca3af");
  });

  it("ensures Maharashtra (19.1998, 73.1091) evaluated as 'moderate' renders as ORANGE / Watch conditions consistently across all UI", () => {
    const serverClassifierOutput = "moderate"; // as returned for Maharashtra
    const presentation = getWeatherRiskPresentation(serverClassifierOutput);

    // 1. Dashboard panel badge check
    expect(presentation.badgeLabelKey).toBe("Watch conditions");
    expect(presentation.badgeTone).toBe("bg-[#fff5df] text-[#9a681d]");

    // 2. Map Heatmap overlay check
    expect(presentation.hexColor).toBe("#f59e0b"); // Orange
    expect(presentation.level).toBe("moderate");

    // 3. Safety card check
    expect(presentation.safetyTitleKey).toBe("Elevated rainfall risk");
  });
});
