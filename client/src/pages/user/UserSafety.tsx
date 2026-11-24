import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrentCoordinates, getLastKnownCoordinates } from "@/lib/nativeLocation";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Building2,
  Clock3,
  GlassWater,
  HeartPulse,
  Hospital,
  Navigation,
  PhoneCall,
  Pill,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TentTree,
  Utensils,
  Waves,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Position = { latitude: number; longitude: number } | null;
type PositionState = "finding" | "ready" | "unavailable";
type SupplyStatus = "available" | "limited" | "critical" | "unavailable";
type HospitalResource = {
  id: number;
  name: string;
  address: string;
  contactPhone: string | null;
  latitude: number;
  longitude: number;
  totalEmergencyBeds: number;
  availableEmergencyBeds: number;
  totalIcuBeds: number;
  availableIcuBeds: number;
  oxygenCylinderCount: number;
  bloodUnitCount: number;
  ambulanceCount: number;
  foodSupplyStatus: SupplyStatus;
  medicineSupplyStatus: SupplyStatus;
  waterSupplyStatus: SupplyStatus;
  powerBackupStatus: SupplyStatus;
  status: string;
  updatedAt: Date;
};

function kilometresBetween(position: Position, latitude: number, longitude: number) {
  return position
    ? Math.hypot(
        (latitude - position.latitude) * 111,
        (longitude - position.longitude) * 111 * Math.cos((position.latitude * Math.PI) / 180)
      )
    : null;
}

function supplyTone(status: SupplyStatus) {
  return status === "available"
    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
    : status === "limited"
    ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
    : status === "critical"
    ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
    : "bg-muted text-muted-foreground border-border";
}

function humanStatus(status: string) {
  return status === "unavailable" ? "Not available" : status[0].toUpperCase() + status.slice(1);
}

export default function UserSafety() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [position, setPosition] = useState<Position>(() => getLastKnownCoordinates());
  const [positionState, setPositionState] = useState<PositionState>(() =>
    getLastKnownCoordinates() ? "ready" : "finding"
  );
  const resources = trpc.rescue.safety.resources.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const conditions = trpc.rescue.emergency.conditions.useQuery(
    position ? { latitude: position.latitude, longitude: position.longitude } : {},
    { refetchInterval: 15 * 60_000, refetchOnWindowFocus: true }
  );

  const requestPosition = async () => {
    setPositionState("finding");
    try {
      const res = await getCurrentCoordinates({ enableHighAccuracy: true, timeout: 5000 });
      setPosition({ latitude: res.latitude, longitude: res.longitude });
      setPositionState("ready");
    } catch {
      if (!getLastKnownCoordinates()) {
        setPositionState("unavailable");
      }
    }
  };

  useEffect(() => {
    void requestPosition();
  }, []);

  const hospitals = useMemo(
    () =>
      ((resources.data?.hospitals || []) as HospitalResource[])
        .map((hospital) => ({
          ...hospital,
          distance: kilometresBetween(position, hospital.latitude, hospital.longitude),
        }))
        .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY)),
    [resources.data, position]
  );

  const locationCopy =
    positionState === "ready"
      ? t("Nearest verified hospital shown first")
      : positionState === "finding"
      ? t("Finding hospitals near you…")
      : t("Use location to sort hospitals by distance");

  return (
    <div className="victim-page relative min-h-screen bg-white text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="victim-main relative z-10 mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-32 pt-3">
        {/* Seamless Header matching Citizen Home */}
        <header className="flex items-center justify-between gap-3 pt-2 pb-4">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("Clinical Care Directory")}
              </p>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t("Safety & Hospital Resources")}
              </h1>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Institutional Emergency Action Banner */}
        <section className="mb-5 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("Emergency Healthcare Hotline")}
                </span>
              </div>
              <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {t("In Need of Immediate Medical Care?")}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-xl">
                {t("Review verified hospital capacity below or dial national emergency dispatch immediately.")}
              </p>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2.5">
              <a
                href="tel:112"
                className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
              >
                <PhoneCall className="mr-2 h-4 w-4" />
                {t("Call 112")}
              </a>
              <button
                onClick={() => setLocation("/")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                {t("Emergency SOS")}
              </button>
            </div>
          </div>
        </section>

        {/* Verified Medical Care & Hospitals */}
        <VerifiedMedicalCare
          hospitals={hospitals}
          loading={resources.isLoading}
          locationCopy={locationCopy}
          refresh={requestPosition}
        />

        {/* River & Local Weather Alerts */}
        <SafetyConditionsCard conditions={conditions.data} loading={conditions.isLoading} />

        {/* Flood Safety Protocols */}
        <FloodSafety />
      </main>
      <VictimNavigation current="safety" />
    </div>
  );
}

