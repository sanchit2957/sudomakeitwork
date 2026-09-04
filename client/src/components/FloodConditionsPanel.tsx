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
    <div className="rounded-2xl bg-[#f7faf9] p-3 dark:bg-[#202023]">
      <Icon className="h-5 w-5 text-[#277b6b] dark:text-[#7fd6bb]" />
      <p className="mt-3 text-[11px] font-bold text-[#6f8880] dark:text-[#b5cdc5]">{label}</p>
      <p className="mt-0.5 text-lg font-black tracking-[-0.04em]">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-4 text-[#719087] dark:text-[#b5cdc5]">
        {detail}
      </p>
    </div>
  );
}

function getWeatherIconComponent(iconName?: string, category?: string) {
  if (iconName === "sun" || category === "clear") return Sun;
  if (iconName === "cloud-lightning" || category === "thunderstorm") return CloudLightning;
  if (iconName === "cloud-rain-wind" || category === "extreme") return CloudRain;
  if (iconName === "cloud-rain" || category === "rain" || category === "drizzle") return CloudRain;
  if (iconName === "cloud-fog" || category === "fog") return CloudFog;
  return Cloud;
}

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
    <section className="mt-5 rounded-[1.55rem] bg-white p-5 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-[-0.04em]">{t("Local flood conditions")}</h2>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={effectiveLoading}
                title={t("Refresh weather data")}
                aria-label={t("Refresh weather data")}
                className="rounded-full p-1 text-[#789087] hover:bg-[#eef7f5] hover:text-[#277b6b] active:scale-95 disabled:opacity-50 dark:hover:bg-[#252528] dark:hover:text-[#7fd6bb]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${effectiveLoading ? "animate-spin text-[#277b6b]" : ""}`} />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-[#789087]">
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
            <span className="rounded-md bg-[#f1f5f4] px-1.5 py-0.5 text-[9px] font-bold text-[#627c73] dark:bg-[#28282b] dark:text-[#a5c0b7]">
              {t("Cached data")}
            </span>
          )}
        </div>
      </div>

      {/* Location Selector Bar */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#f5f9f7] px-3 py-2 text-xs dark:bg-[#222225]">
        <button
          type="button"
          onClick={() => setShowLocationPicker((open) => !open)}
          className="flex items-center gap-1.5 text-left font-bold text-[#23584d] hover:underline dark:text-[#aee3d1]"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#277b6b] dark:text-[#7fd6bb]" />
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
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition ${
              isGpsActive
                ? "bg-[#277b6b] text-white"
                : "bg-white text-[#2b7665] shadow-sm hover:bg-[#eef7f5] dark:bg-[#2d2d30] dark:text-[#7fd6bb]"
            }`}
          >
            <Navigation className="h-3 w-3" />
            <span>{isGpsActive ? t("GPS Active") : t("Use GPS")}</span>
          </button>
        )}
      </div>

      {/* Location Dropdown Modal / Strip */}
      {showLocationPicker && (
        <div className="mt-2 rounded-xl border border-[#d8eae2] bg-[#fbfdfc] p-2.5 dark:border-[#353538] dark:bg-[#1e1e21]">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#698a81] dark:text-[#9bb7ad]">
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
                className="rounded-lg bg-white p-1.5 text-left text-[11px] font-semibold text-[#255248] shadow-sm transition hover:bg-[#277b6b] hover:text-white dark:bg-[#29292c] dark:text-[#cae4db] dark:hover:bg-[#277b6b] dark:hover:text-white"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Severe Weather Alerts Banner */}
      {alerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-xl border border-[#fbdcd8] bg-[#fff5f4] p-3 text-xs dark:border-[#522929] dark:bg-[#2c1919]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c73e3a] dark:text-[#e8706d]" />
              <div>
                <p className="font-black text-[#9e2724] dark:text-[#f38683]">{alert.title}</p>
                <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-[#7a3230] dark:text-[#e4a8a6]">
                  {alert.description}
                </p>
                <p className="mt-1 text-[9px] font-bold text-[#a75553] dark:text-[#b87d7b]">
                  {t("Source:")} {alert.source}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Condition Summary Banner */}
      {effectiveConditions?.current?.condition && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#edf6f3] px-3.5 py-2.5 text-xs font-bold text-[#23584d] dark:bg-[#252528] dark:text-[#aee3d1]">
          <div className="flex items-center gap-2">
            <WeatherIcon className="h-4 w-4 shrink-0 text-[#277b6b] dark:text-[#7fd6bb]" />
            <span>{effectiveConditions.current.condition}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold opacity-90">
            {effectiveConditions.current.temperatureC !== null && effectiveConditions.current.temperatureC !== undefined && (
              <span className="text-sm font-black">{Math.round(effectiveConditions.current.temperatureC)}°C</span>
            )}
            {effectiveConditions.current.feelsLikeC !== null && effectiveConditions.current.feelsLikeC !== undefined && (
              <span>{t("Feels like")} {Math.round(effectiveConditions.current.feelsLikeC)}°C</span>
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
          className="rounded-2xl bg-[#eef7f5] p-3 text-left transition active:scale-[.98] dark:bg-[#242426]"
        >
          <TrendingUp className="h-5 w-5 text-[#277b6b] dark:text-[#7fd6bb]" />
          <p className="mt-3 text-[11px] font-bold text-[#41665c] dark:text-[#d5e9e1]">
            {t("7-day trend")}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#2b7665] dark:text-[#aee3d1]">
            {trendOpen ? t("Hide graph") : t("View graph")}
          </p>
        </button>
      </div>

      {/* Secondary Weather Stats (Humidity, Pressure, Visibility, UV) */}
      {(effectiveConditions?.current?.humidityPercent != null ||
        effectiveConditions?.current?.visibilityKm != null ||
        effectiveConditions?.current?.pressureHpa != null ||
        effectiveConditions?.current?.uvIndex != null) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          {effectiveConditions.current.humidityPercent != null && (
            <div className="rounded-xl border border-[#e8f0ec] bg-[#fafcfb] p-2 dark:border-[#323236] dark:bg-[#202023]">
              <span className="text-[#6d8a81] dark:text-[#a4bebc]">{t("Humidity")}</span>
              <p className="font-bold text-[#1f4c41] dark:text-[#d8eae4]">{effectiveConditions.current.humidityPercent}%</p>
            </div>
          )}
          {effectiveConditions.current.pressureHpa != null && (
            <div className="rounded-xl border border-[#e8f0ec] bg-[#fafcfb] p-2 dark:border-[#323236] dark:bg-[#202023]">
              <span className="text-[#6d8a81] dark:text-[#a4bebc]">{t("Pressure")}</span>
              <p className="font-bold text-[#1f4c41] dark:text-[#d8eae4]">{Math.round(effectiveConditions.current.pressureHpa)} hPa</p>
            </div>
          )}
          {effectiveConditions.current.visibilityKm != null && (
            <div className="rounded-xl border border-[#e8f0ec] bg-[#fafcfb] p-2 dark:border-[#323236] dark:bg-[#202023]">
              <span className="text-[#6d8a81] dark:text-[#a4bebc]">{t("Visibility")}</span>
              <p className="font-bold text-[#1f4c41] dark:text-[#d8eae4]">{effectiveConditions.current.visibilityKm} km</p>
            </div>
          )}
          {effectiveConditions.current.uvIndex != null && (
            <div className="rounded-xl border border-[#e8f0ec] bg-[#fafcfb] p-2 dark:border-[#323236] dark:bg-[#202023]">
              <span className="text-[#6d8a81] dark:text-[#a4bebc]">{t("UV Index")}</span>
              <p className="font-bold text-[#1f4c41] dark:text-[#d8eae4]">{effectiveConditions.current.uvIndex}</p>
            </div>
          )}
        </div>
      )}

      {/* Hourly Timeline (Next 24 Hours) */}
      {hourlyItems.length > 0 && (
        <section className="mt-4 border-t border-[#e6eeeb] pt-3 dark:border-[#37373c]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#277b6b] dark:text-[#7fd6bb]" />
            <h3 className="text-xs font-black text-[#234b42] dark:text-[#d5e9e1]">
              {t("Hourly Forecast (Next 24h)")}
            </h3>
          </div>
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {hourlyItems.slice(0, 12).map((item, idx) => {
              const HIcon = getWeatherIconComponent(item.icon);
              return (
                <div
                  key={idx}
                  className="flex min-w-[62px] shrink-0 flex-col items-center rounded-xl bg-[#f7faf9] p-2 text-center dark:bg-[#202023]"
                >
                  <span className="text-[10px] font-bold text-[#6a877f] dark:text-[#b0cbc3]">
                    {formatHour(item.time)}
                  </span>
                  <HIcon className="my-1.5 h-4 w-4 text-[#277b6b] dark:text-[#7fd6bb]" />
                  <span className="text-xs font-black text-[#1d4c42] dark:text-[#e4f5ef]">
                    {item.temperatureC != null ? `${Math.round(item.temperatureC)}°` : "—"}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold text-[#277b6b] dark:text-[#7fd6bb]">
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
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#e2ede8] bg-[#f8fcfb] px-3.5 py-2 text-xs font-semibold dark:border-[#37373c] dark:bg-[#202023]">
          <span className="flex items-center gap-2 text-[#43655d] dark:text-[#b5cdc5]">
            <Compass className="h-4 w-4 text-[#277b6b] dark:text-[#7fd6bb]" />
            {t("Air Quality:")} <strong className="text-[#1d4c42] dark:text-[#e4f5ef]">{effectiveConditions.airQuality.category}</strong> (AQI {effectiveConditions.airQuality.aqiUs})
          </span>
          {effectiveConditions.airQuality.pm25 !== null && (
            <span className="text-[10px] text-[#718d84] dark:text-[#a3b8b1]">
              PM2.5: {effectiveConditions.airQuality.pm25} µg/m³
            </span>
          )}
        </div>
      )}

      {/* 7-Day Rainfall Trend Graph (Expandable) */}
      {trendOpen && (
        <section
          className="mt-3 rounded-2xl bg-[#f3faf7] p-3 dark:bg-[#202023]"
          aria-label={t("Seven-day rainfall trend")}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[#285f55] dark:text-[#aee3d1]">
              {t("Seven-day rainfall trend")}
            </p>
            <span className="text-right text-[10px] font-semibold text-[#708981] dark:text-[#b5cdc5]">
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
                <line x1="8" y1="50" x2="184" y2="50" stroke="#cae4dc" strokeWidth="1" />
                <polyline
                  fill="none"
                  points={trendPoints}
                  stroke="#27806b"
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
                    fill="#27806b"
                  />
                ))}
              </svg>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {trendDays.map((day) => (
                  <span
                    key={day.date}
                    className="text-center text-[9px] font-bold text-[#6a867e] dark:text-[#b5cdc5]"
                  >
                    {dayName(day.date)}
                    <br />
                    {day.rainMm ?? "—"}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-[#6f8880]">{t("Modelled history is not available yet.")}</p>
          )}
        </section>
      )}

      {/* 7-Day Forecast Section */}
      <section className="mt-4 border-t border-[#e6eeeb] pt-4 dark:border-[#37373c]">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#277b6b] dark:text-[#7fd6bb]" />
          <h3 className="text-sm font-black text-[#234b42] dark:text-[#d5e9e1]">
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
                  className="rounded-xl bg-[#f7faf9] px-1 py-2 text-center dark:bg-[#202023]"
                >
                  <span className="block text-[9px] font-black text-[#58766d] dark:text-[#b5cdc5]">
                    {dayName(day.date)}
                  </span>
                  <DayIcon className="mx-auto my-1 h-3.5 w-3.5 text-[#277b6b] dark:text-[#7fd6bb]" />
                  <span className="block text-[10px] font-black text-[#244e45] dark:text-[#e6f5ef]">
                    {day.rainChance ?? "—"}%
                  </span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-[#748c84] dark:text-[#b5cdc5]">
                    {day.rainMm ?? "—"} mm
                  </span>
                </div>
              );
            })
          ) : (
            <p className="col-span-7 text-xs text-[#6f8880]">
              {effectiveLoading ? t("Forecast is loading.") : t("Forecast temporarily unavailable")}
            </p>
          )}
        </div>
      </section>

      {/* River Gauge & Flood Alert Footer */}
      <div className="mt-3 rounded-2xl bg-[#f1f8f5] px-3 py-3 text-xs font-bold text-[#315e52] dark:bg-[#242426] dark:text-[#d5e9e1]">
        <div className="flex items-center gap-3">
          <Waves className="h-5 w-5 shrink-0 text-[#277b6b] dark:text-[#7fd6bb]" />
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
            className="ml-8 mt-1 inline-block text-[10px] font-bold text-[#277b6b] underline underline-offset-2 dark:text-[#9ce4cc]"
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
