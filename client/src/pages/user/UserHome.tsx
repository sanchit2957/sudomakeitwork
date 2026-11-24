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
    <div className="victim-page relative min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 sm:px-6 lg:px-8 pb-28 pt-4">
        {/* Top Header Card */}
        <header className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <UserProfileBadge
            user={user}
            size="lg"
            clickable
            onClick={() => setLocation(user ? "/profile" : "/login")}
            fallbackName={t("Citizen")}
            subtext={user ? (user.role ? t(user.role.toUpperCase()) : t("Verified Citizen")) : t("Emergency Response Active")}
          />
          <div className="flex flex-col items-end gap-1.5">
            <LanguageSelector compact />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                online
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? t("Connected") : t("Offline Mode")}
            </span>
          </div>
        </header>

        {/* Offline SOS & Cellular Radio / BLE Options */}
        {(!online || pendingCount > 0 || bleActive) && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-50/70 p-4 text-xs text-amber-950 shadow-xs dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
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
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-cyan-950/10 px-3 py-2 text-[11px] font-bold text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
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
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-center text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-95"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{t("SMS 112 (No Internet)")}</span>
              </a>
              <a
                href="tel:112"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-center text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-95"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>{t("Call 112 (All Towers)")}</span>
              </a>
            </div>
          </div>
        )}

        {/* Citizen Emergency Section (Direction 3: Human-Centric Emergency Service) */}
        <div className="space-y-4">
          {/* Main Distress Trigger Block */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="mb-4 text-center sm:text-left">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("National Emergency Dispatch")}
              </span>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {t("Need Emergency Assistance?")}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("Press the button below to immediately broadcast your verified location to the nearest disaster rescue teams.")}
              </p>
            </div>

            {/* Functional Flat Emergency Trigger (Zero 3D shine, Zero ripples) */}
            <div className="my-3 flex justify-center">
              <button
                onClick={startRapidSos}
                disabled={authLoading || rapidStatus === "locating" || rapidStatus === "sending"}
                aria-label={t("Send SOS")}
                className="sahay-sos-btn w-full"
              >
                <div className="flex items-center justify-center gap-3">
                  {rapidStatus === "locating" || rapidStatus === "sending" ? (
                    <Radio className="h-6 w-6 animate-pulse text-white" />
                  ) : (
                    <Siren className="h-6 w-6 text-white" />
                  )}
                  <div className="text-left">
                    <span className="block text-xl sm:text-2xl font-black uppercase tracking-wide">
                      {rapidStatus === "locating"
                        ? t("Acquiring GPS…")
                        : rapidStatus === "sending"
                        ? t("Broadcasting SOS…")
                        : t("Request Emergency Rescue")}
                    </span>
                    <span className="block text-[11px] font-normal text-white/90">
                      {user ? t("Tap once to alert emergency forces") : t("Sign in to activate SOS")}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {rapidNotice && (
              <div
                role="status"
                className={`mt-3 rounded-lg border p-3 text-center text-xs font-semibold leading-relaxed ${
                  rapidStatus === "error"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                }`}
              >
                {rapidNotice}
              </div>
            )}

            {/* Direct 1-Tap Offline Emergency Call & SMS */}
            <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="tel:112"
                className="flex items-center justify-center gap-2 rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-4 py-2.5 text-center text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
              >
                <PhoneCall className="h-4 w-4" />
                <span>{t("Call 112 (National Emergency)")}</span>
              </a>
              <a
                href={emergencySmsUrl}
                className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/60 px-4 py-2.5 text-center text-xs font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>{t("SMS 112 with GPS Location")}</span>
              </a>
            </div>
          </section>

          {/* Grid Layout for Telemetry & Nearby Resources */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Map Preview with Live Telemetry */}
            <div className="lg:col-span-7">
              <LocationPreview
                point={position}
                state={locationStatus}
                hospitals={nearbyHospitals}
                shelters={nearbyShelters}
                onRecenter={handleGpsLocate}
                recenterLoading={isLocating}
              />
            </div>

            {/* Quick Actions & AI Sahayak */}
            <div className="lg:col-span-5 space-y-4">
              <QuickActionsPanel onOpenAi={() => setIsAiModalOpen(true)} />

              {/* Nearby Emergency Facilities & Hospitals */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <Hospital className="h-4 w-4 text-muted-foreground" />
                    <span>{t("Nearby Emergency Facilities")}</span>
                  </h2>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {nearbyHospitals.length + nearbyShelters.length} {t("within 50 km")}
                  </span>
                </div>

                {nearbyHospitals.length > 0 || nearbyShelters.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {nearbyHospitals.slice(0, 3).map((h) => (
                      <div
                        key={`hosp-${h.id}`}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-foreground truncate">{h.name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {h.distanceKm !== undefined ? `${h.distanceKm.toFixed(1)} km` : ""} ·{" "}
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {h.availableEmergencyBeds ?? 0} {t("beds open")}
                            </span>
                          </div>
                        </div>
                        {h.contactPhone && (
                          <a
                            href={`tel:${h.contactPhone}`}
                            className="shrink-0 rounded-md bg-neutral-900 dark:bg-white dark:text-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
                          >
                            {t("Call")}
                          </a>
                        )}
                      </div>
                    ))}
                    {nearbyShelters.slice(0, 2).map((s) => (
                      <div
                        key={`sh-${s.id}`}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-foreground truncate">{s.name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {s.distanceKm !== undefined ? `${s.distanceKm.toFixed(1)} km` : ""} · {t("Capacity")}: {s.capacity ?? "—"}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t("Relief Camp")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {position
                      ? t("No verified facilities registered within 50 km. Call 112 for state coordination.")
                      : t("Acquiring GPS to locate nearest emergency hospitals and relief camps…")}
                  </p>
                )}
              </section>
            </div>
          </div>

          {/* Live Weather & Environmental Advisories */}
          <div>
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
        </div>

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
