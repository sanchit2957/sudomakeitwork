import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/components/VictimNavigation";
import { trpc } from "@/lib/trpc";
import { usePortalConnectionStatus } from "@/hooks/usePortalStream";
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
type DiscoveryFilter = "nearby" | "verified" | "all";
type HospitalResource = {
  id: number | string;
  source?: "SAHAY_VERIFIED" | "PUBLIC_DIRECTORY";
  isSahayVerified?: boolean;
  name: string;
  organizationName?: string;
  branchName?: string;
  address: string;
  city?: string;
  state?: string;
  contactPhone: string | null;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  distance?: string | null;
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
  updatedAt: Date | string;
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
    ? "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    : status === "limited"
    ? "bg-amber-500/15 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    : status === "critical"
    ? "bg-red-500/15 text-red-700 dark:bg-red-950/60 dark:text-red-300"
    : "bg-slate-500/15 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300";
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
  const [filterMode, setFilterMode] = useState<DiscoveryFilter>("nearby");
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [nearbyApiData, setNearbyApiData] = useState<HospitalResource[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const sseConnected = usePortalConnectionStatus("citizen");
  const resources = trpc.rescue.safety.resources.useQuery(undefined, {
    refetchInterval: sseConnected ? false : 15_000,
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

  // Fetch Tier-1 (Sahay Verified) + Tier-2 (OpenStreetMap Public Directory) hospitals dynamically
  useEffect(() => {
    if (!position && filterMode !== "all") {
      return;
    }
    let active = true;
    const fetchDiscovery = async () => {
      setNearbyLoading(true);
      try {
        const params = new URLSearchParams();
        if (position) {
          params.set("lat", String(position.latitude));
          params.set("lng", String(position.longitude));
        }
        params.set("radiusKm", String(radiusKm));
        if (filterMode === "verified") params.set("includePublic", "false");
        if (filterMode === "all") params.set("allRegistered", "true");
        const res = await fetch(`/api/hospitals/nearby?${params.toString()}`);
        if (res.ok) {
          const payload = await res.json();
          if (active && Array.isArray(payload?.hospitals)) {
            setNearbyApiData(payload.hospitals);
          }
        }
      } catch {
        // Fallback gracefully to tRPC resources
      } finally {
        if (active) setNearbyLoading(false);
      }
    };
    void fetchDiscovery();
    return () => {
      active = false;
    };
  }, [position?.latitude, position?.longitude, radiusKm, filterMode]);

  const hospitals = useMemo(() => {
    const sourceList: HospitalResource[] = nearbyApiData
      ? nearbyApiData
      : ((resources.data?.hospitals || []) as HospitalResource[]).map(h => ({
          ...h,
          source: "SAHAY_VERIFIED" as const,
          isSahayVerified: true,
        }));

    return sourceList
      .filter(h => {
        if (filterMode === "verified") return h.source !== "PUBLIC_DIRECTORY";
        return true;
      })
      .map(hospital => {
        const dist =
          typeof hospital.distanceKm === "number"
            ? hospital.distanceKm
            : kilometresBetween(position, hospital.latitude, hospital.longitude);
        return {
          ...hospital,
          distanceKm: dist,
        };
      })
      .filter(h => {
        if (filterMode === "all" || filterMode === "verified") return true;
        if (h.distanceKm === null || h.distanceKm === undefined) return true;
        return h.distanceKm <= radiusKm;
      })
      .sort((a, b) => {
        // Rank Tier 1 (SAHAY_VERIFIED) ahead of Tier 2 (PUBLIC_DIRECTORY), then nearest first
        const aTier = a.source === "PUBLIC_DIRECTORY" ? 1 : 0;
        const bTier = b.source === "PUBLIC_DIRECTORY" ? 1 : 0;
        if (aTier !== bTier) return aTier - bTier;
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      });
  }, [nearbyApiData, resources.data, position, filterMode, radiusKm]);

  const locationCopy =
    positionState === "ready"
      ? t("Nearest verified hospital shown first")
      : positionState === "finding"
      ? t("Finding hospitals near you…")
      : t("Use location to sort hospitals by distance");

  return (
    <div className="victim-page relative min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC] overflow-x-hidden">
      {/* iOS Liquid Glass Ambient Refraction Layer */}
      <div className="liquid-ambient-bg" />

      <main className="victim-main relative z-10 mx-auto min-h-screen w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-36 pt-6">
        {/* Header */}
        <header className="glass-card mb-5 flex items-center justify-between p-3.5 shadow-sm">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1D4ED8] text-white shadow-md shadow-[#1D4ED8]/20">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                {t("Safety")}
              </span>
              <span className="block text-[10px] font-bold text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                {t("Nearby hospital information")}
              </span>
            </span>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Hero Notice Banner */}
        <section className="glass-panel glass-panel-dark overflow-hidden bg-[#0F172A] p-5 text-white dark:bg-[#0c1433]">
          <div className="flex gap-4 items-start">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#F1F5F9]">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#F8FAFC]">{t("Stay safe, stay informed")}</h1>
              <p className="mt-1 text-sm leading-6 text-[#CBD5E1]">
                {t("Find verified nearby medical care. For immediate danger, send an SOS now.")}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href="tel:112"
              className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-red-700 active:scale-95"
            >
              <PhoneCall className="mr-2 h-4 w-4" />
              {t("Call 112")}
            </a>
            <button
              onClick={() => setLocation("/")}
              className="inline-flex items-center justify-center rounded-xl border border-[#1D4ED8]/40 bg-[#1D4ED8] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#1d47db] active:scale-95"
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-300" />
              {t("Rapid SOS")}
            </button>
          </div>
        </section>

        {/* Verified Medical Care & Hospitals */}
        <VerifiedMedicalCare
          hospitals={hospitals}
          loading={(resources.isLoading && !nearbyApiData) || nearbyLoading}
          locationCopy={locationCopy}
          refresh={requestPosition}
          filterMode={filterMode}
          onChangeFilter={setFilterMode}
          radiusKm={radiusKm}
          onExpandRadius={() => {
            setFilterMode("nearby");
            setRadiusKm(prev => (prev < 100 ? 100 : 200));
          }}
          onViewAll={() => setFilterMode("all")}
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
  filterMode,
  onChangeFilter,
  radiusKm,
  onExpandRadius,
  onViewAll,
}: {
  hospitals: Array<HospitalResource & { distanceKm: number | null }>;
  loading: boolean;
  locationCopy: string;
  refresh: () => void;
  filterMode: DiscoveryFilter;
  onChangeFilter: (mode: DiscoveryFilter) => void;
  radiusKm: number;
  onExpandRadius: () => void;
  onViewAll: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#1D4ED8] dark:text-[#F1F5F9]">
            {t("Verified medical care")}
          </p>
          <h2 className="mt-1 text-xl font-black text-[#0F172A] dark:text-[#F8FAFC]">{t("Nearby hospitals")}</h2>
          <p className="mt-1 text-xs font-semibold text-[#0F172A]/70 dark:text-[#F1F5F9]/70">{locationCopy}</p>
        </div>
        <button
          type="button"
          aria-label={t("Refresh nearby hospitals")}
          onClick={refresh}
          className="grid h-10 w-10 place-items-center rounded-2xl glass-card text-[#1D4ED8] dark:text-[#F1F5F9] transition hover:scale-105 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filter Pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { id: "nearby", label: `${t("Nearby")} (${radiusKm} km)` },
            { id: "verified", label: t("Sahay Verified") },
            { id: "all", label: t("All Registered") },
          ] as const
        ).map(pill => (
          <button
            key={pill.id}
            type="button"
            onClick={() => onChangeFilter(pill.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filterMode === pill.id
                ? "bg-[#2457FF] text-white shadow-sm"
                : "glass-card text-[#0F172A] hover:bg-white/70 dark:text-[#F8FAFC] dark:hover:bg-white/10"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {loading ? (
        <HospitalLoading />
      ) : hospitals.length ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {hospitals.slice(0, 12).map((hospital, idx) => (
            <HospitalCard hospital={hospital} primary={idx === 0} key={`${hospital.source || "db"}-${hospital.id}`} />
          ))}
        </div>
      ) : (
        <NoHospitalCard onExpandRadius={onExpandRadius} onViewAll={onViewAll} radiusKm={radiusKm} />
      )}
    </section>
  );
}

function HospitalCard({
  hospital,
  primary = false,
}: {
  hospital: HospitalResource & { distanceKm: number | null };
  primary?: boolean;
}) {
  const { t } = useLanguage();
  const isDirectoryOnly = hospital.source === "PUBLIC_DIRECTORY";
  const erPct =
    hospital.totalEmergencyBeds > 0
      ? Math.min(100, Math.round((hospital.availableEmergencyBeds / hospital.totalEmergencyBeds) * 100))
      : 0;
  const icuPct =
    hospital.totalIcuBeds > 0
      ? Math.min(100, Math.round((hospital.availableIcuBeds / hospital.totalIcuBeds) * 100))
      : 0;

  return (
    <article
      className={`glass-panel overflow-hidden transition-all ${
        primary && !isDirectoryOnly ? "ring-2 ring-[#1D4ED8]/40 shadow-md" : ""
      }`}
    >
      <div className={`p-4 border-b border-[#E2E8F0]/20 dark:border-[#F1F5F9]/10 ${primary ? "bg-[#1D4ED8]/5 dark:bg-[#1D4ED8]/10" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-md ${isDirectoryOnly ? "bg-slate-600 shadow-slate-600/20" : "bg-[#1D4ED8] shadow-[#1D4ED8]/20"}`}>
              <Hospital className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-base font-black leading-5 text-[#0F172A] dark:text-[#F8FAFC]">
                  {hospital.organizationName || hospital.name}
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open Google Maps directions to ${hospital.name}`}
                  title={`Open Google Maps directions to ${hospital.name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg glass-card text-[#1D4ED8] dark:text-[#F1F5F9] transition active:scale-95 hover:bg-[#1D4ED8]/10"
                >
                  <Navigation className="h-4 w-4" />
                </a>
              </div>
              {hospital.branchName && hospital.branchName !== "Main Hospital" && (
                <p className="mt-0.5 text-[11px] font-bold text-[#2457FF] dark:text-[#93C5FD]">
                  {hospital.branchName}
                </p>
              )}
              <p className="mt-1 text-xs leading-5 text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                {typeof hospital.distanceKm === "number" ? `${hospital.distanceKm.toFixed(1)} km away · ` : ""}
                {hospital.address}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
              isDirectoryOnly
                ? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                : "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            }`}
          >
            {isDirectoryOnly ? t("Public Directory") : t("Sahay Verified")}
          </span>
        </div>
      </div>

      <div className="p-4">
        {isDirectoryOnly ? (
          <div className="rounded-2xl bg-slate-500/10 px-3.5 py-2.5 text-xs font-semibold text-[#0F172A]/80 dark:text-[#F1F5F9]/80">
            {t("Public Directory • Call facility to confirm live emergency bed availability")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MetricTile
                  icon={BedDouble}
                  label={t("Beds ready")}
                  value={hospital.availableEmergencyBeds}
                  total={hospital.totalEmergencyBeds}
                  tone="green"
                />
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${erPct}%` }} />
                </div>
              </div>
              <div>
                <MetricTile
                  icon={HeartPulse}
                  label={t("ICU ready")}
                  value={hospital.availableIcuBeds}
                  total={hospital.totalIcuBeds}
                  tone="blue"
                />
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#2457FF]/15">
                  <div className="h-full rounded-full bg-[#2457FF] transition-all" style={{ width: `${icuPct}%` }} />
                </div>
              </div>
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
                <span key={label} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-black ${supplyTone(value)}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}: {t(humanStatus(value))}</span>
                </span>
              ))}
            </div>
          </>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#E2E8F0]/20 dark:border-[#F1F5F9]/10 pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[#0F172A]/60 dark:text-[#F1F5F9]/60">
            <Clock3 className="h-3.5 w-3.5 shrink-0" />
            {isDirectoryOnly
              ? t("OpenStreetMap Public Facility")
              : `${t("Updated")} ${new Date(hospital.updatedAt).toLocaleTimeString()}`}
          </span>
          {hospital.contactPhone ? (
            <a
              href={`tel:${hospital.contactPhone}`}
              className="inline-flex shrink-0 items-center rounded-xl bg-[#1D4ED8] px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#1d47db] active:scale-95"
            >
              <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
              {t("Call")}
            </a>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-xl bg-[#E2E8F0]/20 px-3 py-1.5 text-xs font-bold text-[#0F172A]/60 dark:text-[#F1F5F9]/60">
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
  tone: "green" | "blue";
}) {
  const { t } = useLanguage();
  const styles =
    tone === "green"
      ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
      : "bg-[#1D4ED8]/10 text-[#0F172A] dark:text-[#F1F5F9]";
  return (
    <div className={`rounded-2xl p-3 ${styles}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-[10px] font-semibold opacity-75">
        {t("of")} {total} {t("total")}
      </p>
    </div>
  );
}

function HospitalLoading() {
  const { t } = useLanguage();
  return (
    <div className="glass-panel mt-4 p-8 text-center border-dashed border-[#E2E8F0]/40">
      <Hospital className="mx-auto h-8 w-8 animate-pulse text-[#1D4ED8]" />
      <p className="mt-3 text-sm font-bold text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
        {t("Loading verified hospitals…")}
      </p>
    </div>
  );
}

function NoHospitalCard({
  onExpandRadius,
  onViewAll,
  radiusKm = 50,
}: {
  onExpandRadius?: () => void;
  onViewAll?: () => void;
  radiusKm?: number;
}) {
  const { t } = useLanguage();
  return (
    <div className="glass-panel mt-4 p-7 text-center border-dashed border-[#E2E8F0]/40">
      <Building2 className="mx-auto h-9 w-9 text-[#E2E8F0]" />
      <p className="mt-3 text-base font-black text-[#0F172A] dark:text-[#F8FAFC]">
        {t("No verified hospital listed nearby")}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#0F172A]/70 dark:text-[#F1F5F9]/70 max-w-md mx-auto">
        {t("Hospital information appears here after a hospital is verified and staff publish its current capacity, or when public directory results load within")} {radiusKm} km.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onExpandRadius && (
          <button
            type="button"
            onClick={onExpandRadius}
            className="rounded-xl bg-[#2457FF] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1d47db]"
          >
            {t("Expand Search Radius")}
          </button>
        )}
        <a
          href="tel:112"
          className="rounded-xl border border-red-500/40 bg-red-600/10 px-3.5 py-2 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {t("Call 112")}
        </a>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-xl glass-card px-3.5 py-2 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]"
          >
            {t("View All India")}
          </button>
        )}
      </div>
    </div>
  );
}

function FloodSafety() {
  const { t } = useLanguage();
  return (
    <section className="glass-panel mt-5 border border-amber-500/30 bg-amber-500/10 p-4.5 text-amber-950 dark:text-amber-200">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-black text-amber-900 dark:text-amber-300">{t("Flood safety now")}</p>
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
    <div className="glass-card p-3">
      <Icon className="h-4 w-4 text-[#1D4ED8] dark:text-[#F1F5F9]" />
      <p className="mt-2 text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#0F172A]/70 dark:text-[#F1F5F9]/70">{copy}</p>
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
    <section className="glass-panel mt-5 p-4.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[.14em] text-[#1D4ED8] dark:text-[#F1F5F9]">
            {t("Local alert")}
          </p>
          <h2 className="mt-1 text-base font-black text-[#0F172A] dark:text-[#F8FAFC]">{title}</h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${tone}`}>
          {conditions?.risk ? t(riskInfo.badgeLabelKey) : t("loading")}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#0F172A]/70 dark:text-[#F1F5F9]/70 text-prose-justified">{detail}</p>
      <div className="glass-card mt-3 p-3 text-xs leading-relaxed text-[#0F172A]/80 dark:text-[#F1F5F9]/80">
        <span>{riverCopy}</span>
        {river?.sourceUrl && river?.sourceName ? (
          <a
            href={river.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block font-bold text-[#1D4ED8] dark:text-[#F1F5F9] underline underline-offset-2"
          >
            {river.sourceName}
            {river.updatedAt ? ` · ${t("observed")} ${new Date(river.updatedAt).toLocaleString()}` : ""}
          </a>
        ) : null}
      </div>
    </section>
  );
}
