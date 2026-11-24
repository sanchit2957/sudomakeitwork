import { MapView, type MapHospital, type MapShelter } from "@/components/Map";
import LanguageSelector from "@/components/LanguageSelector";
import { FloodConditionsPanel } from "@/components/FloodConditionsPanel";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { clearSosVoiceNote, readSosVoiceNote } from "@/lib/sosVoiceNote";
import { VoiceNoteCard } from "@/components/VoiceNoteCard";
import { AiBotCard } from "@/components/AiBotCard";
import { ProfileAvatar, UserProfileBadge } from "@/components/ProfileAvatar";
import { QuickActionsPanel } from "@/components/QuickActionsPanel";
import { SahayakAiModal } from "@/components/SahayakAiModal";
import { SosClassificationModal } from "@/components/SosClassificationModal";
import { flushOfflineSos, queueOfflineSos, pendingSosCount } from "@/lib/offlineSos";
import { createAndRedirectAfterRapidSos, redirectAfterRapidSos, rememberLatestSos } from "@/lib/rapidSos";
import { buildEmergencySmsUri } from "@/lib/emergencyDispatch";
import { startBleSosBeacon } from "@/lib/bleBeacon";
import { getCurrentCoordinates, getLastKnownCoordinates } from "@/lib/nativeLocation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";
import { INDIA_CENTER } from "@shared/india-locations";
import {
  Bluetooth,
  Database,
  Hospital,
  MapPin,
  MessageSquare,
  Navigation,
  PhoneCall,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Waves,
  Wifi,
  WifiOff,
} from "lucide-react";
import { VictimNavigation } from "@/components/VictimNavigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type Point = { latitude: number; longitude: number };

