/**
 * CANONICAL WEATHER RISK PRESENTATION HELPER
 * 
 * Unifies all user-facing weather and risk levels across:
 * - FloodConditionsPanel (Citizen Dashboard)
 * - UserHome / Home (Rapid SOS preview & weather banner)
 * - UserSafety / Safety (Emergency safety cards)
 * - Map / OperationsMap (Pan-India Risk Heatmap overlay & popups)
 * 
 * Canonical Tiers:
 * 🔴 critical / high     -> Red / High rain risk
 * 🟡 moderate / elevated -> Orange / Watch conditions
 * 🟢 good / normal       -> Green / Normal
 * ⚪ unknown / offline   -> Gray / Data unavailable
 */

export type CanonicalWeatherRiskLevel = "critical" | "moderate" | "good" | "unknown";

export interface WeatherRiskPresentation {
  level: CanonicalWeatherRiskLevel;
  badgeLabelKey: string;
  badgeTone: string;
  hexColor: string;
  strokeColor: string;
  fillOpacity: number;
  safetyTitleKey: string;
}

export function getWeatherRiskPresentation(risk?: string | null): WeatherRiskPresentation {
  const normalized = (risk || "").toLowerCase().trim();

  // 1. Critical / High Tier (RED)
  if (normalized === "critical" || normalized === "high") {
    return {
      level: "critical",
      badgeLabelKey: "High rain risk",
      badgeTone: "bg-[#fff0ee] text-[#b83f43]",
      hexColor: "#ef4444",
      strokeColor: "#dc2626",
      fillOpacity: 0.35,
      safetyTitleKey: "High rainfall risk",
    };
  }

  // 2. Moderate / Elevated / Watch Tier (ORANGE)
  if (
    normalized === "moderate" ||
    normalized === "elevated" ||
    normalized === "watch"
  ) {
    return {
      level: "moderate",
      badgeLabelKey: "Watch conditions",
      badgeTone: "bg-[#fff5df] text-[#9a681d]",
      hexColor: "#f59e0b",
      strokeColor: "#d97706",
      fillOpacity: 0.28,
      safetyTitleKey: "Elevated rainfall risk",
    };
  }

  // 3. Good / Normal / Low Tier (GREEN)
  if (
    normalized === "good" ||
    normalized === "normal" ||
    normalized === "low"
  ) {
    return {
      level: "good",
      badgeLabelKey: "Normal",
      badgeTone: "bg-[#e6f6ef] text-[#197654]",
      hexColor: "#10b981",
      strokeColor: "#059669",
      fillOpacity: 0.22,
      safetyTitleKey: "Current model conditions",
    };
  }

  // 4. Unknown / Offline / Fallback Tier (GRAY)
  return {
    level: "unknown",
    badgeLabelKey: "Data unavailable",
    badgeTone: "bg-[#f3f4f6] text-[#6b7280] dark:bg-[#28282b] dark:text-[#a0a0a8]",
    hexColor: "#9ca3af",
    strokeColor: "#6b7280",
    fillOpacity: 0.15,
    safetyTitleKey: "Weather source unavailable",
  };
}
