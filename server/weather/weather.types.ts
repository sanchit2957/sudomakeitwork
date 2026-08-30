import type { OfficialRiverGauge } from "../assam-river-gauge";

export type WeatherSeverity = "INFO" | "WATCH" | "ADVISORY" | "WARNING" | "SEVERE" | "EMERGENCY";

export type WeatherAlert = {
  title: string;
  severity: WeatherSeverity;
  description: string;
  startTime: string | null;
  endTime: string | null;
  source: string;
};

export type CurrentWeatherNormalized = {
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  windKmh: number | null;
  windDirectionDeg: number | null;
  windGustsKmh: number | null;
  visibilityKm: number | null;
  cloudCoverPercent: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  weatherCode: number | null;
  condition: string;
  category: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "thunderstorm" | "snow" | "extreme";
  icon: string;
  uvIndex: number | null;
};

export type HourlyForecastItemNormalized = {
  time: string;
  temperatureC: number | null;
  feelsLikeC?: number | null;
  humidityPercent: number | null;
  precipitationProbability: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  condition: string;
  icon?: string;
  windKmh: number | null;
};

export type DailyForecastItemNormalized = {
  date: string;
  temperatureHighC: number | null;
  temperatureLowC: number | null;
  rainChance: number | null;
  rainMm: number | null;
  weatherCode: number | null;
  condition: string;
  icon?: string;
  windKmh: number | null;
  uvIndexMax: number | null;
  sunrise: string | null;
  sunset: string | null;
};

export type AirQualityNormalized = {
  aqiUs: number | null;
  category: "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous" | "Unavailable";
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  sulphurDioxide: number | null;
  carbonMonoxide: number | null;
};

export type FloodRiskNormalized = {
  riskLevel: "normal" | "elevated" | "high" | "critical";
  title: string;
  summary: string;
  precipitation24hMm: number;
  precipitationProbabilityMax: number;
  riverDischargeM3s: number | null;
  riverDischargeTrend: "rising" | "falling" | "steady" | "unknown";
  activeFloodZonesCount: number;
  riverGauge: OfficialRiverGauge | null;
};

export type LocationInfo = {
  name?: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
};

export type WeatherDataSourceInfo = {
  provider: string;
  tier: "primary" | "fallback_1" | "fallback_2" | "cached" | "offline";
  fetchedAt: string;
  isCached: boolean;
  cacheTimestamp?: number;
  latencyMs?: number;
};

export type NormalizedWeatherReport = {
  available: boolean;
  provider: string;
  location: LocationInfo;
  updatedAt: string;
  current: CurrentWeatherNormalized;
  forecast: {
    rainChance: number | null;
    rainAmountMm: number | null;
    hourly24h: HourlyForecastItemNormalized[];
    days7: DailyForecastItemNormalized[];
  };
  trend: {
    source: string;
    pastDays7: DailyForecastItemNormalized[];
  };
  alerts: WeatherAlert[];
  floodRisk: FloodRiskNormalized;
  airQuality: AirQualityNormalized;
  river: OfficialRiverGauge;
  source: WeatherDataSourceInfo;
};

export interface IWeatherProvider {
  readonly id: string;
  readonly name: string;
  readonly isConfigured: boolean;
  fetchWeather(latitude: number, longitude: number): Promise<NormalizedWeatherReport>;
}

export type ProviderHealthStats = {
  id: string;
  name: string;
  isConfigured: boolean;
  totalRequests: number;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastFailureReason?: string;
  lastLatencyMs?: number;
  avgLatencyMs: number;
  lastUsedAt?: string;
  disabledUntil?: number;
};
