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
import { Bluetooth, CloudRain, Database, Hospital, MapPin, MessageSquare, MoreHorizontal, Navigation, PhoneCall, Radio, RefreshCw, ShieldCheck, Siren, TentTree, ThermometerSun, Waves, Wifi, WifiOff } from "lucide-react";
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

  // Secondary defense: Route operational users reaching "/" to their canonical workspace
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

  const utils = trpc.useUtils();
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
      const result = await flushOfflineSos(payload => createSos.mutateAsync(payload));
      refreshPending();
      if (result.delivered.length > 0) {
        void utils.rescue.emergency.heatmap.invalidate();
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
    if (!user) { startLogin(); return; }

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
        void utils.rescue.emergency.heatmap.invalidate();
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
    <div className="victim-page min-h-screen bg-[#f6f8f7] text-[#142c2b] dark:bg-[#050505] dark:text-[#f4f4f5]">
      <main className="victim-main relative mx-auto min-h-screen max-w-lg overflow-hidden bg-[#fcfdfd] px-5 pb-28 pt-6 shadow-2xl shadow-[#113c35]/10 dark:bg-[#101011] dark:shadow-black/30 md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border">
        <header className="flex items-center justify-between gap-3">
          <UserProfileBadge
            user={user}
            size="lg"
            clickable
            onClick={() => setLocation(user ? "/profile" : "/login")}
            fallbackName={t("Citizen")}
            subtext={user ? (user.role ? t(user.role.toUpperCase()) : t("Verified User")) : t("Assam safety companion")}
          />
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <LanguageSelector compact />
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                online
                  ? "bg-[#dff6e7] text-[#197654] dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-[#fff1dd] text-[#9b6519] dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? t("Connected") : t("Offline")}
            </span>
          </div>
        </header>

        {/* Offline SOS & Cellular Radio / BLE Options */}
        {(!online || pendingCount > 0 || bleActive) && (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-md dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-black">
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
                  className="h-7 rounded-xl border-amber-600/40 bg-amber-600 px-2.5 text-[11px] font-bold text-white hover:bg-amber-700 active:scale-95"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? t("Syncing…") : t("Sync Now")}
                </Button>
              )}
            </div>

            {/* BLE Beacon Pulse Indicator */}
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-cyan-950/10 px-3 py-2 text-[11px] font-bold text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                </span>
                <Bluetooth className="h-3.5 w-3.5" />
                {t("Bluetooth BLE SOS Beacon: Broadcasting")}
              </span>
              <span className="text-[10px] opacity-80">{t("~50-100m range")}</span>
            </div>

            {/* 1-Tap Emergency SMS */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={emergencySmsUrl}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2.5 text-center text-xs font-black text-white shadow-sm transition hover:bg-amber-700 active:scale-95"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{t("SMS 112 (No Internet)")}</span>
              </a>
              <a
                href="tel:112"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-600/30 bg-rose-600 px-3 py-2.5 text-center text-xs font-black text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>{t("Call 112 (All Towers)")}</span>
              </a>
            </div>

            <p className="mt-2 text-[10px] leading-4 opacity-85">
              {t("911/112 cellular frequencies connect across all mobile towers even with zero data. Tap SMS 112 to transmit exact GPS coordinates directly to State Disaster Control.")}
            </p>
          </div>
        )}

        <section className="mt-6 flex flex-col items-center">
          <button
            onClick={startRapidSos}
            disabled={authLoading || rapidStatus === "locating" || rapidStatus === "sending"}
            aria-label={t("Send SOS")}
            className="group isolate grid h-44 w-44 shrink-0 aspect-square place-items-center overflow-hidden rounded-[9999px] border border-white/55 bg-[linear-gradient(145deg,rgba(255,109,118,.91),rgba(209,47,55,.84)_55%,rgba(174,27,36,.9))] text-white ring-1 ring-[#ca3540]/25 backdrop-blur-md transition active:scale-[.975] disabled:cursor-wait disabled:opacity-80"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-3 h-16 rounded-full bg-white/25 blur-md" />
            <span className="relative z-10 grid place-items-center">
              {rapidStatus === "locating" || rapidStatus === "sending" ? (
                <Radio className="mb-2 h-8 w-8 animate-pulse" />
              ) : (
                <Siren className="mb-1 h-7 w-7" />
              )}
              <span className="text-5xl font-black tracking-[-0.08em]">SOS</span>
              <span className="mt-1 text-xs font-bold">
                {rapidStatus === "locating"
                  ? t("Getting location")
                  : rapidStatus === "sending"
                  ? t("Sending SOS")
                  : user
                  ? t("Tap for immediate help")
                  : t("Sign in to activate")}
              </span>
            </span>
          </button>
          <p className="mt-6 flex items-center gap-2 rounded-full bg-[#fff3ef] px-3 py-1.5 text-[11px] font-bold text-[#a43d3e]">
            <Waves className="h-3.5 w-3.5" />
            {t("Use this only for an emergency")}
          </p>
          {rapidNotice && (
            <p
              role="status"
              className={`mt-3 max-w-xs text-center text-xs font-semibold leading-5 ${
                rapidStatus === "error" ? "text-[#b73f43]" : "text-[#38675d]"
              }`}
            >
              {rapidNotice}
            </p>
          )}
        </section>

        <QuickActionsPanel onOpenAi={() => setIsAiModalOpen(true)} />

        <LocationPreview
          point={position}
          state={locationStatus}
          hospitals={nearbyHospitals}
          shelters={nearbyShelters}
          onRecenter={handleGpsLocate}
          recenterLoading={isLocating}
        />

        {/* Nearby Hospitals and Relief Support (Geographically Bounded) */}
        <section className="mt-4 rounded-[1.55rem] bg-white p-4 shadow-[0_12px_28px_rgba(22,60,53,.07)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-[#142c2b] dark:text-[#f4f4f5]">
              <Hospital className="h-4 w-4 text-[#166534] dark:text-emerald-400" />
              <span>{t("Nearby Emergency Facilities")}</span>
            </h3>
            <span className="rounded-full bg-[#e6f6ef] px-2 py-0.5 text-[10px] font-black text-[#166534] dark:bg-emerald-950/60 dark:text-emerald-300">
              {nearbyHospitals.length + nearbyShelters.length} {t("within 50 km")}
            </span>
          </div>

          {nearbyHospitals.length > 0 || nearbyShelters.length > 0 ? (
            <div className="mt-3 space-y-2">
              {nearbyHospitals.slice(0, 3).map((h) => (
                <div
                  key={`hosp-${h.id}`}
                  className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-50/40 p-2.5 text-xs dark:border-emerald-500/20 dark:bg-emerald-950/20"
                >
                  <div>
                    <div className="font-bold text-emerald-950 dark:text-emerald-200">{h.name}</div>
                    <div className="text-[10px] text-emerald-800/80 dark:text-emerald-400">
                      {h.distanceKm !== undefined ? `${h.distanceKm.toFixed(1)} km away` : ""} · {h.availableEmergencyBeds ?? 0} {t("beds available")}
                    </div>
                  </div>
                  {h.contactPhone && (
                    <a
                      href={`tel:${h.contactPhone}`}
                      className="rounded-lg bg-[#166534] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm active:scale-95"
                    >
                      {t("Call")}
                    </a>
                  )}
                </div>
              ))}
              {nearbyShelters.slice(0, 2).map((s) => (
                <div
                  key={`sh-${s.id}`}
                  className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-50/40 p-2.5 text-xs dark:border-blue-500/20 dark:bg-blue-950/20"
                >
                  <div>
                    <div className="font-bold text-blue-950 dark:text-blue-200">{s.name}</div>
                    <div className="text-[10px] text-blue-800/80 dark:text-blue-400">
                      {s.distanceKm !== undefined ? `${s.distanceKm.toFixed(1)} km away` : ""} · {t("Capacity")}: {s.capacity ?? "—"}
                    </div>
                  </div>
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    {t("Relief Camp")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#6e8981] dark:text-[#a0a0a8]">
              {position
                ? t("No verified hospitals or camps registered within 50 km. Call 112 for state emergency coordination.")
                : t("Acquiring GPS to locate nearest emergency hospitals and relief camps…")}
            </p>
          )}
        </section>

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

export function RapidSosControl({ authenticated, authLoading, status, notice, onActivate }: { authenticated: boolean; authLoading: boolean; status: "idle" | "locating" | "sending" | "queued" | "error"; notice: string; onActivate: () => void }) {
  const { t } = useLanguage();
  return <section className="mt-6 flex flex-col items-center"><button onClick={onActivate} disabled={authLoading || status === "locating" || status === "sending"} aria-label={t("Send SOS")} className="group isolate grid h-44 w-44 shrink-0 aspect-square place-items-center overflow-hidden rounded-[9999px] border border-white/55 bg-[linear-gradient(145deg,rgba(255,109,118,.91),rgba(209,47,55,.84)_55%,rgba(174,27,36,.9))] text-white ring-1 ring-[#ca3540]/25 backdrop-blur-md transition active:scale-[.975] disabled:cursor-wait disabled:opacity-80"><span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-3 h-16 rounded-full bg-white/25 blur-md" /><span className="relative z-10 grid place-items-center">{status === "locating" || status === "sending" ? <Radio className="mb-2 h-8 w-8 animate-pulse" /> : <Siren className="mb-1 h-7 w-7" />}<span className="text-5xl font-black tracking-[-0.08em]">SOS</span><span className="mt-1 text-xs font-bold">{status === "locating" ? t("Getting location") : status === "sending" ? t("Sending SOS") : authenticated ? t("Tap for immediate help") : t("Sign in to activate")}</span></span></button><p className="mt-6 flex items-center gap-2 rounded-full bg-[#fff3ef] px-3 py-1.5 text-[11px] font-bold text-[#a43d3e]"><Waves className="h-3.5 w-3.5" />{t("Use this only for an emergency")}</p>{notice && <p role="status" className={`mt-3 max-w-xs text-center text-xs font-semibold leading-5 ${status === "error" ? "text-[#b73f43]" : "text-[#38675d]"}`}>{notice}</p>}</section>;
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
    <section className="mt-3.5 overflow-hidden rounded-[1.55rem] bg-white p-3 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10">
      <div className="relative overflow-hidden rounded-[1.15rem]">
        <MapView
          key={pointKey}
          className="h-48"
          initialCenter={center}
          initialZoom={zoom}
          showWeatherHeatmap={true}
          showSosHeatmap={true}
          hospitals={hospitals}
          shelters={shelters}
          onRecenter={onRecenter}
          recenterLoading={recenterLoading}
          onLeafletReady={async (lMap) => {
            if (point) {
              const L = (await import("leaflet")).default;
              const icon = L.divIcon({
                className: "loc-pin",
                html: `<div style="background:#df3e43;color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:12px;">📍</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
              });
              L.marker([point.latitude, point.longitude], { icon, zIndexOffset: 1000 }).addTo(lMap);
            }
          }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-extrabold shadow-sm dark:bg-[#1a1a1c]/95">
          {t("Map preview")}
        </div>
      </div>
      <div className="flex items-center justify-between px-1 pt-3">
        <span className="flex items-center gap-2 text-xs font-bold text-[#2d514a] dark:text-[#ededf0]">
          <MapPin className="h-4 w-4 text-[#df3e43]" />
          {state === "ready"
            ? t("Your current location")
            : state === "finding"
            ? t("Finding your location…")
            : t("Location unavailable (Map centered on India)")}
        </span>
        <span className="font-mono text-[10px] font-bold text-[#6a867e] dark:text-[#b9b9c0]">
          {state === "ready" && point
            ? `${point.latitude.toFixed(4)}° N, ${point.longitude.toFixed(4)}° E`
            : "—"}
        </span>
      </div>
    </section>
  );
}

function FloodConditions({ conditions, loading }: { conditions?: { available: boolean; risk: string; activeFloodZones: number; current: { temperatureC: number | null; precipitationMm: number | null; windKmh: number | null }; forecast: { rainChance: number | null; rainAmountMm: number | null } }; loading: boolean }) {
  const { t } = useLanguage();
  const riskInfo = getWeatherRiskPresentation(conditions?.risk);
  return (
    <section className="mt-5 rounded-[1.55rem] bg-white p-5 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-[-0.04em]">{t("Local flood conditions")}</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#789087]">
            {loading ? t("Updating local forecast") : conditions?.available ? t("Weather model based") : t("Weather source unavailable")}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${riskInfo.badgeTone}`}>
          {t(riskInfo.badgeLabelKey)}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat
          icon={CloudRain}
          label={t("Rain forecast")}
          value={conditions?.forecast.rainChance !== null && conditions?.forecast.rainChance !== undefined ? `${conditions.forecast.rainChance}%` : "—"}
          detail={conditions?.forecast.rainAmountMm !== null && conditions?.forecast.rainAmountMm !== undefined ? `${conditions.forecast.rainAmountMm} mm` : t("No reading")}
        />
        <Stat
          icon={ThermometerSun}
          label={t("Weather now")}
          value={conditions?.current.temperatureC !== null && conditions?.current.temperatureC !== undefined ? `${Math.round(conditions.current.temperatureC)}°` : "—"}
          detail={conditions?.current.windKmh !== null && conditions?.current.windKmh !== undefined ? `${Math.round(conditions.current.windKmh)} ${t("km/h wind")}` : t("No reading")}
        />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f1f8f5] px-3 py-3 text-xs font-bold text-[#315e52]">
        <Waves className="h-5 w-5 shrink-0 text-[#277b6b]" />
        <span>{conditions?.activeFloodZones ? `${conditions.activeFloodZones} ${t("active flood-zone alerts nearby")}` : t("No nearby official flood alerts detected")}</span>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof CloudRain; label: string; value: string; detail: string }) { return <div className="rounded-2xl bg-[#f7faf9] p-3"><Icon className="h-5 w-5 text-[#277b6b]" /><p className="mt-3 text-[11px] font-bold text-[#6f8880]">{label}</p><p className="mt-0.5 text-xl font-black tracking-[-0.04em]">{value}</p><p className="mt-0.5 text-[10px] font-semibold text-[#719087]">{detail}</p></div>; }

export function VictimNavigation({ current }: { current: "home" | "track" | "safety" | "more" }) { const [, setLocation] = useLocation(); const { t } = useLanguage(); const items = [{ id: "home" as const, icon: Siren, label: t("SOS"), path: "/" }, { id: "track" as const, icon: Navigation, label: t("Track"), path: "/track" }, { id: "safety" as const, icon: ShieldCheck, label: t("Safety"), path: "/safety" }, { id: "more" as const, icon: MoreHorizontal, label: t("More"), path: "/more" }]; return <nav aria-label="Victim App navigation" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg justify-around border-t border-[#e7edeb] bg-white/95 px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:bottom-6 md:rounded-[1.6rem] md:border md:shadow-xl">{items.map(({ id, icon: Icon, label, path }) => <button key={id} onClick={() => setLocation(path)} className={`grid min-w-16 place-items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-extrabold ${current === id ? "text-[#df3e43]" : "text-[#7b8f88]"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${current === id ? "bg-[#fff0ef]" : ""}`}><Icon className="h-5 w-5" /></span>{label}</button>)}</nav>; }
