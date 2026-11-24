import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrentCoordinates, getLastKnownCoordinates } from "@/lib/nativeLocation";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";
import {
  AlertTriangle,
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
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "limited"
    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300"
    : status === "critical"
    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
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
    <div className="victim-page relative min-h-screen bg-[#F8FAFC] text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="victim-main relative z-10 mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-32 pt-5">
        {/* Header */}
        <header className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 mb-5 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-base font-bold text-slate-900 dark:text-white">
                {t("Safety")}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {t("Nearby hospital information")}
              </span>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Hero Notice Banner */}
        <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 text-white shadow-sm">
          <div className="flex gap-4 items-start">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-teal-400">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{t("Stay safe, stay informed")}</h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {t("Find verified nearby medical care. For immediate danger, send an SOS now.")}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href="tel:112"
              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-95"
            >
              <PhoneCall className="mr-2 h-4 w-4" />
              {t("Call 112")}
            </a>
            <button
              onClick={() => setLocation("/")}
              className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-teal-700 active:scale-95"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {t("Rapid SOS")}
            </button>
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            {t("Verified medical care")}
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{t("Nearby hospitals")}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{locationCopy}</p>
        </div>
        <button
          type="button"
          aria-label={t("Refresh nearby hospitals")}
          onClick={refresh}
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {loading ? (
        <HospitalLoading />
      ) : hospitals.length ? (
        <div className="mt-4 grid gap-4">
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
      className={`rounded-2xl border bg-white shadow-xs transition-all dark:bg-slate-900 ${
        primary
          ? "border-teal-500/40 ring-1 ring-teal-500/30"
          : "border-slate-200/80 dark:border-slate-800"
      }`}
    >
      <div className={`p-4 border-b border-slate-100 dark:border-slate-800 ${primary ? "bg-teal-50/30 dark:bg-teal-950/20" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
              <Hospital className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-sm font-bold text-slate-900 dark:text-white">
                  {hospital.name}
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("Get directions")}
                  title={t("Get directions")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 text-teal-600 hover:bg-teal-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Navigation className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {hospital.distance !== null ? `${hospital.distance.toFixed(1)} km away · ` : ""}
                {hospital.address}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
            {t("Open")}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            icon={BedDouble}
            label={t("Beds ready")}
            value={hospital.availableEmergencyBeds}
            total={hospital.totalEmergencyBeds}
            tone="teal"
          />
          <MetricTile
            icon={HeartPulse}
            label={t("ICU ready")}
            value={hospital.availableIcuBeds}
            total={hospital.totalIcuBeds}
            tone="blue"
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
            <span key={label} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${supplyTone(value)}`}>
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{label}: {t(humanStatus(value))}</span>
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400">
            <Clock3 className="h-3 w-3 shrink-0" />
            {t("Updated")} {new Date(hospital.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {hospital.contactPhone ? (
            <a
              href={`tel:${hospital.contactPhone}`}
              className="inline-flex shrink-0 items-center rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
            >
              <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
              {t("Call")}
            </a>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-xl bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800">
              {t("No call number")}
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
  tone,
}: {
  icon: typeof BedDouble;
  label: string;
  value: number;
  total: number;
  tone: "teal" | "blue";
}) {
  const { t } = useLanguage();
  const styles =
    tone === "teal"
      ? "bg-teal-50/70 text-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
      : "bg-blue-50/70 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
  return (
    <div className={`rounded-xl p-3 border border-transparent ${styles}`}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-[10px] opacity-70">
        {t("of")} {total} {t("total")}
      </p>
    </div>
  );
}

function HospitalLoading() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 mt-4">
      <Hospital className="mx-auto h-7 w-7 animate-pulse text-teal-600" />
      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {t("Loading verified hospitals…")}
      </p>
    </div>
  );
}

function NoHospitalCard() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 mt-4">
      <Building2 className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
        {t("No verified hospital listed nearby")}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        {t("Hospital information appears here after a hospital is verified and staff publish its current capacity.")}
      </p>
    </div>
  );
}

function FloodSafety() {
  const { t } = useLanguage();
  return (
    <section className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-300">{t("Flood safety now")}</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <SafetyTip
              icon={TentTree}
              title={t("Move higher")}
              copy={t("Leave low ground before water rises.")}
            />
            <SafetyTip
              icon={Waves}
              title={t("Avoid water")}
              copy={t("Never walk or drive through moving water.")}
            />
            <SafetyTip
              icon={Smartphone}
              title={t("Keep contact")}
              copy={t("Charge your phone and keep emergency numbers ready.")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SafetyTip({ icon: Icon, title, copy }: { icon: typeof TentTree; title: string; copy: string }) {
  return (
    <div className="rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-900/30 dark:bg-slate-900/80">
      <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
      <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{copy}</p>
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
    <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            {t("Local alert")}
          </p>
          <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
          {conditions?.risk ? t(riskInfo.badgeLabelKey) : t("loading")}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
        <span>{riverCopy}</span>
        {river?.sourceUrl && river?.sourceName ? (
          <a
            href={river.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block font-semibold text-teal-600 dark:text-teal-400 hover:underline"
          >
            {river.sourceName}
            {river.updatedAt ? ` · ${t("observed")} ${new Date(river.updatedAt).toLocaleString()}` : ""}
          </a>
        ) : null}
      </div>
    </section>
  );
}
