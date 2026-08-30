/**
 * Comprehensive Weather, Flood & Atmospheric Intelligence Service
 * Backed by enterprise multi-provider architecture (Open-Meteo, OpenWeather, WeatherAPI)
 * with automatic waterfall failover, health tracking, deduplication, and stale-fallback caching.
 */

import { type OfficialRiverGauge } from "./assam-river-gauge";
import { interpretWmoCode as openMeteoInterpretWmoCode } from "./weather/providers/openMeteo.provider";
import { weatherProviderManager, WeatherProviderManager } from "./weather/weather.provider-manager";
import type {
  AirQualityNormalized,
  CurrentWeatherNormalized,
  DailyForecastItemNormalized,
  FloodRiskNormalized,
  HourlyForecastItemNormalized,
  NormalizedWeatherReport,
  ProviderHealthStats,
  WeatherAlert,
  WeatherSeverity,
} from "./weather/weather.types";

export type WeatherConditionCode = {
  code: number;
  description: string;
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
};

export type CurrentWeather = CurrentWeatherNormalized;
export type HourlyForecastItem = HourlyForecastItemNormalized;
export type DailyForecastItem = DailyForecastItemNormalized;
export type FloodRiskAssessment = FloodRiskNormalized;
export type AirQualityData = AirQualityNormalized;
export type ComprehensiveWeatherReport = NormalizedWeatherReport;

export {
  type WeatherAlert,
  type WeatherSeverity,
  type ProviderHealthStats,
  type NormalizedWeatherReport,
  WeatherProviderManager,
  weatherProviderManager,
};

export function interpretWmoCode(code: number | null | undefined): WeatherConditionCode {
  return openMeteoInterpretWmoCode(code);
}

/**
 * Main Comprehensive Weather Aggregator
 */
export async function getComprehensiveWeather(
  latitude: number = 26.1445,
  longitude: number = 91.7362,
  activeFloodZonesCount: number = 0
): Promise<ComprehensiveWeatherReport> {
  return weatherProviderManager.getWeather(latitude, longitude, activeFloodZonesCount);
}

export const ASSAM_DISTRICT_LOCATIONS = [
  { name: "Guwahati (Kamrup Metro)", latitude: 26.1445, longitude: 91.7362, region: "Lower Assam" },
  { name: "Silchar (Cachar)", latitude: 24.8333, longitude: 92.7789, region: "Barak Valley" },
  { name: "Dibrugarh", latitude: 27.4728, longitude: 94.912, region: "Upper Assam" },
  { name: "Jorhat", latitude: 26.7509, longitude: 94.2037, region: "Upper Assam" },
  { name: "Tezpur (Sonitpur)", latitude: 26.6528, longitude: 92.7926, region: "North Assam" },
  { name: "Nagaon", latitude: 26.3452, longitude: 92.684, region: "Central Assam" },
  { name: "Bongaigaon", latitude: 26.4952, longitude: 90.5432, region: "Lower Assam" },
  { name: "Tinsukia", latitude: 27.4922, longitude: 95.3468, region: "Upper Assam" },
  { name: "Dhubri", latitude: 26.0197, longitude: 89.9749, region: "Lower Assam" },
  { name: "Karimganj", latitude: 24.8649, longitude: 92.3592, region: "Barak Valley" },
  { name: "Golaghat", latitude: 26.5167, longitude: 93.9667, region: "Upper Assam" },
  { name: "Barpeta", latitude: 26.3216, longitude: 91.0069, region: "Lower Assam" },
  { name: "North Lakhimpur", latitude: 27.2366, longitude: 94.1037, region: "North Assam" },
  { name: "Dhemaji", latitude: 27.4817, longitude: 94.5824, region: "North Assam" },
  { name: "Haflong (Dima Hasao)", latitude: 25.1764, longitude: 93.0177, region: "Hills" },
  { name: "Diphu (Karbi Anglong)", latitude: 25.8456, longitude: 93.4338, region: "Hills" },
];
