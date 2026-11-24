import React, { useState, useEffect } from "react";
import { CalendarDays, Clock, CloudRain } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FloodConditionsData, WeatherDay, WeatherHour } from "./FloodConditionsPanel";
import { getWeatherIconComponent, dayName, formatHour } from "./FloodConditionsPanel";
import { fetchDirectClientWeather } from "@/lib/clientWeather";

export interface WeatherForecastPanelProps {
  conditions?: FloodConditionsData;
  loading: boolean;
  latitude?: number;
  longitude?: number;
}

export function WeatherForecastPanel({
  conditions,
  loading,
  latitude,
  longitude,
}: WeatherForecastPanelProps) {
  const { t } = useLanguage();
  const [clientConditions, setClientConditions] = useState<FloodConditionsData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // When server weather is unavailable or missing forecast days, hydrate directly from Open-Meteo
  useEffect(() => {
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

  const hourlyItems: WeatherHour[] = effectiveConditions?.forecast?.hourly24h || [];
  const forecastDays: WeatherDay[] = effectiveConditions?.forecast?.days || [];

  return (
    <section
      aria-label="Hourly and 7-day weather forecast"
      className="glass-panel p-5 shadow-sm border border-[#E2E8F0]/30 bg-white/75 dark:border-[#F1F5F9]/15 dark:bg-[#0F172A]/65"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0]/25 pb-3 dark:border-[#F1F5F9]/15">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#1D4ED8] dark:text-[#F1F5F9]">
            {t("Forecast Telemetry")}
          </p>
          <h2 className="mt-0.5 text-base font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            {t("Hourly & 7-Day Forecast")}
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1D4ED8]/10 px-3 py-1 text-xs font-bold text-[#1D4ED8] dark:bg-[#1D4ED8]/25 dark:text-[#F1F5F9]">
          <CloudRain className="h-3.5 w-3.5" />
          <span>{effectiveConditions?.current?.condition || t("Forecast Active")}</span>
        </span>
      </div>

      {/* Hourly Timeline (Next 24 Hours) */}
      <div className="mt-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
          <h3 className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
            {t("Hourly Forecast (Next 24h)")}
          </h3>
        </div>
        <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
          {hourlyItems.length > 0 ? (
            hourlyItems.slice(0, 12).map((item, idx) => {
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
            })
          ) : (
            <p className="py-2 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
              {effectiveLoading ? t("Loading hourly telemetry…") : t("Hourly forecast unavailable")}
            </p>
          )}
        </div>
      </div>

      {/* 7-Day Forecast Section */}
      <div className="mt-4 border-t border-[#E2E8F0]/20 pt-4 dark:border-[#F1F5F9]/15">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
          <h3 className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
            {t("7-Day Weather Outlook")}
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
                  <span className="block text-[10px] font-black text-[#0F172A]/80 dark:text-[#F1F5F9]/85">
                    {dayName(day.date)}
                  </span>
                  <DayIcon className="mx-auto my-1.5 h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                  <span className="block text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                    {day.rainChance ?? "—"}%
                  </span>
                  <span className="mt-0.5 block text-[10px] font-bold text-[#0F172A]/65 dark:text-[#F1F5F9]/70">
                    {day.rainMm ?? "—"} mm
                  </span>
                </div>
              );
            })
          ) : (
            <p className="col-span-7 py-2 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
              {effectiveLoading ? t("Loading 7-day outlook…") : t("7-day forecast temporarily unavailable")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default WeatherForecastPanel;