function VerifiedMedicalCare({
  hospitals,
  loading,
  locationCopy,
  refresh,
}: {
  hospitals: Array<HospitalResource & { distance: number | null }>;
  loading: boolean;
  locationCopy: string;
  refresh: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3 pb-3 border-b border-border">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("Verified Medical Directory")}
          </span>
          <h2 className="mt-0.5 text-base sm:text-lg font-bold text-foreground">
            {t("Nearby Hospitals & Trauma Centers")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{locationCopy}</p>
        </div>
        <button
          type="button"
          aria-label={t("Refresh nearby hospitals")}
          onClick={refresh}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-foreground shadow-xs hover:bg-muted active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {loading ? (
        <HospitalLoading />
      ) : hospitals.length ? (
        <div className="mt-4 grid gap-3.5">
          <HospitalCard hospital={hospitals[0]} primary />
          {hospitals.slice(1, 4).map((hospital) => (
            <HospitalCard hospital={hospital} key={hospital.id} />
          ))}
        </div>
      ) : (
        <NoHospitalCard />
      )}
    </section>
  );
}

function HospitalCard({
  hospital,
  primary = false,
}: {
  hospital: HospitalResource & { distance: number | null };
  primary?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <article
      className={`rounded-xl border bg-card shadow-xs transition-all ${
        primary
          ? "border-emerald-500/50 ring-1 ring-emerald-500/30"
          : "border-border"
      }`}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted/60 text-foreground">
              <Hospital className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-sm font-bold text-foreground">
                  {hospital.name}
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("Get directions")}
                  title={t("Get directions")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-foreground hover:bg-muted"
                >
                  <Navigation className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hospital.distance !== null ? `${hospital.distance.toFixed(1)} km away · ` : ""}
                {hospital.address}
              </p>
            </div>
          </div>
          <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            {t("Operational")}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            icon={BedDouble}
            label={t("Emergency Beds")}
            value={hospital.availableEmergencyBeds}
            total={hospital.totalEmergencyBeds}
          />
          <MetricTile
            icon={HeartPulse}
            label={t("ICU Ventilators")}
            value={hospital.availableIcuBeds}
            total={hospital.totalIcuBeds}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { label: t("Food"), value: hospital.foodSupplyStatus, icon: Utensils },
              { label: t("Medicine"), value: hospital.medicineSupplyStatus, icon: Pill },
              { label: t("Water"), value: hospital.waterSupplyStatus, icon: GlassWater },
              { label: t("Power"), value: hospital.powerBackupStatus, icon: PlugZap },
            ] as const
          ).map(({ label, value, icon: Icon }) => (
            <span key={label} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${supplyTone(value)}`}>
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{label}: {t(humanStatus(value))}</span>
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="flex min-w-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Clock3 className="h-3 w-3 shrink-0" />
            {t("Updated")} {new Date(hospital.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {hospital.contactPhone ? (
            <a
              href={`tel:${hospital.contactPhone}`}
              className="inline-flex shrink-0 items-center rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
            >
              <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
              {t("Call Hospital")}
            </a>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {t("No phone listed")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: typeof BedDouble;
  label: string;
  value: number;
  total: number;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {t("of")} {total} {t("total capacity")}
      </p>
    </div>
  );
}

function HospitalLoading() {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center mt-4">
      <Hospital className="mx-auto h-7 w-7 animate-pulse text-muted-foreground" />
      <p className="mt-3 text-xs font-semibold text-muted-foreground">
        {t("Loading verified hospitals…")}
      </p>
    </div>
  );
}

function NoHospitalCard() {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center mt-4">
      <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold text-foreground">
        {t("No verified hospital listed nearby")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
        {t("Hospital information appears here after a hospital is verified and staff publish its current capacity.")}
      </p>
    </div>
  );
}

function FloodSafety() {
  const { t } = useLanguage();
  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="w-full">
          <p className="text-sm font-bold text-foreground">{t("Flood & Disaster Safety Protocols")}</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <SafetyTip
              icon={TentTree}
              title={t("Move to Higher Ground")}
              copy={t("Evacuate low-lying areas before floodwaters peak.")}
            />
            <SafetyTip
              icon={Waves}
              title={t("Avoid Moving Water")}
              copy={t("Never drive, walk, or wade across flood pathways.")}
            />
            <SafetyTip
              icon={Smartphone}
              title={t("Maintain Emergency Contact")}
              copy={t("Keep communications active and monitor official disaster broadcasts.")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SafetyTip({ icon: Icon, title, copy }: { icon: typeof TentTree; title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <Icon className="h-4 w-4 text-foreground" />
      <p className="mt-2 text-xs font-bold text-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}

type RiverConditions = {
  available: boolean;
  levelMetres: number | null;
  trend: "rising" | "falling" | "steady" | null;
  stationName: string | null;
  updatedAt: Date | string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  message: string | null;
};
type SafetyConditions = {
  available: boolean;
  source: string;
  risk: string;
  forecast: { rainChance: number | null; rainAmountMm: number | null };
  river?: RiverConditions | null;
};

export function SafetyConditionsCard({ conditions, loading }: { conditions?: SafetyConditions; loading: boolean }) {
  const { t } = useLanguage();
  const riskInfo = getWeatherRiskPresentation(conditions?.risk);
  const title = loading
    ? t("Checking conditions")
    : conditions?.available
    ? t(riskInfo.safetyTitleKey)
    : t("Weather source unavailable");
  const tone = riskInfo.badgeTone;
  const detail = conditions?.available
    ? `${conditions.forecast.rainChance ?? "—"}% ${t("chance of rain today")}${
        conditions.forecast.rainAmountMm !== null ? ` · ${conditions.forecast.rainAmountMm} mm ${t("forecast")}` : ""
      }. ${
        riskInfo.level === "critical"
          ? t("Avoid low-lying routes and move early if local authorities advise.")
          : t("Keep monitoring local authority alerts before travelling.")
      }`
    : t("Live weather information is temporarily unavailable. Follow official local authority warnings and do not rely on this screen alone.");
  const river = conditions?.river;
  const riverCopy =
    river?.available && river.levelMetres !== null
      ? `${river.stationName || t("Official river gauge")} · ${river.levelMetres.toFixed(2)} m${river.trend ? ` · ${t(river.trend)}` : ""}`
      : river?.message
      ? t(river.message)
      : t("Official river-gauge data is temporarily unavailable.");

  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("Environmental Advisory")}
          </span>
          <h2 className="mt-0.5 text-base font-bold text-foreground">{title}</h2>
        </div>
        <span className={`rounded-md px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase border ${tone}`}>
          {conditions?.risk ? t(riskInfo.badgeLabelKey) : t("loading")}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground">
        <span>{riverCopy}</span>
        {river?.sourceUrl && river?.sourceName ? (
          <a
            href={river.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block font-semibold text-foreground underline underline-offset-2"
          >
            {river.sourceName}
            {river.updatedAt ? ` · ${t("observed")} ${new Date(river.updatedAt).toLocaleString()}` : ""}
          </a>
        ) : null}
      </div>
    </section>
  );
}
