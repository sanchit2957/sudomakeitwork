import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  Navigation,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  TrendingUp,
  Waves,
  Wind,
} from "lucide-react";
import React, { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";

export type WeatherDay = {
  date: string;
  temperatureHighC: number | null;
  temperatureLowC: number | null;
  rainChance: number | null;
  rainMm: number | null;
  windKmh: number | null;
  weatherCode: number | null;
  condition?: string;
  icon?: string;
  uvIndexMax?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
};

export type WeatherHour = {
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

export type WeatherAlertItem = {
  title: string;
  severity: "INFO" | "WATCH" | "ADVISORY" | "WARNING" | "SEVERE" | "EMERGENCY";
  description: string;
  startTime: string | null;
  endTime: string | null;
  source: string;
};

export type FloodConditionsData = {
  available: boolean;
  source?: string;
  updatedAt?: Date | string;
  risk: string;
  activeFloodZones: number;
  location?: {
    name?: string;
    latitude: number;
    longitude: number;
    country?: string;
    region?: string;
  };
  current: {
    temperatureC: number | null;
    feelsLikeC?: number | null;
    humidityPercent?: number | null;
    pressureHpa?: number | null;
    precipitationMm: number | null;
    windKmh: number | null;
    windDirectionDeg?: number | null;
    windGustsKmh?: number | null;
    visibilityKm?: number | null;
    cloudCoverPercent?: number | null;
    condition?: string;
    category?: string;
    icon?: string;
    weatherCode?: number | null;
    uvIndex?: number | null;
  };
  forecast: {
    rainChance: number | null;
    rainAmountMm: number | null;
    days?: WeatherDay[];
    hourly24h?: WeatherHour[];
  };
  trend?: {
    source: string;
    days: WeatherDay[];
  };
  alerts?: WeatherAlertItem[];
  airQuality?: {
    aqiUs: number | null;
    category: string;
    pm25: number | null;
    pm10: number | null;
    nitrogenDioxide?: number | null;
    ozone?: number | null;
    sulphurDioxide?: number | null;
    carbonMonoxide?: number | null;
  };
  floodRisk?: {
    riskLevel: string;
    title: string;
    summary: string;
    riverDischargeM3s: number | null;
    riverDischargeTrend: string;
  };
  river?: {
    available: boolean;
    levelMetres?: number | null;
    trend?: string | null;
    updatedAt?: Date | null;
    stationName?: string | null;
    riverName?: string | null;
    distanceKm?: number | null;
    sourceName?: string;
    sourceUrl?: string;
    message?: string;
  };
  dataSource?: {
    provider: string;
    tier: string;
    fetchedAt: string;
    isCached: boolean;
    cacheTimestamp?: number;
    latencyMs?: number;
  };
};

import { POPULAR_INDIAN_LOCATIONS } from "@shared/india-locations";

export const POPULAR_LOCATIONS = POPULAR_INDIAN_LOCATIONS;
export const POPULAR_ASSAM_LOCATIONS = POPULAR_LOCATIONS;

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof CloudRain;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl glass-card border border-[#E2E8F0]/25 bg-white/75 p-3.5 shadow-xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60">
      <Icon className="h-5 w-5 text-[#1D4ED8] dark:text-[#F1F5F9]" />
      <p className="mt-3 text-[11px] font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">{label}</p>
      <p className="mt-0.5 text-lg font-black tracking-[-0.04em] text-[#0F172A] dark:text-[#F8FAFC]">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-4 text-[#0F172A]/65 dark:text-[#F1F5F9]/70">
        {detail}
      </p>
    </div>
  );
}

export function getWeatherIconComponent(iconName?: string, category?: string) {
  if (iconName === "sun" || category === "clear") return Sun;
  if (iconName === "cloud-lightning" || category === "thunderstorm") return CloudLightning;
  if (iconName === "cloud-rain-wind" || category === "extreme") return CloudRain;
  if (iconName === "cloud-rain" || category === "rain" || category === "drizzle") return CloudRain;
  if (iconName === "cloud-fog" || category === "fog") return CloudFog;
  return Cloud;
}

export const dayName = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${date}T12:00:00`));

export const formatHour = (isoString: string) => {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: true }).format(date);
  } catch {
    return isoString.slice(11, 16);
  }
};

import { fetchDirectClientWeather } from "@/lib/clientWeather";

export function FloodConditionsPanel({
  conditions,
  loading,
  latitude,
  longitude,
  onRefresh,
  onLocationChange,
  selectedLocationName,
  isGpsActive,
  onGpsLocate,
  hideForecast = false,
}: {
  conditions?: FloodConditionsData;
  loading: boolean;
  latitude?: number;
  longitude?: number;
  onRefresh?: () => void;
  onLocationChange?: (lat: number, lng: number, name: string) => void;
  selectedLocationName?: string;
  isGpsActive?: boolean;
  onGpsLocate?: () => void;
  hideForecast?: boolean;
}) {
  const { t } = useLanguage();
  const [trendOpen, setTrendOpen] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [clientConditions, setClientConditions] = useState<FloodConditionsData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // When server weather is unavailable or missing forecast days, hydrate directly from real Open-Meteo
  React.useEffect(() => {
    const hasValidServerConditions = Boolean(
      conditions?.available && conditions?.forecast?.days && conditions.forecast.days.length > 0
    );
    if (hasValidServerConditions) {
      setClientConditions(null);
      return;
    }

    const targetLat = latitude ?? (conditions?.location?.latitude !== undefined ? conditions.location.latitude : undefined);
    const targetLng = longitude ?? (conditions?.location?.longitude !== undefined ? conditions.location.longitude : undefined);

    if (targetLat != null && targetLng != null) {
      let active = true;
      setClientLoading(true);
      void fetchDirectClientWeather(targetLat, targetLng)
        .then((data) => {
          if (active && data.available) {
            setClientConditions(data);
          }
        })
        .finally(() => {
          if (active) setClientLoading(false);
        });

      return () => {
        active = false;
      };
    }
  }, [conditions, latitude, longitude]);

  const effectiveConditions =
    (conditions?.available && conditions?.forecast?.days && conditions.forecast.days.length > 0
      ? conditions
      : clientConditions) || conditions;

  const effectiveLoading = loading || (clientLoading && !effectiveConditions?.available);

  const riskInfo = getWeatherRiskPresentation(effectiveConditions?.risk);

  const trendDays = effectiveConditions?.trend?.days || [];
  const forecastDays = effectiveConditions?.forecast?.days || [];
  const hourlyItems = effectiveConditions?.forecast?.hourly24h || [];
  const alerts = effectiveConditions?.alerts || [];

  const maxRain = Math.max(1, ...trendDays.map((day) => day.rainMm || 0));
  const pointX = (index: number, size: number) => (size > 1 ? (index / (size - 1)) * 176 + 8 : 92);
  const pointY = (rain: number | null) => 50 - ((rain || 0) / maxRain) * 38;
  const trendPoints = trendDays
    .map((day, index) => `${pointX(index, trendDays.length)},${pointY(day.rainMm)}`)
    .join(" ");

  const dayName = (date: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${date}T12:00:00`));

  const formatHour = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: true }).format(date);
    } catch {
      return isoString.slice(11, 16);
    }
  };

  const WeatherIcon = getWeatherIconComponent(effectiveConditions?.current?.icon, effectiveConditions?.current?.category);

  return (
    <section className="glass-panel p-6 shadow-sm border border-[#E2E8F0]/30 bg-white/75 dark:border-[#F1F5F9]/15 dark:bg-[#0F172A]/65">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">{t("Local flood conditions")}</h2>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={effectiveLoading}
                title={t("Refresh weather data")}
                aria-label={t("Refresh weather data")}
                className="rounded-full p-1 text-[#0F172A]/70 hover:bg-[#1D4ED8]/10 hover:text-[#1D4ED8] active:scale-95 disabled:opacity-50 dark:text-[#F1F5F9]/70 dark:hover:bg-white/10 dark:hover:text-[#F1F5F9]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${effectiveLoading ? "animate-spin text-[#1D4ED8]" : ""}`} />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[11px] font-bold text-[#0F172A]/70 dark:text-[#F1F5F9]/75">
            {effectiveLoading
              ? t("Updating local forecast")
              : effectiveConditions?.available
              ? effectiveConditions.source || t("Weather model based")
              : t("Weather source unavailable")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${riskInfo.badgeTone}`}
          >
            {t(riskInfo.badgeLabelKey)}
          </span>

          {effectiveConditions?.dataSource?.isCached && (
            <span className="rounded-md bg-black/5 px-2 py-0.5 text-[9px] font-bold text-[#0F172A]/70 dark:bg-white/10 dark:text-[#F1F5F9]/80">
              {t("Cached data")}
            </span>
          )}
        </div>
      </div>

      {/* Location Selector Bar */}
      <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0]/25 bg-white/60 px-3.5 py-2 text-xs shadow-xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/50">
        <button
          type="button"
          onClick={() => setShowLocationPicker((open) => !open)}
          className="flex items-center gap-1.5 text-left font-extrabold text-[#0F172A] hover:underline dark:text-[#F8FAFC]"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8] dark:text-[#F1F5F9]" />
          <span className="truncate max-w-[200px] sm:max-w-[280px]">
            {selectedLocationName ||
              effectiveConditions?.location?.name ||
              (latitude !== undefined && longitude !== undefined
                ? `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`
                : "India (National)")}
          </span>
        </button>

        {onGpsLocate && (
          <button
            type="button"
            onClick={onGpsLocate}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition ${
              isGpsActive
                ? "bg-[#1D4ED8] text-white shadow-xs"
                : "bg-white text-[#1D4ED8] shadow-xs hover:bg-[#1D4ED8]/10 dark:bg-[#182353] dark:text-[#F1F5F9]"
            }`}
          >
            <Navigation className="h-3 w-3" />
            <span>{isGpsActive ? t("GPS Active") : t("Use GPS")}</span>
          </button>
        )}
      </div>

      {/* Location Dropdown Modal / Strip */}
      {showLocationPicker && (
        <div className="mt-2 rounded-xl border border-[#E2E8F0]/25 bg-white/95 p-3 shadow-md dark:border-[#F1F5F9]/20 dark:bg-[#182353]/95">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
            {t("Select Location:")}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {POPULAR_ASSAM_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => {
                  if (onLocationChange) onLocationChange(loc.lat, loc.lng, loc.name);
                  setShowLocationPicker(false);
                }}
                className="rounded-lg bg-white/80 p-2 text-left text-[11px] font-bold text-[#0F172A] shadow-xs transition hover:bg-[#1D4ED8] hover:text-white dark:bg-[#0F172A]/80 dark:text-[#F8FAFC] dark:hover:bg-[#1D4ED8]"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Severe Weather Alerts Banner */}
      {alerts.length > 0 && (
        <div className="mt-3.5 space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-950 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626] dark:text-red-400" />
              <div>
                <p className="font-black text-[#DC2626] dark:text-red-300">{alert.title}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-[#0F172A]/85 dark:text-[#F8FAFC]/90">
                  {alert.description}
                </p>
                <p className="mt-1 text-[9px] font-bold text-[#0F172A]/60 dark:text-[#F1F5F9]/60">
                  {t("Source:")} {alert.source}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Condition Summary Banner */}
      {effectiveConditions?.current?.condition && (
        <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl border border-[#1D4ED8]/25 bg-[#1D4ED8]/10 px-3.5 py-2.5 text-xs font-bold text-[#0F172A] dark:border-[#1D4ED8]/30 dark:bg-[#1D4ED8]/20 dark:text-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <WeatherIcon className="h-4 w-4 shrink-0 text-[#1D4ED8] dark:text-[#F1F5F9]" />
            <span>{effectiveConditions.current.condition}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold">
            {effectiveConditions.current.temperatureC !== null && effectiveConditions.current.temperatureC !== undefined && (
              <span className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">{Math.round(effectiveConditions.current.temperatureC)}°C</span>
            )}
            {effectiveConditions.current.feelsLikeC !== null && effectiveConditions.current.feelsLikeC !== undefined && (
              <span className="text-[#0F172A]/75 dark:text-[#F1F5F9]/80">{t("Feels like")} {Math.round(effectiveConditions.current.feelsLikeC)}°C</span>
            )}
          </div>
        </div>
      )}

      {/* 4-Column Primary Metric Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Droplets}
          label={t("Rainfall now")}
          value={
            effectiveConditions?.current?.precipitationMm !== null &&
            effectiveConditions?.current?.precipitationMm !== undefined
              ? `${effectiveConditions.current.precipitationMm} mm`
              : "—"
          }
          detail={
            effectiveConditions?.forecast?.rainAmountMm !== null &&
            effectiveConditions?.forecast?.rainAmountMm !== undefined
              ? `${effectiveConditions.forecast.rainAmountMm} mm expected today`
              : t("No reading")}
        />
        <Stat
          icon={Wind}
          label={t("Wind speed")}
          value={
            effectiveConditions?.current?.windKmh !== null && effectiveConditions?.current?.windKmh !== undefined
              ? `${Math.round(effectiveConditions.current.windKmh)} km/h`
              : "—"
          }
          detail={
            effectiveConditions?.current?.windGustsKmh
              ? `Gusts to ${Math.round(effectiveConditions.current.windGustsKmh)} km/h`
              : effectiveConditions?.current?.temperatureC !== null && effectiveConditions?.current?.temperatureC !== undefined
              ? `${Math.round(effectiveConditions.current.temperatureC)}° now`
              : t("No reading")}
        />
        <Stat
          icon={Gauge}
          label={t("River level")}
          value={
            effectiveConditions?.river?.available &&
            effectiveConditions.river.levelMetres !== null &&
            effectiveConditions?.river.levelMetres !== undefined
              ? `${effectiveConditions.river.levelMetres} m`
              : t("Unavailable")}
          detail={effectiveConditions?.river?.message || t("No official gauge linked")}
        />
        <button
          type="button"
          onClick={() => setTrendOpen((open) => !open)}
          aria-expanded={trendOpen}
          className="rounded-2xl glass-card border border-[#E2E8F0]/25 bg-white/75 p-3.5 text-left transition active:scale-[.98] dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60 shadow-xs"
        >
          <TrendingUp className="h-5 w-5 text-[#1D4ED8] dark:text-[#F1F5F9]" />
          <p className="mt-3 text-[11px] font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">
            {t("7-day trend")}
          </p>
          <p className="mt-0.5 text-[10px] font-bold text-[#1D4ED8] dark:text-[#F1F5F9]">
            {trendOpen ? t("Hide graph") : t("View graph")}
          </p>
        </button>
      </div>

      {/* Secondary Weather Stats (Humidity, Pressure, Visibility, UV) */}
      {(effectiveConditions?.current?.humidityPercent != null ||
        effectiveConditions?.current?.visibilityKm != null ||
        effectiveConditions?.current?.pressureHpa != null ||
        effectiveConditions?.current?.uvIndex != null) && (
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-[11px] sm:grid-cols-4">
          {effectiveConditions.current.humidityPercent != null && (
            <div className="rounded-xl border border-[#E2E8F0]/20 bg-white/75 p-2.5 shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60">
              <span className="text-[10px] font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">{t("Humidity")}</span>
              <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{effectiveConditions.current.humidityPercent}%</p>
            </div>
          )}
          {effectiveConditions.current.pressureHpa != null && (
            <div className="rounded-xl border border-[#E2E8F0]/20 bg-white/75 p-2.5 shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60">
              <span className="text-[10px] font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">{t("Pressure")}</span>
              <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{Math.round(effectiveConditions.current.pressureHpa)} hPa</p>
            </div>
          )}
          {effectiveConditions.current.visibilityKm != null && (
            <div className="rounded-xl border border-[#E2E8F0]/20 bg-white/75 p-2.5 shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60">
              <span className="text-[10px] font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">{t("Visibility")}</span>
              <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{effectiveConditions.current.visibilityKm} km</p>
            </div>
          )}
          {effectiveConditions.current.uvIndex != null && (
            <div className="rounded-xl border border-[#E2E8F0]/20 bg-white/75 p-2.5 shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60">
              <span className="text-[10px] font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">{t("UV Index")}</span>
              <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{effectiveConditions.current.uvIndex}</p>
            </div>
          )}
        </div>
      )}

      {/* Hourly Timeline (Next 24 Hours) */}
      {!hideForecast && hourlyItems.length > 0 && (
        <section className="mt-4 border-t border-[#E2E8F0]/20 pt-3.5 dark:border-[#F1F5F9]/15">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
            <h3 className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
              {t("Hourly Forecast (Next 24h)")}
            </h3>
          </div>
          <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {hourlyItems.slice(0, 12).map((item, idx) => {
              const HIcon = getWeatherIconComponent(item.icon);
              return (
                <div
                  key={idx}
                  className="flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border border-[#E2E8F0]/20 bg-white/75 p-2 text-center shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60"
                >
                  <span className="text-[10px] font-extrabold text-[#0F172A]/75 dark:text-[#F1F5F9]/80">
                    {formatHour(item.time)}
                  </span>
                  <HIcon className="my-1.5 h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                  <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                    {item.temperatureC != null ? `${Math.round(item.temperatureC)}°` : "—"}
                  </span>
                  <span className="mt-0.5 text-[9px] font-bold text-[#1D4ED8] dark:text-[#F1F5F9]">
                    {item.precipitationProbability != null ? `${item.precipitationProbability}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Air Quality Badge */}
      {effectiveConditions?.airQuality?.aqiUs !== null && effectiveConditions?.airQuality?.aqiUs !== undefined && (
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-[#E2E8F0]/20 bg-white/75 px-3.5 py-2.5 text-xs font-bold shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60">
          <span className="flex items-center gap-2 text-[#0F172A] dark:text-[#F8FAFC]">
            <Compass className="h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
            {t("Air Quality:")} <strong className="text-[#1D4ED8] dark:text-[#F1F5F9]">{effectiveConditions.airQuality.category}</strong> (AQI {effectiveConditions.airQuality.aqiUs})
          </span>
          {effectiveConditions.airQuality.pm25 !== null && (
            <span className="text-[10px] font-semibold text-[#0F172A]/70 dark:text-[#F1F5F9]/75">
              PM2.5: {effectiveConditions.airQuality.pm25} µg/m³
            </span>
          )}
        </div>
      )}

      {/* 7-Day Rainfall Trend Graph (Expandable) */}
      {trendOpen && (
        <section
          className="mt-3.5 rounded-2xl border border-[#E2E8F0]/20 bg-white/75 p-3.5 dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60 shadow-xs"
          aria-label={t("Seven-day rainfall trend")}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
              {t("Seven-day rainfall trend")}
            </p>
            <span className="text-right text-[10px] font-bold text-[#0F172A]/70 dark:text-[#F1F5F9]/75">
              {effectiveConditions?.trend?.source || t("No model history")}
            </span>
          </div>
          {trendDays.length ? (
            <>
              <svg
                viewBox="0 0 192 58"
                role="img"
                aria-label={t("Modelled rainfall in millimetres over the past seven days")}
                className="mt-3 h-16 w-full overflow-visible"
              >
                <line x1="8" y1="50" x2="184" y2="50" stroke="rgba(36, 87, 255, 0.2)" strokeWidth="1" />
                <polyline
                  fill="none"
                  points={trendPoints}
                  stroke="#1D4ED8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {trendDays.map((day, index) => (
                  <circle
                    key={day.date}
                    cx={pointX(index, trendDays.length)}
                    cy={pointY(day.rainMm)}
                    r="2.5"
                    fill="#1D4ED8"
                  />
                ))}
              </svg>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {trendDays.map((day) => (
                  <span
                    key={day.date}
                    className="text-center text-[9px] font-black text-[#0F172A]/75 dark:text-[#F1F5F9]/80"
                  >
                    {dayName(day.date)}
                    <br />
                    {day.rainMm ?? "—"}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">{t("Modelled history is not available yet.")}</p>
          )}
        </section>
      )}

      {/* 7-Day Forecast Section */}
      {!hideForecast && (
        <section className="mt-4 border-t border-[#E2E8F0]/20 pt-4 dark:border-[#F1F5F9]/15">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
            <h3 className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">
              {t("Weather forecast")}
            </h3>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {forecastDays.length ? (
              forecastDays.map((day) => {
                const DayIcon = getWeatherIconComponent(day.icon);
                return (
                  <div
                    key={day.date}
                    className="rounded-xl border border-[#E2E8F0]/20 bg-white/75 px-1 py-2.5 text-center shadow-2xs dark:border-[#F1F5F9]/15 dark:bg-[#182353]/60"
                  >
                    <span className="block text-[9px] font-black text-[#0F172A]/80 dark:text-[#F1F5F9]/85">
                      {dayName(day.date)}
                    </span>
                    <DayIcon className="mx-auto my-1.5 h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                    <span className="block text-[11px] font-black text-[#0F172A] dark:text-[#F8FAFC]">
                      {day.rainChance ?? "—"}%
                    </span>
                    <span className="mt-0.5 block text-[9px] font-bold text-[#0F172A]/65 dark:text-[#F1F5F9]/70">
                      {day.rainMm ?? "—"} mm
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="col-span-7 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                {effectiveLoading ? t("Forecast is loading.") : t("Forecast temporarily unavailable")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* River Gauge & Flood Alert Footer */}
      <div className="mt-3.5 rounded-2xl border border-[#1D4ED8]/25 bg-[#1D4ED8]/10 px-4 py-3.5 text-xs font-bold text-[#0F172A] dark:border-[#1D4ED8]/35 dark:bg-[#1D4ED8]/20 dark:text-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <Waves className="h-5 w-5 shrink-0 text-[#1D4ED8] dark:text-[#F1F5F9]" />
          <span>
            {effectiveConditions?.activeFloodZones && effectiveConditions.activeFloodZones > 0
              ? `${effectiveConditions.activeFloodZones} ${t("active flood-zone alerts nearby")}`
              : effectiveConditions?.river?.message || t("No nearby official flood alerts detected")}
          </span>
        </div>
        {effectiveConditions?.river?.sourceUrl && effectiveConditions?.river?.sourceName ? (
          <a
            href={effectiveConditions.river.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-8 mt-1 inline-block text-[10px] font-extrabold text-[#1D4ED8] underline underline-offset-2 dark:text-[#F1F5F9]"
          >
            {effectiveConditions.river.sourceName}
            {effectiveConditions.river.updatedAt
              ? ` · ${t("Observed")} ${new Date(effectiveConditions.river.updatedAt).toLocaleString()}`
              : ""}
          </a>
        ) : null}
      </div>
    </section>
  );
}
