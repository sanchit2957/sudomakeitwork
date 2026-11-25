import { MapView, type MapHospital, type MapShelter } from "@/components/Map";
import LanguageSelector from "@/components/LanguageSelector";
import { FloodConditionsPanel } from "@/components/FloodConditionsPanel";
import { WeatherForecastPanel } from "@/components/WeatherForecastPanel";
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
import { startBleSosBeacon, stopBleSosBeacon, isBleSosBeaconActive, getOrCreateActiveBleBeaconId, clearActiveBleBeaconId, isValidBleCoordinate } from "@/lib/bleBeacon";
import { getCurrentCoordinates, getLastKnownCoordinates } from "@/lib/nativeLocation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { portalFetch } from "@/lib/portalAuth";
import { startLogin } from "@/const";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";
import { INDIA_CENTER } from "@shared/india-locations";
import { Bluetooth, CloudRain, Database, Hospital, MapPin, MessageSquare, MoreHorizontal, Navigation, PhoneCall, Radio, RefreshCw, ShieldCheck, Siren, TentTree, ThermometerSun, Waves, Wifi, WifiOff } from "lucide-react";
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
  const [triageData, setTriageData] = useState<{
    publicCode: string;
    incidentId?: number;
    triageDeadlineAt?: Date | string | null;
    isOffline?: boolean;
    bleBeaconId?: string;
    latitude?: number;
    longitude?: number;
    hasCoords?: boolean;
  } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bleActive, setBleActive] = useState(() => isBleSosBeaconActive());

  // Secondary defense: Route operational users reaching "/" to their canonical workspace
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.innerWidth >= 1024;
    const allowCitizen = sessionStorage.getItem("sahay_allow_citizen_home");
    // On mobile screens (<1024px), admin & hospital portals are desktop-only, so users remain on Citizen SOS Hub
    if (!isDesktop || allowCitizen) return;

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

  const [nearbyApiHospitals, setNearbyApiHospitals] = useState<MapHospital[] | null>(null);

  // Dynamically discover Tier-1 (Sahay Verified) + Tier-2 (Public Directory) hospitals around live GPS
  useEffect(() => {
    if (!position) return;
    let active = true;
    const loadNearby = async () => {
      try {
        const res = await fetch(
          `/api/hospitals/nearby?lat=${encodeURIComponent(position.latitude)}&lng=${encodeURIComponent(
            position.longitude
          )}&radiusKm=50`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data?.hospitals)) {
          setNearbyApiHospitals(data.hospitals);
        }
      } catch {
        // Ignore offline fallback
      }
    };
    void loadNearby();
    return () => {
      active = false;
    };
  }, [position?.latitude, position?.longitude]);

  // Filter nearby hospitals (within 50km of user position)
  const nearbyHospitals: MapHospital[] = useMemo(() => {
    if (nearbyApiHospitals) return nearbyApiHospitals;
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
  }, [nearbyApiHospitals, position, resourcesQuery.data?.hospitals]);

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

  const sendOfflineQueuedPayload = async (payload: any) => {
    if (user) {
      try {
        return await createSos.mutateAsync(payload);
      } catch (err: any) {
        if (err?.data?.code !== "UNAUTHORIZED") {
          throw err;
        }
      }
    }
    const response = await portalFetch(
      "/api/sos/offline",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "citizen"
    );
    if (!response.ok) {
      throw new Error(`Offline SOS sync failed (${response.status})`);
    }
    return (await response.json()) as { publicCode: string };
  };

  const triggerFlush = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await flushOfflineSos(payload => sendOfflineQueuedPayload(payload));
      refreshPending();
      if (result.delivered.length > 0) {
        clearSosVoiceNote();
        void stopBleSosBeacon({ clearId: true });
        setBleActive(false);
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
    if (!online) return;
    if (!user && pendingCount === 0) return;
    void triggerFlush();
  }, [online, user?.id, pendingCount]);

  const startRapidSos = () => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (online && !isOffline && authLoading) return;
    if (online && !isOffline && !user) { startLogin(); return; }

    const getOrCreateGuestKey = () => {
      try {
        const existing = localStorage.getItem("sudo-makeitwork-guest-key");
        if (existing) return existing;
        const created = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replaceAll("-", "")
          : `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("sudo-makeitwork-guest-key", created);
        return created;
      } catch {
        return `guest-${Date.now().toString(36)}`;
      }
    };

    const submitSosWithCoords = async (latitude: number | undefined, longitude: number | undefined, label: string) => {
      const hasCoords = latitude != null && longitude != null && isValidBleCoordinate(latitude, longitude);
      if (hasCoords) {
        setPosition({ latitude, longitude });
        setLocationStatus("ready");
      }
      const voiceNote = readSosVoiceNote();
      const payload = {
        contactName: user?.name || undefined,
        locationLabel: label,
        latitude: hasCoords ? latitude : 0,
        longitude: hasCoords ? longitude : 0,
        emergencyType: "flood" as const,
        severity: "high" as const,
        peopleAffected: 1,
        voiceNoteDataUrl: voiceNote?.dataUrl,
        voiceNoteDurationSeconds: voiceNote?.durationSeconds,
      };

      // Activate Bluetooth Low Energy Beacon for nearby rescue boats
      const bleBeaconId = getOrCreateActiveBleBeaconId();
      void startBleSosBeacon({
        id: bleBeaconId,
        latitude: hasCoords ? latitude : undefined,
        longitude: hasCoords ? longitude : undefined,
        emergencyType: "flood",
        peopleAffected: 1,
      }).then((res) => {
        if (res.success) {
          setBleActive(true);
        } else if (res.error) {
          setRapidNotice((prev) =>
            prev ? `${prev} (${res.error})` : `${t("SOS active")}: ${res.error}`
          );
        }
      });

      const sosPayloadWithBle = {
        ...payload,
        bleBeaconId,
      };

      const queueOfflineNow = async (noticeText: string) => {
        const guestKey = getOrCreateGuestKey();
        await queueOfflineSos({ ...sosPayloadWithBle, guestKey });
        refreshPending();
        setRapidStatus("queued");
        setRapidNotice(noticeText);
        setTriageData({
          publicCode: `BLE-${bleBeaconId}`,
          triageDeadlineAt: new Date(Date.now() + 10_000),
          isOffline: true,
          bleBeaconId,
          latitude: hasCoords ? latitude : undefined,
          longitude: hasCoords ? longitude : undefined,
          hasCoords,
        });
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineNow(
          t("SOS saved in device database (IndexedDB) & BLE Beacon active. Will auto-dispatch when network returns.")
        );
        return;
      }

      try {
        setRapidStatus("sending");
        const created = await createSos.mutateAsync(sosPayloadWithBle);
        rememberLatestSos(created.publicCode);
        clearSosVoiceNote();
        setRapidStatus("idle");
        setTriageData({
          publicCode: created.publicCode,
          incidentId: (created as any).incidentId,
          triageDeadlineAt: (created as any).triageDeadlineAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const isSafeInputMessage = /^(Voice notes|Evidence|Locations|Available beds)/.test(message);
        const isNetworkFail =
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          /fetch|network|load failed|networkerror|timeout|abort|econnrefused|enotfound|err_internet|unable to transform response|unexpected token|502|503|504/i.test(message) ||
          (!isSafeInputMessage && error instanceof TypeError);

        if (isNetworkFail) {
          await queueOfflineNow(
            t("Network dropped. SOS is safely preserved in device database (IndexedDB) and auto-syncing.")
          );
          return;
        }
        setRapidStatus("error");
        setRapidNotice(isSafeInputMessage ? t(message) : t("SOS could not be sent. Check connection and try again."));
      }
    };

    setRapidStatus("locating");
    setRapidNotice(t("Getting location to send SOS immediately…"));

    if (manualLocation) {
      void submitSosWithCoords(manualLocation.lat, manualLocation.lng, manualLocation.name);
    } else if (position) {
      void submitSosWithCoords(position.latitude, position.longitude, t("GPS location captured from this phone"));
    } else if (isOffline) {
      const lastKnown = getLastKnownCoordinates();
      if (lastKnown) {
        void submitSosWithCoords(lastKnown.latitude, lastKnown.longitude, t("Last known device location"));
      } else {
        void submitSosWithCoords(undefined, undefined, t("Location unavailable (No GPS fix on phone)"));
      }
    } else {
      void getCurrentCoordinates({ enableHighAccuracy: true, timeout: 6000 })
        .then((res) => {
          setPosition({ latitude: res.latitude, longitude: res.longitude });
          setLocationStatus("ready");
          submitSosWithCoords(res.latitude, res.longitude, t("GPS location captured from this phone"));
        })
        .catch(() => {
          const lastKnown = getLastKnownCoordinates();
          if (lastKnown) {
            submitSosWithCoords(lastKnown.latitude, lastKnown.longitude, t("Last known device location"));
          } else {
            submitSosWithCoords(undefined, undefined, t("Location unavailable (No GPS fix on phone)"));
          }
        });
    }
  };

  const activePoint = manualLocation ? { latitude: manualLocation.lat, longitude: manualLocation.lng } : position;
  const emergencySmsUrl = buildEmergencySmsUri({
    latitude: activePoint?.latitude ?? 0,
    longitude: activePoint?.longitude ?? 0,
    emergencyType: "flood",
    peopleAffected: 1,
    locationLabel: manualLocation?.name || (position ? t("GPS location captured from this phone") : t("Location unavailable (No GPS fix on phone)")),
  });

  return (
    <div className="victim-page relative min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC] overflow-x-hidden">
      {/* iOS Liquid Glass Ambient Refraction Layer */}
      <div className="liquid-ambient-bg" />

      <main className="victim-main relative z-10 mx-auto min-h-screen w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-12 pb-36 pt-6">
        {/* Glassmorphic Top Bar */}
        <header className="glass-card mb-6 flex items-center justify-between gap-3 p-4 shadow-sm">
          <UserProfileBadge
            user={user}
            size="lg"
            clickable
            onClick={() => setLocation(user ? "/profile" : "/login")}
            fallbackName={t("Citizen")}
            subtext={user ? (user.role ? t(user.role.toUpperCase()) : t("Verified User")) : t("Sign In / Register")}
          />
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <LanguageSelector compact />
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs ${online
                ? "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                }`}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? t("Connected") : t("Offline")}
            </span>
          </div>
        </header>

        {/* Offline SOS & Cellular Radio / BLE Options */}
        {(!online || pendingCount > 0 || bleActive) && (
          <div className="glass-card mb-6 border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-950 shadow-md dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
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
                  className="h-7 rounded-xl border-amber-600/40 bg-amber-600 px-2.5 text-xs font-bold text-white hover:bg-amber-700 active:scale-95"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? t("Syncing…") : t("Sync Now")}
                </Button>
              )}
            </div>

            {/* BLE Beacon Pulse Indicator */}
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-cyan-950/10 px-3 py-2 text-xs font-bold text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                </span>
                <Bluetooth className="h-3.5 w-3.5" />
                {t("Bluetooth BLE SOS Beacon: Broadcasting")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-80">{t("~50-100m range")}</span>
                <button
                  type="button"
                  onClick={() => {
                    void stopBleSosBeacon({ clearId: true });
                    setBleActive(false);
                  }}
                  className="rounded-lg bg-cyan-900/20 px-2 py-0.5 text-[10px] font-extrabold text-cyan-800 hover:bg-cyan-900/30 dark:bg-cyan-400/20 dark:text-cyan-200"
                >
                  {t("Stop Beacon")}
                </button>
              </div>
            </div>

            {/* 1-Tap Emergency Offline Actions: Bluetooth SOS, SMS 112, Call 112 */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={startRapidSos}
                disabled={rapidStatus === "locating" || rapidStatus === "sending"}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-center text-xs font-black text-white shadow-md shadow-cyan-600/25 transition hover:bg-cyan-700 active:scale-95 disabled:opacity-60"
              >
                <Bluetooth className="h-4 w-4" />
                <span>{bleActive ? t("Re-Send Bluetooth SOS") : t("Bluetooth SOS Beacon")}</span>
              </button>
              <a
                href={emergencySmsUrl}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-3 text-center text-xs font-black text-white shadow-md shadow-[#1D4ED8]/25 transition hover:bg-[#1a44d6] active:scale-95"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{t("SMS 112 (No Internet)")}</span>
              </a>
              <a
                href="tel:112"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-4 py-3 text-center text-xs font-black text-white shadow-md shadow-[#DC2626]/25 transition hover:bg-[#b91c1c] active:scale-95"
              >
                <PhoneCall className="h-4 w-4" />
                <span>{t("Call 112 (All Towers)")}</span>
              </a>
            </div>

            <p className="mt-2 text-xs leading-relaxed opacity-90 text-prose-justified">
              {t("911/112 cellular frequencies connect across all mobile towers even with zero data. Tap SMS 112 to transmit exact GPS coordinates directly to State Disaster Control.")}
            </p>
          </div>
        )}

        {/* Spacious, Sophisticated Responsive Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left Column: SOS Command Center & Disaster Safety Hub */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-5 2xl:col-span-4 flex flex-col gap-5">
            {/* Primary 3D Tactile SOS Action Card */}
            <section className="glass-panel relative flex flex-col items-center justify-center p-6 sm:p-7 pb-6 text-center shadow-lg">
              {/* Radial ambient glow behind button */}
              <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-red-500/15 blur-3xl" />

              <div className="relative my-2 py-2 flex items-center justify-center">
                <div className="liquid-bezel">
                  <button
                    onClick={startRapidSos}
                    disabled={(online && authLoading) || rapidStatus === "locating" || rapidStatus === "sending"}
                    aria-label={t("Send SOS")}
                    className="sahay-sos-btn"
                  >
                    <span className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
                      {rapidStatus === "locating" || rapidStatus === "sending" ? (
                        <Radio className="mb-1 h-9 w-9 sm:h-10 sm:w-10 animate-pulse text-white drop-shadow-md" />
                      ) : (
                        <Siren className="mb-1 h-9 w-9 sm:h-10 sm:w-10 text-white drop-shadow-md" />
                      )}
                      <span className="text-5xl sm:text-6xl font-black tracking-tight text-white drop-shadow-lg leading-none">
                        SOS
                      </span>
                      <span className="mt-1.5 max-w-[155px] text-[11px] sm:text-xs font-black tracking-wider text-white/95 uppercase drop-shadow leading-tight text-center">
                        {rapidStatus === "locating"
                          ? t("Getting location")
                          : rapidStatus === "sending"
                            ? t("Sending SOS")
                            : (user || !online)
                              ? t("Tap for immediate help")
                              : t("Sign in to activate")}
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-4 py-1.5 text-xs font-black text-red-700 dark:text-red-300">
                <Waves className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span>{t("Use this only for an emergency")}</span>
              </p>

              {rapidNotice && (
                <p
                  role="status"
                  className={`mt-2.5 max-w-sm text-center text-xs font-semibold leading-5 ${rapidStatus === "error" ? "text-red-600 dark:text-red-400" : "text-[#1D4ED8] dark:text-[#F1F5F9]"
                    }`}
                >
                  {rapidNotice}
                </p>
              )}

              {/* Direct Emergency Access Buttons */}
              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <a
                  href={emergencySmsUrl}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#1D4ED8] px-4 py-3.5 text-center text-xs sm:text-sm font-black text-white shadow-md shadow-[#1D4ED8]/25 transition hover:bg-[#1a44d6] active:scale-95"
                >
                  <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                  <span>{t("SMS 112")}</span>
                </a>
                <a
                  href="tel:112"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#DC2626] px-4 py-3.5 text-center text-xs sm:text-sm font-black text-white shadow-md shadow-[#DC2626]/25 transition hover:bg-[#b91c1c] active:scale-95"
                >
                  <PhoneCall className="h-4.5 w-4.5 shrink-0" />
                  <span>{t("Call 112")}</span>
                </a>
                <button
                  type="button"
                  onClick={startRapidSos}
                  disabled={(online && authLoading) || rapidStatus === "locating" || rapidStatus === "sending"}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-600 px-4 py-3 text-center text-xs sm:text-sm font-black text-white shadow-md shadow-cyan-600/25 transition hover:bg-cyan-700 active:scale-95 disabled:opacity-60"
                >
                  <Bluetooth className="h-4.5 w-4.5 shrink-0" />
                  <span>
                    {bleActive
                      ? t("Bluetooth BLE Beacon Active (Tap to Update SOS)")
                      : t("Send SOS via Bluetooth Beacon")}
                  </span>
                </button>
              </div>
            </section>

            {/* Quick Voice Note & AI Sahayak Card */}
            <QuickActionsPanel onOpenAi={() => setIsAiModalOpen(true)} />

            {/* Direct 24x7 Helplines Dock */}
            <section className="glass-panel p-4 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#0F172A]/75 dark:text-[#F1F5F9]/80 mb-2.5 flex items-center gap-2">
                <PhoneCall className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                <span>{t("Direct Emergency Lines")}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { number: "112", label: t("National 112"), icon: Siren, color: "text-[#DC2626] bg-red-500/10 border-red-500/20" },
                  { number: "108", label: t("Ambulance"), icon: Hospital, color: "text-[#1D4ED8] bg-[#1D4ED8]/10 border-[#1D4ED8]/20" },
                  { number: "101", label: t("Fire/Flood"), icon: Waves, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
                  { number: "1079", label: t("Disaster"), icon: ShieldCheck, color: "text-[#0F172A] dark:text-[#F1F5F9] bg-black/5 dark:bg-white/10 border-[#E2E8F0]/20" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.number}
                      href={`tel:${item.number}`}
                      className="glass-card flex items-center gap-2.5 p-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-2xs"
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${item.color}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="block font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{item.number}</span>
                        <span className="block text-[10px] font-bold text-[#0F172A]/70 dark:text-[#F1F5F9]/75 truncate">{item.label}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>

            {/* Dedicated Hourly & 7-Day Weather Forecast Telemetry */}
            <WeatherForecastPanel
              conditions={conditions.data}
              loading={conditions.isLoading}
              latitude={activeWeatherCoords?.latitude}
              longitude={activeWeatherCoords?.longitude}
            />
          </div>

          {/* Right Column (Expanded on Desktop): Map, Facilities & Live Flood Telemetry */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-7 2xl:col-span-8 flex flex-col gap-6">
            {/* Expanded Interactive Tactical Map */}
            <LocationPreview
              point={position}
              state={locationStatus}
              hospitals={nearbyHospitals}
              shelters={nearbyShelters}
              onRecenter={handleGpsLocate}
              recenterLoading={isLocating}
            />

            {/* Nearby Emergency Facilities & Hospitals */}
            <section className="glass-panel p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setLocation("/safety")}
                  className="flex items-center gap-2.5 text-left text-sm font-black text-[#0F172A] hover:text-[#2457FF] dark:text-[#F8FAFC] dark:hover:text-[#93C5FD] transition"
                >
                  <Hospital className="h-4.5 w-4.5 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                  <span>{t("Nearby Emergency Facilities")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocation("/safety")}
                  className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-black text-emerald-800 hover:bg-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                >
                  {nearbyHospitals.length + nearbyShelters.length} {t("within 50 km")}
                </button>
              </div>

              {nearbyHospitals.length > 0 || nearbyShelters.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {nearbyHospitals.slice(0, 4).map((h: any) => (
                    <div
                      key={`hosp-${h.id}`}
                      onClick={() => setLocation("/safety")}
                      className="glass-card flex cursor-pointer items-center justify-between p-3 text-xs shadow-xs transition hover:border-[#2457FF]/40"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-extrabold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                          {h.organizationName || h.name}
                        </div>
                        <div className="text-[10px] text-[#0F172A]/70 dark:text-[#F1F5F9]/70 mt-0.5">
                          {h.distanceKm !== undefined ? `${Number(h.distanceKm).toFixed(1)} km away` : ""} ·{" "}
                          {h.source === "PUBLIC_DIRECTORY" ? (
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {t("Public Directory")}
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {h.availableEmergencyBeds ?? 0} {t("beds available")}
                            </span>
                          )}
                        </div>
                      </div>
                      {h.contactPhone && (
                        <a
                          href={`tel:${h.contactPhone}`}
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#1d47db] active:scale-95"
                        >
                          {t("Call")}
                        </a>
                      )}
                    </div>
                  ))}
                  {nearbyShelters.slice(0, 2).map((s) => (
                    <div
                      key={`sh-${s.id}`}
                      className="glass-card flex items-center justify-between p-3 text-xs shadow-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-extrabold text-[#0F172A] dark:text-[#F8FAFC] truncate">{s.name}</div>
                        <div className="text-[10px] text-[#0F172A]/70 dark:text-[#F1F5F9]/70 mt-0.5">
                          {s.distanceKm !== undefined ? `${s.distanceKm.toFixed(1)} km away` : ""} · {t("Capacity")}: {s.capacity ?? "—"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-[#F1F5F9] px-2 py-1 text-[10px] font-black text-[#0F172A] dark:bg-[#1D4ED8]/30 dark:text-[#F1F5F9]">
                        {t("Relief Camp")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                  {position
                    ? t("No verified hospitals or camps registered within 50 km. Call 112 for state emergency coordination.")
                    : t("Acquiring GPS to locate nearest emergency hospitals and relief camps…")}
                </p>
              )}
            </section>

            {/* Live Weather & Flood Conditions Telemetry */}
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
              hideForecast={true}
            />
          </div>
        </div>
      </main>

      {/* Global Modals Rendered Outside <main> to Prevent Stacking Context Traps */}
      <SahayakAiModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />

      {triageData && (
        <SosClassificationModal
          isOpen={Boolean(triageData)}
          publicCode={triageData.publicCode}
          incidentId={triageData.incidentId}
          triageDeadlineAt={triageData.triageDeadlineAt}
          offlineMode={triageData.isOffline}
          onOfflineCategoryChange={(category) => {
            if (!triageData.bleBeaconId) return;
            const emergencyType = category === "medical" ? "medical" : category === "rescue" ? "trapped" : "flood";
            void startBleSosBeacon({
              id: triageData.bleBeaconId,
              latitude: triageData.hasCoords ? triageData.latitude : undefined,
              longitude: triageData.hasCoords ? triageData.longitude : undefined,
              emergencyType,
              priority: category === "medical" || category === "rescue" ? "critical" : "high",
              peopleAffected: 1,
            });
          }}
          onOfflineDetailsSave={(details) => {
            if (!triageData.bleBeaconId) return;
            void startBleSosBeacon({
              id: triageData.bleBeaconId,
              latitude: triageData.hasCoords ? triageData.latitude : undefined,
              longitude: triageData.hasCoords ? triageData.longitude : undefined,
              emergencyType: details.emergencyType,
              priority: "critical",
              peopleAffected: details.peopleAffected,
            });
            setRapidNotice(
              t(`Bluetooth BLE Beacon (${triageData.bleBeaconId}) broadcasting ${details.category.toUpperCase()} SOS for ${details.peopleAffected} person(s). Saved offline for auto-sync.`)
            );
          }}
          onComplete={(category) => {
            if (triageData.isOffline) {
              setRapidNotice(
                t(`Bluetooth BLE Beacon (${triageData.bleBeaconId}) active (${category.toUpperCase()} SOS). Saved in device outbox for auto-sync.`)
              );
              setTriageData(null);
              return;
            }
            redirectAfterRapidSos(triageData.publicCode, setLocation);
            setTriageData(null);
          }}
          onCancel={() => {
            if (triageData.isOffline) {
              void stopBleSosBeacon({ clearId: true });
              setBleActive(false);
            }
            setTriageData(null);
            setRapidStatus("idle");
            setRapidNotice(t("SOS cancelled. Emergency dispatch aborted."));
          }}
        />
      )}

      {/* Victim Bottom Navigation: Automatically Hidden When Any Modal is Open */}
      <VictimNavigation hide={isAiModalOpen || Boolean(triageData)} current="home" />
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
        <span className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
          {status === "locating" || status === "sending" ? (
            <Radio className="mb-1 h-9 w-9 sm:h-10 sm:w-10 animate-pulse text-white drop-shadow-md" />
          ) : (
            <Siren className="mb-0.5 h-9 w-9 sm:h-10 sm:w-10 text-white drop-shadow-md" />
          )}
          <span className="text-5xl sm:text-6xl font-black tracking-tight text-white drop-shadow-lg leading-none">SOS</span>
          <span className="mt-1.5 max-w-[155px] text-[11px] sm:text-xs font-black tracking-wider uppercase text-white/95 drop-shadow leading-tight text-center">
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
      <p className="mt-5 flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3.5 py-1.5 text-[11px] font-bold text-red-700 dark:text-red-300">
        <Waves className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        {t("Use this only for an emergency")}
      </p>
      {notice && (
        <p
          role="status"
          className={`mt-3 max-w-xs text-center text-xs font-semibold leading-5 ${status === "error" ? "text-red-600 dark:text-red-400" : "text-[#1D4ED8] dark:text-[#F1F5F9]"
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
    <section className="glass-panel overflow-hidden p-3.5 h-full flex flex-col justify-between">
      <div className="relative overflow-hidden rounded-2xl">
        <MapView
          key={pointKey}
          className="h-64 sm:h-72 lg:h-[340px] xl:h-[380px] w-full"
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
                html: `<div style="background:#DC2626;color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:12px;">📍</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
              });
              L.marker([point.latitude, point.longitude], { icon, zIndexOffset: 1000 }).addTo(lMap);
            }
          }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg glass-pill px-2.5 py-1 text-xs font-black shadow-sm text-[#0F172A] dark:text-[#F8FAFC]">
          {t("Map preview")}
        </div>
      </div>
      <div className="flex items-center justify-between px-1 pt-3">
        <span className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          <MapPin className="h-4 w-4 text-[#DC2626]" />
          {state === "ready"
            ? t("Your current location")
            : state === "finding"
              ? t("Finding your location…")
              : t("Location unavailable (Map centered on India)")}
        </span>
        <span className="font-mono text-[10px] font-bold text-[#1D4ED8] dark:text-[#F1F5F9]">
          {state === "ready" && point
            ? `${point.latitude.toFixed(4)}° N, ${point.longitude.toFixed(4)}° E`
            : "—"}
        </span>
      </div>
    </section>
  );
}

export { VictimNavigation } from "@/components/VictimNavigation";