export default function UserHome() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [position, setPosition] = useState<Point | null>(() => getLastKnownCoordinates());
  const [manualLocation, setManualLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(true);
  const [locationStatus, setLocationStatus] = useState<"finding" | "ready" | "unavailable">(() =>
    getLastKnownCoordinates() ? "ready" : "finding"
  );
  const [isLocating, setIsLocating] = useState(false);
  const [rapidStatus, setRapidStatus] = useState<"idle" | "locating" | "sending" | "queued" | "error">("idle");
  const [rapidNotice, setRapidNotice] = useState("");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [triageData, setTriageData] = useState<{ publicCode: string; incidentId?: number; triageDeadlineAt?: Date | string | null } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bleActive, setBleActive] = useState(false);

  // Route non-citizen roles to their canonical workspace
  useEffect(() => {
    if (!authLoading && user && user.role && user.role !== "user") {
      const canonicalPath =
        user.role === "admin"
          ? "/command"
          : user.role === "hospital" || user.role === "medical"
          ? "/medical"
          : user.role === "rescuer"
          ? "/responder"
          : null;
      if (canonicalPath) {
        setLocation(canonicalPath);
      }
    }
  }, [user, authLoading, setLocation]);

  const activeWeatherCoords = manualLocation
    ? { latitude: manualLocation.lat, longitude: manualLocation.lng }
    : position
    ? { latitude: position.latitude, longitude: position.longitude }
    : undefined;

  const conditions = trpc.rescue.emergency.conditions.useQuery(activeWeatherCoords || {}, {
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: true,
  });

  const resourcesQuery = trpc.rescue?.safety?.resources?.useQuery
    ? trpc.rescue.safety.resources.useQuery(undefined, {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      })
    : { data: undefined, isLoading: false };

  const createSos = trpc.rescue.emergency.create.useMutation();

  const refreshPending = () => {
    void pendingSosCount().then((count) => setPendingCount(count));
  };

  const handleLocationChange = (lat: number, lng: number, name: string) => {
    setManualLocation({ name, lat, lng });
    setIsGpsActive(false);
  };

  const handleGpsLocate = async () => {
    setManualLocation(null);
    setIsGpsActive(true);
    setIsLocating(true);
    setLocationStatus("finding");
    try {
      const res = await getCurrentCoordinates({ enableHighAccuracy: true, timeout: 6000 });
      setPosition({ latitude: res.latitude, longitude: res.longitude });
      setLocationStatus("ready");
    } catch (err) {
      console.warn("[UserHome] GPS locate failed:", err);
      if (!position) {
        setLocationStatus("unavailable");
      }
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    refreshPending();
    const sync = () => {
      setOnline(navigator.onLine);
      refreshPending();
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("sudo-sos-outbox", refreshPending);

    // Acquire fast native/browser coordinates
    void getCurrentCoordinates({ enableHighAccuracy: true, timeout: 5000 })
      .then((res) => {
        setPosition({ latitude: res.latitude, longitude: res.longitude });
        setLocationStatus("ready");
      })
      .catch((err) => {
        console.warn("[UserHome] Initial location acquisition note:", err);
        if (!getLastKnownCoordinates()) {
          setLocationStatus("unavailable");
        }
      });

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("sudo-sos-outbox", refreshPending);
    };
  }, []);

  // Filter nearby hospitals (within 50km of user position)
  const nearbyHospitals: MapHospital[] = useMemo(() => {
    if (!position || !resourcesQuery.data?.hospitals) return [];
    return resourcesQuery.data.hospitals
      .map((h) => {
        const distanceKm = Math.hypot(
          (h.latitude - position.latitude) * 111,
          (h.longitude - position.longitude) * 111 * Math.cos((position.latitude * Math.PI) / 180)
        );
        return { ...h, distanceKm };
      })
      .filter((h) => h.distanceKm <= 50)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [position, resourcesQuery.data?.hospitals]);

  // Filter nearby shelters (within 50km of user position)
  const nearbyShelters: MapShelter[] = useMemo(() => {
    if (!position || !resourcesQuery.data?.shelters) return [];
    return resourcesQuery.data.shelters
      .map((s) => {
        const distanceKm = Math.hypot(
          (s.latitude - position.latitude) * 111,
          (s.longitude - position.longitude) * 111 * Math.cos((position.latitude * Math.PI) / 180)
        );
        return { ...s, distanceKm };
      })
      .filter((s) => s.distanceKm <= 50)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [position, resourcesQuery.data?.shelters]);

  const triggerFlush = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await flushOfflineSos((payload) => createSos.mutateAsync(payload));
      refreshPending();
      if (result.delivered.length > 0) {
        clearSosVoiceNote();
        setRapidStatus("idle");
        setRapidNotice(t("Offline SOS successfully dispatched to State Command Centre!"));
        redirectAfterRapidSos(result.delivered[0], setLocation);
      }
    } catch {
      // Retain in IndexedDB
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!online || !user) return;
    void triggerFlush();
  }, [online, user?.id]);

  const startRapidSos = () => {
    if (authLoading) return;
    if (!user) {
      startLogin();
      return;
    }

    const submitSosWithCoords = async (latitude: number, longitude: number, label: string) => {
      setPosition({ latitude, longitude });
      setLocationStatus("ready");
      const voiceNote = readSosVoiceNote();
      const payload = {
        contactName: user.name || undefined,
        locationLabel: label,
        latitude,
        longitude,
        emergencyType: "flood" as const,
        severity: "high" as const,
        peopleAffected: 1,
        voiceNoteDataUrl: voiceNote?.dataUrl,
        voiceNoteDurationSeconds: voiceNote?.durationSeconds,
      };

      // Activate Bluetooth Low Energy Beacon for nearby rescue boats
      startBleSosBeacon({
        id: `SOS-BLE-${Date.now().toString(36).toUpperCase()}`,
        latitude,
        longitude,
        emergencyType: "flood",
        peopleAffected: 1,
      });
      setBleActive(true);

      if (!navigator.onLine) {
        const guestKey = localStorage.getItem("sudo-makeitwork-guest-key") || crypto.randomUUID().replaceAll("-", "");
        localStorage.setItem("sudo-makeitwork-guest-key", guestKey);
        await queueOfflineSos({ ...payload, guestKey });
        refreshPending();
        setRapidStatus("queued");
        setRapidNotice(t("SOS saved in device database (IndexedDB) & BLE Beacon active. Will auto-dispatch when network returns."));
        return;
      }

      try {
        setRapidStatus("sending");
        const created = await createSos.mutateAsync(payload);
        rememberLatestSos(created.publicCode);
        clearSosVoiceNote();
        setRapidStatus("idle");
        setTriageData({
          publicCode: created.publicCode,
          incidentId: (created as any).incidentId,
          triageDeadlineAt: (created as any).triageDeadlineAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const isNetworkFail = !navigator.onLine || /fetch|network|failed to fetch|timeout|abort|econnrefused/i.test(message);
        if (isNetworkFail) {
          const guestKey = localStorage.getItem("sudo-makeitwork-guest-key") || crypto.randomUUID().replaceAll("-", "");
          localStorage.setItem("sudo-makeitwork-guest-key", guestKey);
          await queueOfflineSos({ ...payload, guestKey });
          refreshPending();
          setRapidStatus("queued");
          setRapidNotice(t("Network dropped. SOS is safely preserved in device database (IndexedDB) and auto-syncing."));
          return;
        }
        const isSafeInputMessage = /^(Voice notes|Evidence|Locations|Available beds)/.test(message);
        setRapidStatus("error");
        setRapidNotice(isSafeInputMessage ? t(message) : t("SOS could not be sent. Check connection and try again."));
      }
    };

    setRapidStatus("locating");
    setRapidNotice(t("Getting location to send SOS immediately…"));

    if (position) {
      void submitSosWithCoords(position.latitude, position.longitude, t("GPS location captured from this phone"));
    } else {
      void getCurrentCoordinates({ enableHighAccuracy: true, timeout: 6000 })
        .then((res) => {
          setPosition({ latitude: res.latitude, longitude: res.longitude });
          setLocationStatus("ready");
          submitSosWithCoords(res.latitude, res.longitude, t("GPS location captured from this phone"));
        })
        .catch(() => {
          submitSosWithCoords(INDIA_CENTER.lat, INDIA_CENTER.lng, t("National emergency coordinates"));
        });
    }
  };

  const activePoint = position || { latitude: INDIA_CENTER.lat, longitude: INDIA_CENTER.lng };
  const emergencySmsUrl = buildEmergencySmsUri({
    latitude: activePoint.latitude,
    longitude: activePoint.longitude,
    emergencyType: "flood",
    peopleAffected: 1,
    locationLabel: manualLocation?.name || (position ? t("GPS location captured from this phone") : t("National emergency coordinates")),
  });

  return (
    <div className="victim-page relative min-h-screen bg-white text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden flex flex-col justify-between">
      <main className="mx-auto w-full max-w-md sm:max-w-xl px-5 pb-32 pt-3 flex-1 flex flex-col justify-between">
        {/* Top Seamless Header (Reference Image 3: Human-Centric) */}
        <header className="flex items-center justify-between gap-2 pt-2 pb-4">
          <div className="min-w-0 pr-1">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
              {t("Welcome back,")}
            </p>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {user?.name || t("Citizen")}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSelector compact />
            <button
              type="button"
              onClick={() => setLocation(user ? "/profile" : "/login")}
              aria-label={t("User profile")}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:ring-2 hover:ring-rose-500/30 transition shadow-xs"
            >
              {user?.name ? (
                <span className="text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
              ) : (
                <span className="text-[10px] font-bold text-rose-600">IN</span>
              )}
              {/* Online/Offline status indicator dot */}
              <span
                className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#0A0E17] ${
                  online ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </button>
          </div>
        </header>

        {/* Offline SOS & Cellular Radio / BLE Options */}
        {(!online || pendingCount > 0 || bleActive) && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-50/70 p-3.5 text-xs text-amber-950 shadow-xs dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>
                  {pendingCount > 0
                    ? `${pendingCount} ${pendingCount === 1 ? t("Offline SOS in IndexedDB") : t("Offline SOS Alerts in IndexedDB")}`
                    : t("Offline Emergency Mode Active")}
                </span>
              </div>
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSyncing || !online}
                  onClick={triggerFlush}
                  className="h-7 rounded-lg border-amber-600/40 bg-amber-600 px-2.5 text-[11px] font-bold text-white hover:bg-amber-700 active:scale-95"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? t("Syncing…") : t("Sync Now")}
                </Button>
              )}
            </div>

            {/* BLE Beacon Pulse Indicator */}
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-cyan-950/10 px-3 py-1.5 text-[11px] font-bold text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
                </span>
                <Bluetooth className="h-3.5 w-3.5" />
                {t("BLE SOS Beacon Broadcasting")}
              </span>
              <span className="text-[10px] opacity-80">{t("~50-100m")}</span>
            </div>
          </div>
        )}

        {/* Primary Human-Centric Crisis Section (Middle Screen of Reference Image 3) */}
        <div className="my-auto flex flex-col items-center justify-center py-4">
          {/* Headline & Calm Prompt */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t("Are you in emergency?")}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {t("Press the button below, help will reach you soon.")}
            </p>
          </div>

          {/* Balanced Circular SOS Button & Concentric Pedestal Frame */}
          <div className="sahay-sos-pedestal my-3">
            <div className="sahay-sos-pedestal-inner">
              <button
                type="button"
                onClick={startRapidSos}
                disabled={authLoading || rapidStatus === "locating" || rapidStatus === "sending"}
                aria-label={t("Send SOS")}
                className="sahay-sos-btn"
              >
                <span className="relative z-10 flex flex-col items-center justify-center select-none pointer-events-none">
                  {rapidStatus === "locating" || rapidStatus === "sending" ? (
                    <Radio className="mb-1 h-7 w-7 animate-pulse text-white drop-shadow-sm" />
                  ) : (
                    <Siren className="mb-0.5 h-6 w-6 text-white drop-shadow-sm" />
                  )}
                  <span className="text-4xl sm:text-5xl font-black tracking-wider text-white">
                    SOS
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
                    {rapidStatus === "locating"
                      ? t("Acquiring GPS…")
                      : rapidStatus === "sending"
                      ? t("Broadcasting…")
                      : user
                      ? t("Tap for Help")
                      : t("Sign in to SOS")}
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Status or Error Notice */}
          {rapidNotice && (
            <div
              role="status"
              className={`mt-3 max-w-xs text-center text-xs font-semibold leading-relaxed px-4 py-1.5 rounded-full ${
                rapidStatus === "error"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              }`}
            >
              {rapidNotice}
            </div>
          )}

          {/* Direct 1-Tap Emergency Dispatch Actions: Call 112 & SMS 112 */}
          <div className="mt-6 flex items-center justify-center gap-3 w-full max-w-xs">
            <a
              href="tel:112"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-center text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition"
            >
              <PhoneCall className="h-4 w-4" />
              <span>{t("Call 112")}</span>
            </a>
            <a
              href={emergencySmsUrl}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-center text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
            >
              <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>{t("SMS 112")}</span>
            </a>
          </div>

          {/* Floating Current Address Card (Reference Image 3) */}
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                {t("Your current address")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                {manualLocation?.name ||
                  (position
                    ? `${position.latitude.toFixed(4)}° N, ${position.longitude.toFixed(4)}° E`
                    : t("Acquiring emergency coordinates…"))}
              </p>
            </div>
            <button
              type="button"
              onClick={handleGpsLocate}
              disabled={isLocating}
              aria-label={t("Refresh GPS location")}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`h-4 w-4 ${isLocating ? "animate-spin text-rose-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Secondary Operational Services & Facilities Accordion */}
        <details className="group mt-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 transition">
          <summary className="flex cursor-pointer items-center justify-between font-bold text-xs text-slate-700 dark:text-slate-300 select-none">
            <span className="flex items-center gap-2">
              <Hospital className="h-4 w-4 text-slate-500" />
              <span>{t("Nearby Hospitals & Operational Map")}</span>
            </span>
            <span className="text-[11px] font-normal text-rose-600 dark:text-rose-400 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="mt-4 space-y-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
            {/* Quick Actions Panel & AI Sahayak */}
            <QuickActionsPanel onOpenAi={() => setIsAiModalOpen(true)} />

            {/* Map Preview */}
            <LocationPreview
              point={position}
              state={locationStatus}
              hospitals={nearbyHospitals}
              shelters={nearbyShelters}
              onRecenter={handleGpsLocate}
              recenterLoading={isLocating}
            />

            {/* Nearby Emergency Facilities List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>{t("Verified Medical Centers")}</span>
                <span className="font-mono text-[10px]">
                  {nearbyHospitals.length} {t("within 50 km")}
                </span>
              </div>
              {nearbyHospitals.length > 0 ? (
                nearbyHospitals.slice(0, 3).map((h) => (
                  <div
                    key={`hosp-${h.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs shadow-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{h.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {h.distanceKm !== undefined ? `${h.distanceKm.toFixed(1)} km` : ""} ·{" "}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {h.availableEmergencyBeds ?? 0} {t("beds")}
                        </span>
                      </div>
                    </div>
                    {h.contactPhone && (
                      <a
                        href={`tel:${h.contactPhone}`}
                        className="shrink-0 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90"
                      >
                        {t("Call")}
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">
                  {t("No nearby hospitals within 50 km. Call 112 for state coordination.")}
                </p>
              )}
            </div>

            {/* Flood Conditions Panel */}
            <FloodConditionsPanel
              conditions={conditions.data}
              loading={conditions.isLoading}
              latitude={activeWeatherCoords?.latitude}
              longitude={activeWeatherCoords?.longitude}
              onRefresh={() => conditions.refetch()}
              onLocationChange={handleLocationChange}
              selectedLocationName={manualLocation?.name}
              isGpsActive={isGpsActive}
              onGpsLocate={handleGpsLocate}
            />
          </div>
        </details>

        <SahayakAiModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />

        {triageData && (
          <SosClassificationModal
            isOpen={Boolean(triageData)}
            publicCode={triageData.publicCode}
            incidentId={triageData.incidentId}
            triageDeadlineAt={triageData.triageDeadlineAt}
            onComplete={() => {
              redirectAfterRapidSos(triageData.publicCode, setLocation);
              setTriageData(null);
            }}
            onCancel={() => {
              setTriageData(null);
              setRapidStatus("idle");
              setRapidNotice(t("SOS cancelled. Emergency dispatch aborted."));
            }}
          />
        )}
      </main>
      <VictimNavigation current="home" />
    </div>
  );
}

export function RapidSosControl({
  authenticated,
  authLoading,
  status,
  notice,
  onActivate,
}: {
  authenticated: boolean;
  authLoading: boolean;
  status: "idle" | "locating" | "sending" | "queued" | "error";
  notice: string;
  onActivate: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="mt-6 flex flex-col items-center">
      <button
        onClick={onActivate}
        disabled={authLoading || status === "locating" || status === "sending"}
        aria-label={t("Send SOS")}
        className="sahay-sos-btn"
      >
        <span className="relative z-10 flex flex-col items-center justify-center">
          {status === "locating" || status === "sending" ? (
            <Radio className="mb-1.5 h-8 w-8 animate-pulse text-white" />
          ) : (
            <Siren className="mb-1 h-7 w-7 text-white" />
          )}
          <span className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">SOS</span>
          <span className="mt-1 text-[11px] font-bold text-white/95">
            {status === "locating"
              ? t("Getting location")
              : status === "sending"
              ? t("Sending SOS")
              : authenticated
              ? t("Tap for immediate help")
              : t("Sign in to activate")}
          </span>
        </span>
      </button>
      <p className="mt-4 flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
        <Waves className="h-3.5 w-3.5 text-rose-600" />
        {t("Use this only for an emergency")}
      </p>
      {notice && (
        <p
          role="status"
          className={`mt-2.5 max-w-xs text-center text-xs font-semibold leading-5 ${
            status === "error" ? "text-rose-600 dark:text-rose-400" : "text-sky-600 dark:text-sky-400"
          }`}
        >
          {notice}
        </p>
      )}
    </section>
  );
}

function LocationPreview({
  point,
  state,
  hospitals,
  shelters,
  onRecenter,
  recenterLoading,
}: {
  point: Point | null;
  state: "finding" | "ready" | "unavailable";
  hospitals?: MapHospital[];
  shelters?: MapShelter[];
  onRecenter?: () => void;
  recenterLoading?: boolean;
}) {
  const { t } = useLanguage();
  const center = point ? { lat: point.latitude, lng: point.longitude } : INDIA_CENTER;
  const zoom = point ? 14 : 5;
  const pointKey = point ? `${point.latitude.toFixed(4)}-${point.longitude.toFixed(4)}` : "india-overview";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 h-full flex flex-col justify-between overflow-hidden">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <MapView
          key={pointKey}
          className="h-52 w-full"
          initialCenter={center}
          initialZoom={zoom}
          showWeatherHeatmap={true}
          hospitals={hospitals}
          shelters={shelters}
          onRecenter={onRecenter}
          recenterLoading={recenterLoading}
          onLeafletReady={async (lMap) => {
            if (point) {
              const L = (await import("leaflet")).default;
              const icon = L.divIcon({
                className: "loc-pin",
                html: `<div style="background:#DC2626;color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:12px;">📍</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
              });
              L.marker([point.latitude, point.longitude], { icon, zIndexOffset: 1000 }).addTo(lMap);
            }
          }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 backdrop-blur-xs">
          {t("Map preview")}
        </div>
      </div>
      <div className="flex items-center justify-between px-1 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <MapPin className="h-4 w-4 text-rose-600" />
          {state === "ready"
            ? t("Your current location")
            : state === "finding"
            ? t("Acquiring GPS location…")
            : t("Location unavailable (Map centered on India)")}
        </span>
        <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
          {state === "ready" && point
            ? `${point.latitude.toFixed(4)}° N, ${point.longitude.toFixed(4)}° E`
            : "—"}
        </span>
      </div>
    </section>
  );
}

export { VictimNavigation } from "@/components/VictimNavigation";
