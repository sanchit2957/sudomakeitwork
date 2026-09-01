import { RoleGate } from "@/components/RoleGate";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import LanguageSelector from "@/components/LanguageSelector";
import OperationsMap from "@/components/OperationsMap";
import { BleEmergencyRadar } from "@/components/BleEmergencyRadar";
import { EmergencyOfferCard } from "@/components/EmergencyOfferCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Capacitor } from "@capacitor/core";
import { showNotification, requestNotificationPermission, playEmergencyAudioAlert } from "@/lib/nativeNotifications";
import { reconcileAvailability, reconcileMissionStatus } from "@/lib/operationalSync";
import {
  Activity,
  Ambulance,
  Bed,
  Bell,
  Camera,
  CheckCircle2,
  ClipboardList,
  ClipboardPenLine,
  Droplets,
  Hospital,
  LocateFixed,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  Radio,
  Send,
  UserRoundCheck,
  Wind,
} from "lucide-react";
import { UserProfileBadge } from "@/components/ProfileAvatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type PushState = "not_requested" | "permission_granted" | "subscribed" | "unsupported" | "failed";

export default function Responder() {
  const { user, loading } = useAuth();
  if (!loading && user?.role === "user") return <RescuerRegistration />;
  return <RoleGate roles={["rescuer"]}><ResponderWorkspace /></RoleGate>;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatRelativeTime(date: Date | string): string {
  const time = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diffMs = Date.now() - time;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return "1d ago";
}

function ResponderWorkspace() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { t } = useLanguage();
  const nav: WorkspaceNavItem[] = [
    { label: t("responder.missions"), path: "/responder", icon: ClipboardList },
    { label: t("responder.map"), path: "/responder/map", icon: MapPinned },
    { label: t("responder.hospitals") || "Hospitals", path: "/responder/hospitals", icon: Hospital },
    { label: t("responder.alerts"), path: "/responder/alerts", icon: Bell },
  ];
  const utils = trpc.useUtils();
  const [pushState, setPushState] = useState<PushState>("not_requested");
  const [pushDetail, setPushDetail] = useState("");
  const liveMissionQuery = { refetchInterval: 4_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, refetchOnReconnect: true } as const;
  // activeOffer MUST poll at 1s: 30-second emergency window requires near-instant detection
  const liveOfferQuery = { refetchInterval: 1_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, refetchOnReconnect: true, staleTime: 0 } as const;
  const liveLayersQuery = { refetchInterval: 10_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const liveProfileQuery = { refetchInterval: 15_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const profile = trpc.rescue.rescuer.profile.useQuery(undefined, liveProfileQuery);
  const activeOffer = trpc.rescue.rescuer.activeOffer.useQuery(undefined, liveOfferQuery);
  const missions = trpc.rescue.rescuer.missions.useQuery(undefined, liveMissionQuery);
  const alerts = trpc.rescue.rescuer.notifications.useQuery(undefined, liveMissionQuery);
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, liveLayersQuery);
  const pushConfig = trpc.rescue.rescuer.pushConfig.useQuery();
  const subscribePush = trpc.rescue.rescuer.subscribePush.useMutation();

  const refreshOperationalState = () => {
    void utils.rescue.rescuer.profile.invalidate();
    void utils.rescue.rescuer.activeOffer.invalidate();
    void utils.rescue.rescuer.missions.invalidate();
    void utils.rescue.rescuer.notifications.invalidate();
    void utils.rescue.operations.mapLayers.invalidate();
  };

  const setAvailability = trpc.rescue.rescuer.setAvailability.useMutation({
    onMutate: async ({ availability }) => {
      await utils.rescue.rescuer.profile.cancel();
      const previous = utils.rescue.rescuer.profile.getData();
      utils.rescue.rescuer.profile.setData(undefined, profile => reconcileAvailability(profile, availability));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.rescue.rescuer.profile.setData(undefined, context.previous);
    },
    onSettled: refreshOperationalState,
  });

  const updateMission = trpc.rescue.rescuer.updateMission.useMutation({
    onMutate: async ({ missionId, status }) => {
      await utils.rescue.rescuer.missions.cancel();
      const previous = utils.rescue.rescuer.missions.getData();
      utils.rescue.rescuer.missions.setData(undefined, rows => reconcileMissionStatus(rows, missionId, status));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.rescue.rescuer.missions.setData(undefined, context.previous);
    },
    onSettled: refreshOperationalState,
  });

  const updateProfile = trpc.rescue.rescuer.updateProfile.useMutation({ onSettled: refreshOperationalState });
  const updateLiveLocation = trpc.rescue.rescuer.updateLiveLocation.useMutation();
  const markRead = trpc.rescue.rescuer.markNotificationRead.useMutation({
    onSuccess: () => {
      void utils.rescue.rescuer.notifications.invalidate();
    },
  });

  const activeMissionRow = missions.data?.find(({ mission }) => mission.status !== "resolved") ?? null;
  const hasActiveMission = Boolean(activeMissionRow);

  const lastNotifiedOfferIdRef = useRef<number | null>(null);
  const lastNotifiedAlertIdRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => refreshOperationalState();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [utils]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void requestNotificationPermission();
    }
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setPushState("unsupported");
      setPushDetail(t("This browser cannot receive secure background alerts. Keep the Alerts page open for in-app updates."));
      return;
    }
    if (Notification.permission === "granted") {
      setPushState("permission_granted");
      setPushDetail(t("Browser permission is granted. Finish setup to securely register this device for delivery."));
    }
  }, []);

  // Generic alerts feed effect: fires once per unique unread alert ID, not on every polling cycle.
  // The emergency mission offer takes priority over this generic feed — it is handled separately.
  useEffect(() => {
    if (!alerts.data) return;
    // Only process the most-recent unread alert that is NOT a priority_incident (those are handled by activeOffer)
    const newest = alerts.data.items.find(item => !item.readAt && item.type !== "priority_incident");
    if (!newest) {
      // If no non-priority unread, also reset so future ones fire
      return;
    }
    // Guard: only fire once per unique alert ID to prevent duplicate notifications on every polling cycle
    if (lastNotifiedAlertIdRef.current === newest.id) return;
    lastNotifiedAlertIdRef.current = newest.id;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(newest.title, {
          body: newest.body,
          tag: `alert-${newest.id}`,
        });
      } catch {}
    }
    void showNotification({ title: newest.title, body: newest.body, id: newest.id });
  }, [alerts.data]);

  // Dedicated Active Mission Offer effect: audio alert + document title flashing + unconditional OS notification.
  // Uses lastNotifiedOfferIdRef so each offer ID only fires ONE notification, never duplicated across polling cycles.
  // When the offer clears (no longer active), resets tracking so the NEXT offer fires fresh.
  useEffect(() => {
    const offerData = activeOffer.data;
    if (offerData?.hasOffer && offerData.offer && offerData.incident) {
      const offerId = offerData.offer.id;
      if (lastNotifiedOfferIdRef.current !== offerId) {
        lastNotifiedOfferIdRef.current = offerId;
        // 1. Play immediate audio alert (attempt; browser autoplay policy may block silently)
        playEmergencyAudioAlert();
        // 2. Fire ONE unconditional native/web OS notification for this offer ID (requireInteraction keeps it visible)
        void showNotification({
          title: `🚨 EMERGENCY SOS OFFER: ${offerData.incident.requestCategory.toUpperCase()}`,
          body: `${offerData.incident.severity.toUpperCase()} SOS at ${offerData.incident.locationLabel}. 30s to accept!`,
          id: offerId,
        });
      }

      // 3. Flash document title on interval until offer is accepted/declined/expired
      const originalTitle = document.title || "sudo MakeItWork";
      let flashState = false;
      const titleInterval = window.setInterval(() => {
        flashState = !flashState;
        document.title = flashState
          ? `🚨 NEW SOS — ACCEPT NOW`
          : `⚠️ MISSION OFFER PENDING`;
      }, 800);

      return () => {
        window.clearInterval(titleInterval);
        document.title = originalTitle;
      };
    } else {
      // Offer cleared (accepted / declined / expired) — reset tracking so next offer triggers fresh alert
      lastNotifiedOfferIdRef.current = null;
    }
  }, [activeOffer.data?.hasOffer, activeOffer.data?.offer?.id]);

  // Live GPS tracking: only during active assigned missions
  useEffect(() => {
    if (!hasActiveMission || !navigator.geolocation) return;

    let watchId: number | null = null;
    let isMounted = true;

    const startWatch = () => {
      watchId = navigator.geolocation.watchPosition(
        (point) => {
          if (!isMounted) return;
          const lat = point.coords.latitude;
          const lng = point.coords.longitude;
          if (
            typeof lat === "number" &&
            typeof lng === "number" &&
            !isNaN(lat) &&
            !isNaN(lng) &&
            isFinite(lat) &&
            isFinite(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
          ) {
            updateLiveLocation.mutate({ latitude: lat, longitude: lng });
          }
        },
        () => {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          if (isMounted) {
            setTimeout(() => {
              if (isMounted) startWatch();
            }, 8_000);
          }
        },
        { enableHighAccuracy: true, maximumAge: 3_000, timeout: 5_000 }
      );
    };

    startWatch();

    return () => {
      isMounted = false;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };
  }, [hasActiveMission]);

  const enableAlerts = async () => {
    if (!pushConfig.data?.enabled || !pushConfig.data.publicKey) {
      setPushState("unsupported");
      setPushDetail(t("Background delivery is unavailable until the operations team configures the push service."));
      return;
    }
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setPushState("unsupported");
      setPushDetail(t("This browser does not support secure background alerts. Use a current HTTPS browser session instead."));
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("failed");
        setPushDetail(t("Browser alerts were not permitted. You can enable them later in the browser site settings."));
        return;
      }
      setPushState("permission_granted");
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active)
        throw new Error("The alert service is still starting. Wait a moment, refresh this page, and try again.");
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(pushConfig.data.publicKey),
        }));
      await subscribePush.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: subscription.toJSON().keys?.p256dh || "",
        auth: subscription.toJSON().keys?.auth || "",
      });
      setPushState("subscribed");
      setPushDetail(t("Secure browser alerts are active. You will receive immediate assignment updates."));
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        try {
          await resetPushRegistration();
          setPushState("permission_granted");
          setPushDetail(
            t(
              "The existing browser alert registration was cleared. Click Finish browser alert setup once more to create a fresh subscription."
            )
          );
          return;
        } catch {
          /* Fall through */
        }
      }
      setPushState("failed");
      setPushDetail(describePushFailure(error, t));
    }
  };

  const withCurrentLocation = (availability: "available" | "on_mission" | "off_duty") => {
    if (!navigator.geolocation) {
      setAvailability.mutate({ availability });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      point =>
        setAvailability.mutate({
          availability,
          latitude: point.coords.latitude,
          longitude: point.coords.longitude,
        }),
      () => setAvailability.mutate({ availability }),
      { enableHighAccuracy: true, timeout: 8_000 }
    );
  };

  return (
    <DashboardLayout navItems={nav} workspace={t("responder.workspace")} roleLabel={t("responder.role")}>
      <div className="space-y-6">
        {activeOffer.data?.hasOffer && activeOffer.data.offer && activeOffer.data.incident && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New Emergency Request"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <EmergencyOfferCard
                data={activeOffer.data as any}
                onAccepted={() => {
                  void refreshOperationalState();
                }}
                onDeclined={() => {
                  void refreshOperationalState();
                }}
              />
            </div>
          </div>
        )}
        {location === "/responder/map" ? (
          <section>
            <PageHeading eyebrow={t("responder.map")} title={t("responder.mapTitle")} />
            <OperationsMap layers={layers.data} />
          </section>
        ) : location === "/responder/hospitals" ? (
          <RescuerHospitalsView
            hospitals={layers.data?.hospitals ?? []}
            activeMission={activeMissionRow}
            rescuerLocation={{
              latitude: profile.data?.lastLatitude || undefined,
              longitude: profile.data?.lastLongitude || undefined,
            }}
            onHandoffSelected={refreshOperationalState}
          />
        ) : location === "/responder/alerts" ? (
          <AlertsView
            items={alerts.data?.items ?? []}
            onRead={id => markRead.mutate({ notificationId: id })}
          />
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-3xl bg-[#174e46] p-6 text-white shadow-[0_20px_60px_-30px_rgb(21_78_70/0.75)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b1dbd1]">
                  {t("responder.readiness")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <UserProfileBadge
                    user={{
                      name: user?.name,
                      email: user?.email,
                      photoUrl: profile.data?.photoUrl || (user as any)?.photoUrl,
                      avatarUrl: (user as any)?.avatarUrl,
                      role: user?.role,
                    }}
                    size="xl"
                    textClassName="text-2xl font-extrabold tracking-tight text-white"
                  />
                  {profile.data?.callSign && (
                    <span className="rounded-lg bg-white/15 px-2.5 py-1 font-mono text-xs font-bold text-[#b1dbd1]">
                      {profile.data.callSign}
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-lg text-sm leading-6 text-[#c2e1d9]">
                  {t("responder.readinessCopy")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(
                    [
                      ["available", t("responder.available")],
                      ["on_mission", t("responder.onMission")],
                      ["off_duty", t("responder.offDuty")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => withCurrentLocation(value)}
                      disabled={setAvailability.isPending || !profile.data}
                      className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
                        profile.data?.availability === value
                          ? "bg-white text-[#174e46]"
                          : "bg-white/10 text-[#d8eee8] hover:bg-white/20"
                      }`}
                    >
                      {setAvailability.isPending ? t("responder.updating") : label}
                    </button>
                  ))}
                </div>
              </div>
              <AlertSetup
                unread={alerts.data?.unread ?? 0}
                state={pushState}
                detail={pushDetail}
                disabled={subscribePush.isPending || pushState === "subscribed"}
                onEnable={enableAlerts}
              />
            </section>
            <BleEmergencyRadar
              rescuerLatitude={profile.data?.lastLatitude || undefined}
              rescuerLongitude={profile.data?.lastLongitude || undefined}
            />
            <ResponderProfileCard
              profile={profile.data ?? null}
              hasActiveMission={hasActiveMission}
              saving={updateProfile.isPending}
              onSave={input => updateProfile.mutate(input)}
            />
            <section>
              <div className="mb-4">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                  {t("responder.board")}
                </h1>
              </div>
              <div className="grid gap-3">
                {missions.data?.length ? (
                  missions.data.map(({ mission, incident }) => (
                    <RescuerMissionCard
                      key={mission.id}
                      mission={mission}
                      incident={incident}
                      hospitals={layers.data?.hospitals ?? []}
                      onUpdateStatus={status => updateMission.mutate({ missionId: mission.id, status })}
                      isUpdating={updateMission.isPending}
                    />
                  ))
                ) : (
                  <Empty text={t("responder.noMission")} />
                )}
              </div>
            </section>
            <ResponderMissionChat missions={missions.data ?? []} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function RescuerHospitalsView({
  hospitals,
  activeMission,
  rescuerLocation,
  onHandoffSelected,
}: {
  hospitals: Array<any>;
  activeMission: { mission: any; incident: any } | null;
  rescuerLocation?: { latitude?: number; longitude?: number };
  onHandoffSelected?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "has_icu" | "has_er">("all");
  const [selectedHospitalForModal, setSelectedHospitalForModal] = useState<any | null>(null);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [selectedHospitalForInbound, setSelectedHospitalForInbound] = useState<any | null>(null);

  const origin = activeMission?.incident
    ? {
        lat: Number(activeMission.incident.latitude) || 26.1445,
        lng: Number(activeMission.incident.longitude) || 91.7362,
        label: `Victim GPS: SOS #${activeMission.incident.publicCode} (${activeMission.incident.locationLabel || "Incident Location"})`,
        isVictim: true,
      }
    : rescuerLocation?.latitude && rescuerLocation?.longitude
    ? {
        lat: rescuerLocation.latitude,
        lng: rescuerLocation.longitude,
        label: "Your current rescuer GPS coordinates",
        isVictim: false,
      }
    : {
        lat: 26.1445,
        lng: 91.7362,
        label: "Assam Emergency Operations Network (Central Guwahati)",
        isVictim: false,
      };

  const hospitalsWithDistance = hospitals
    .map(hospital => {
      const lat = Number(hospital.latitude) || 0;
      const lng = Number(hospital.longitude) || 0;
      const distanceKm = lat && lng ? calculateDistanceKm(origin.lat, origin.lng, lat, lng) : 9999;
      return { ...hospital, distanceKm };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const filteredHospitals = hospitalsWithDistance.filter(h => {
    const matchesSearch =
      !search.trim() ||
      h.name?.toLowerCase().includes(search.toLowerCase()) ||
      h.address?.toLowerCase().includes(search.toLowerCase()) ||
      h.specialty?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === "open") return h.status === "open";
    if (filterStatus === "has_icu") return (h.availableIcuBeds || 0) > 0;
    if (filterStatus === "has_er") return (h.availableEmergencyBeds || 0) > 0;
    return true;
  });

  const totalEmergencyBeds = hospitals.reduce((acc, h) => acc + (h.availableEmergencyBeds || 0), 0);
  const totalIcuBeds = hospitals.reduce((acc, h) => acc + (h.availableIcuBeds || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Emergency Facilities</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Nearby Hospital Directory</h1>
        </div>
        {activeMission ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Targeting SOS #{activeMission.incident.publicCode}</span>
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">Regional Medical Network</span>
        )}
      </div>

      {/* Location Origin Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#b8ded4] bg-[#f0faf6] p-4 text-xs dark:bg-emerald-950/20 dark:border-emerald-800/40">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-white">
          <LocateFixed className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-foreground">Distances calculated from:</span>
            {origin.isVictim ? (
              <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-bold text-rose-700 dark:text-rose-300">
                Active Victim Location (SOS #{activeMission?.incident.publicCode})
              </span>
            ) : (
              <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-bold text-sky-700 dark:text-sky-300">
                Rescuer Position
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-muted-foreground">{origin.label}</p>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Hospitals</p>
          <p className="mt-1 text-2xl font-black text-foreground">{hospitals.length}</p>
          <p className="text-[11px] text-emerald-600 font-semibold">
            {hospitals.filter(h => h.status === "open").length} open now
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Available ER Beds</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{totalEmergencyBeds}</p>
          <p className="text-[11px] text-muted-foreground">Immediate triage</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Available ICU Beds</p>
          <p className="mt-1 text-2xl font-black text-sky-600">{totalIcuBeds}</p>
          <p className="text-[11px] text-muted-foreground">Critical trauma care</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Closest Facility</p>
          <p className="mt-1 text-2xl font-black text-primary truncate">
            {hospitalsWithDistance[0] ? `${hospitalsWithDistance[0].distanceKm.toFixed(1)} km` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{hospitalsWithDistance[0]?.name || "None"}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hospital by name, address, or specialty…"
            className="rounded-xl pl-3 pr-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All Facilities"],
              ["open", "Open Only"],
              ["has_er", "Available ER"],
              ["has_icu", "Available ICU"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterStatus === key
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hospital Cards List */}
      <div className="grid gap-4">
        {filteredHospitals.length ? (
          filteredHospitals.map(hospital => (
            <HospitalDirectoryCard
              key={hospital.id}
              hospital={hospital}
              activeMission={activeMission}
              originLabel={
                origin.isVictim
                  ? `from victim (SOS #${activeMission?.incident.publicCode})`
                  : "from your location"
              }
              onSelectDestination={() => setSelectedHospitalForModal(hospital)}
              onNotify={() => {
                setSelectedHospitalForInbound(hospital);
                setShowInboundModal(true);
              }}
            />
          ))
        ) : (
          <Empty text="No hospitals match the selected filter or search query." />
        )}
      </div>

      {/* MODAL: DIRECT ASSIGN DESTINATION */}
      {selectedHospitalForModal && activeMission && (
        <AssignHospitalModal
          hospital={selectedHospitalForModal}
          incident={activeMission.incident}
          onClose={() => setSelectedHospitalForModal(null)}
          onSuccess={() => {
            setSelectedHospitalForModal(null);
            onHandoffSelected?.();
          }}
        />
      )}

      {/* MODAL: NOTIFY HOSPITAL INBOUND */}
      {showInboundModal && selectedHospitalForInbound && activeMission && (
        <NotifyHospitalModal
          hospital={selectedHospitalForInbound}
          incident={activeMission.incident}
          onClose={() => {
            setShowInboundModal(false);
            setSelectedHospitalForInbound(null);
          }}
          onSuccess={() => {
            setShowInboundModal(false);
            setSelectedHospitalForInbound(null);
            onHandoffSelected?.();
          }}
        />
      )}
    </div>
  );
}

function HospitalDirectoryCard({
  hospital,
  activeMission,
  originLabel,
  onSelectDestination,
  onNotify,
}: {
  hospital: any;
  activeMission: { mission: any; incident: any } | null;
  originLabel: string;
  onSelectDestination: () => void;
  onNotify: () => void;
}) {
  const totalBeds = (hospital.totalEmergencyBeds || 0) + (hospital.totalIcuBeds || 0);
  const availableBeds = (hospital.availableEmergencyBeds || 0) + (hospital.availableIcuBeds || 0);
  const occupiedBeds = Math.max(0, totalBeds - availableBeds);
  const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const isEnRoute = activeMission?.incident?.destinationHospitalName === hospital.name;

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-[#83c5b4] dark:bg-card dark:hover:border-emerald-700/50">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                <Hospital className="h-4 w-4 text-primary" />
                {hospital.name}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  hospital.status === "open"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : hospital.status === "limited"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    : hospital.status === "critical"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {hospital.status || "open"}
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                📍 {hospital.distanceKm < 999 ? `${hospital.distanceKm.toFixed(1)} km` : "—"} {originLabel}
              </span>
              {isEnRoute && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-400 dark:text-emerald-300">
                  🏥 Assigned Destination
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {hospital.address || "Guwahati, Assam"}
            </p>
          </div>

          {/* Capacity Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Bed className="h-3 w-3" /> ER Beds
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  /{hospital.totalEmergencyBeds || 0}
                </span>
              </div>
              <p className="mt-1 font-black text-sm text-emerald-700 dark:text-emerald-400">
                {hospital.availableEmergencyBeds || 0} available
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> ICU Beds
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  /{hospital.totalIcuBeds || 0}
                </span>
              </div>
              <p className="mt-1 font-black text-sm text-sky-700 dark:text-sky-400">
                {hospital.availableIcuBeds || 0} available
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-2.5">
              <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Wind className="h-3 w-3" /> Oxygen & Blood
              </span>
              <p className="mt-1 text-xs font-bold text-foreground">
                {hospital.oxygenCylinderCount || 0} O₂ · {hospital.bloodUnitCount || 0} Blood
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Ambulance className="h-3 w-3" /> Occupancy
                </span>
                <span className="font-mono text-[10px] font-bold text-muted-foreground">
                  {occupancyPercent}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    occupancyPercent > 85
                      ? "bg-rose-500"
                      : occupancyPercent > 60
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
            <div>
              <strong>Specialty:</strong> {hospital.specialty || "Trauma, Critical Care & General Emergency"}
            </div>
            {hospital.ambulanceCount !== undefined && (
              <div>
                <strong>Ambulances:</strong> {hospital.ambulanceCount} units
              </div>
            )}
          </div>
        </div>

        {/* Action Column */}
        <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-end md:justify-start">
          <a
            href={`tel:${hospital.contactPhone || "+913612529457"}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            <Phone className="h-3.5 w-3.5 text-primary" />
            <span>{hospital.contactPhone || "+91 361 2529457"}</span>
          </a>

          {activeMission && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={onSelectDestination}
                className="rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Hospital className="mr-1.5 h-3.5 w-3.5" />
                {isEnRoute ? "Change Destination" : "Route Handoff"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onNotify}
                className="rounded-xl border-[#0f766e]/40 bg-[#0f766e]/10 text-xs font-bold text-[#0f766e] hover:bg-[#0f766e]/20 dark:text-emerald-300"
              >
                <Navigation className="mr-1.5 h-3.5 w-3.5" />
                Notify Inbound
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function AssignHospitalModal({
  hospital,
  incident,
  onClose,
  onSuccess,
}: {
  hospital: any;
  incident: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [success, setSuccess] = useState(false);
  const selectHospital = trpc.rescue.rescuer.selectHospitalDestination.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    },
  });

  const handleConfirm = () => {
    selectHospital.mutate({
      incidentId: incident.id,
      hospitalId: hospital.id,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Hospital className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold">Confirm Destination Handoff</h3>
              <p className="text-xs text-muted-foreground">SOS #{incident.publicCode}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            ✕
          </button>
        </div>

        {success && (
          <div className="rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            ✓ Destination updated to {hospital.name}! Routing synchronized with command center.
          </div>
        )}

        <div className="rounded-2xl border bg-muted/40 p-4 space-y-2 text-xs">
          <div className="font-extrabold text-sm text-primary">{hospital.name}</div>
          <div className="text-muted-foreground">{hospital.address}</div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg bg-background p-2 border">
              <div className="text-[10px] uppercase text-muted-foreground font-bold">ER Beds</div>
              <div className="font-black text-emerald-700">{hospital.availableEmergencyBeds || 0} available</div>
            </div>
            <div className="rounded-lg bg-background p-2 border">
              <div className="text-[10px] uppercase text-muted-foreground font-bold">ICU Beds</div>
              <div className="font-black text-sky-700">{hospital.availableIcuBeds || 0} available</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selectHospital.isPending || success}
            onClick={handleConfirm}
            className="rounded-xl bg-primary text-white"
          >
            {selectHospital.isPending ? "Assigning…" : "Confirm & Route"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotifyHospitalModal({
  hospital,
  incident,
  onClose,
  onSuccess,
}: {
  hospital: any;
  incident: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [patientCount, setPatientCount] = useState(incident.peopleAffected || 1);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [department, setDepartment] = useState("Emergency & Trauma");
  const [icuRequired, setIcuRequired] = useState<"yes" | "no">(incident.severity === "critical" ? "yes" : "no");
  const [oxygenRequired, setOxygenRequired] = useState<"yes" | "no">("no");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);

  const selectHospitalDest = trpc.rescue.rescuer.selectHospitalDestination.useMutation();
  const notifyHospital = trpc.rescue.rescuer.notifyHospital.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    selectHospitalDest.mutate({ incidentId: incident.id, hospitalId: hospital.id });
    notifyHospital.mutate({
      incidentId: incident.id,
      hospitalId: hospital.id,
      severity: incident.severity || "high",
      patientCount: Number(patientCount) || 1,
      estimatedArrivalMinutes: Number(etaMinutes) || 15,
      requiredDepartment: department,
      icuRequired,
      oxygenRequired,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Navigation className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold">Notify Hospital for Inbound Case</h3>
              <p className="text-xs text-muted-foreground">{hospital.name} · SOS #{incident.publicCode}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            ✕
          </button>
        </div>

        {success && (
          <div className="rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            ✓ Inbound alert broadcasted to {hospital.name}! Triage desk prepared for arrival.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Patient Count</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={patientCount}
                onChange={e => setPatientCount(Number(e.target.value))}
                className="mt-1.5 h-10 text-xs font-bold"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Estimated Arrival (Minutes)</Label>
              <Input
                type="number"
                min="1"
                max="180"
                value={etaMinutes}
                onChange={e => setEtaMinutes(Number(e.target.value))}
                className="mt-1.5 h-10 text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Required Department</Label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
            >
              <option value="Emergency & Trauma">Emergency & Trauma</option>
              <option value="ICU Critical Care">ICU Critical Care</option>
              <option value="Pediatrics Emergency">Pediatrics Emergency</option>
              <option value="Burn & Triage Ward">Burn & Triage Ward</option>
              <option value="General Medical Evacuation">General Medical Evacuation</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs font-bold">
              <input
                type="checkbox"
                checked={icuRequired === "yes"}
                onChange={e => setIcuRequired(e.target.checked ? "yes" : "no")}
                className="h-4 w-4 accent-primary"
              />
              ICU Bed Required
            </label>
            <label className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs font-bold">
              <input
                type="checkbox"
                checked={oxygenRequired === "yes"}
                onChange={e => setOxygenRequired(e.target.checked ? "yes" : "no")}
                className="h-4 w-4 accent-primary"
              />
              Oxygen Support
            </label>
          </div>

          <div>
            <Label className="text-xs font-bold">Field Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Hypothermia, severe flood lacerations, elderly patient..."
              rows={2}
              className="mt-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={notifyHospital.isPending || success}
              className="rounded-xl bg-primary text-xs font-bold text-white"
            >
              {notifyHospital.isPending ? "Sending Alert…" : "Send Inbound Alert"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RescuerMissionCard({
  mission,
  incident,
  hospitals,
  onUpdateStatus,
  isUpdating,
}: {
  mission: any;
  incident: any;
  hospitals: Array<{ id: number; name: string; address: string; status: string }>;
  onUpdateStatus: (status: "dispatched" | "resolved") => void;
  isUpdating: boolean;
}) {
  const { t } = useLanguage();
  const [showHospitalDialog, setShowHospitalDialog] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
    hospitals[0]?.id ? String(hospitals[0].id) : ""
  );
  const [patientCount, setPatientCount] = useState(incident.peopleAffected || 1);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [department, setDepartment] = useState("Emergency & Trauma");
  const [icuRequired, setIcuRequired] = useState<"yes" | "no">(incident.severity === "critical" ? "yes" : "no");
  const [oxygenRequired, setOxygenRequired] = useState<"yes" | "no">("no");
  const [notes, setNotes] = useState("");
  const [notifiedNotice, setNotifiedNotice] = useState(false);

  const selectHospitalDest = trpc.rescue.rescuer.selectHospitalDestination.useMutation();
  const notifyHospital = trpc.rescue.rescuer.notifyHospital.useMutation({
    onSuccess: () => {
      setNotifiedNotice(true);
      setTimeout(() => {
        setNotifiedNotice(false);
        setShowHospitalDialog(false);
      }, 3000);
    },
  });

  const handleSendHospitalAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId) return;
    const hospId = Number(selectedHospitalId);
    selectHospitalDest.mutate({ incidentId: incident.id, hospitalId: hospId });
    notifyHospital.mutate({
      incidentId: incident.id,
      hospitalId: hospId,
      severity: incident.severity || "high",
      patientCount: Number(patientCount) || 1,
      estimatedArrivalMinutes: Number(etaMinutes) || 15,
      requiredDepartment: department,
      icuRequired,
      oxygenRequired,
      notes: notes.trim() || undefined,
    });
  };

  const currentHospital: any = hospitals.find(h => h.id === Number(selectedHospitalId)) || hospitals[0];

  return (
    <article className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] dark:bg-card">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-primary">{incident.publicCode}</span>
          <StatusBadge status={mission.status} />
          {incident.destinationHospitalName && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
              🏥 En route: {incident.destinationHospitalName}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-lg font-extrabold">{incident.locationLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {incident.peopleAffected} {t("responder.people")} · {incident.emergencyType} ·{" "}
          <strong className={incident.severity === "critical" ? "text-destructive" : ""}>
            {incident.severity}
          </strong>{" "}
          {t("responder.priority")}
        </p>
        {mission.notes && (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
            {mission.notes}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 md:items-end md:justify-center">
        <div className="flex flex-wrap items-center gap-2">
          {mission.status !== "resolved" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHospitalDialog(true)}
              className="rounded-xl border-[#0f766e]/40 bg-[#0f766e]/10 text-xs font-bold text-[#0f766e] hover:bg-[#0f766e]/20 dark:text-emerald-300"
            >
              <Hospital className="mr-1.5 h-3.5 w-3.5" />
              Notify Hospital
            </Button>
          )}

          {mission.status === "resolved" ? (
            <span className="flex items-center gap-2 text-sm font-bold text-[#19755f] dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> {t("responder.completed")}
            </span>
          ) : (
            <Button
              disabled={isUpdating}
              onClick={() => onUpdateStatus(mission.status === "pending" ? "dispatched" : "resolved")}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isUpdating ? (
                t("responder.updating")
              ) : mission.status === "pending" ? (
                <>
                  <Navigation className="mr-2 h-4 w-4" /> {t("responder.dispatched")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> {t("responder.resolved")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* NOTIFY HOSPITAL MODAL DIALOG */}
      {showHospitalDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Hospital className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold">Notify Hospital for Inbound Case</h3>
                  <p className="text-xs text-muted-foreground">Case #{incident.publicCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHospitalDialog(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {notifiedNotice && (
              <div className="rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                ✓ Hospital notified successfully! Inbound telemetry broadcasted to medical triage desk.
              </div>
            )}

            <form onSubmit={handleSendHospitalAlert} className="space-y-3">
              <div>
                <Label className="text-xs font-bold">Select Destination Hospital</Label>
                <select
                  value={selectedHospitalId}
                  onChange={e => setSelectedHospitalId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  required
                >
                  {hospitals.length ? (
                    hospitals.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {h.address}
                      </option>
                    ))
                  ) : (
                    <option value="">No verified hospitals found</option>
                  )}
                </select>
              </div>

              {/* Hospital Details Display */}
              {currentHospital && (
                <div className="rounded-2xl border border-emerald-800/20 bg-emerald-500/5 p-3.5 space-y-2 text-xs">
                  <div className="font-extrabold text-sm text-primary flex items-center gap-1.5">
                    <span>🏥</span> {currentHospital.name}
                  </div>
                  <div className="text-muted-foreground">📍 {currentHospital.address}</div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div className="rounded-xl bg-white p-2 border dark:bg-card">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Bed Capacity</div>
                      <div className="font-black text-xs text-emerald-700 dark:text-emerald-400">
                        {(currentHospital.totalEmergencyBeds || 0) + (currentHospital.totalIcuBeds || 0)} total beds
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ER: {currentHospital.totalEmergencyBeds || 0} · ICU: {currentHospital.totalIcuBeds || 0}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-2 border dark:bg-card">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Occupancy</div>
                      <div className="font-black text-xs text-sky-700 dark:text-sky-400">
                        {(currentHospital.totalEmergencyBeds || 0) +
                          (currentHospital.totalIcuBeds || 0) -
                          ((currentHospital.availableEmergencyBeds || 0) + (currentHospital.availableIcuBeds || 0))}{" "}
                        occupied
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                        {(currentHospital.availableEmergencyBeds || 0) + (currentHospital.availableIcuBeds || 0)}{" "}
                        available
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 pt-1">
                    <div>
                      <strong>Specialty:</strong> {currentHospital.specialty || "Trauma, Critical Care & Emergency"}
                    </div>
                    <div>
                      <strong>Contact:</strong>{" "}
                      <a
                        href={`tel:${currentHospital.contactPhone || "+913612529457"}`}
                        className="text-primary font-bold underline"
                      >
                        {currentHospital.contactPhone || "+91 361 2529457"}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">Patients Count</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={patientCount}
                    onChange={e => setPatientCount(Number(e.target.value))}
                    className="mt-1.5 h-10 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Estimated Arrival (Minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="180"
                    value={etaMinutes}
                    onChange={e => setEtaMinutes(Number(e.target.value))}
                    className="mt-1.5 h-10 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Required Department</Label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
                >
                  <option value="Emergency & Trauma">Emergency & Trauma</option>
                  <option value="ICU Critical Care">ICU Critical Care</option>
                  <option value="Pediatrics Emergency">Pediatrics Emergency</option>
                  <option value="Burn & Triage Ward">Burn & Triage Ward</option>
                  <option value="General Medical Evacuation">General Medical Evacuation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={icuRequired === "yes"}
                    onChange={e => setIcuRequired(e.target.checked ? "yes" : "no")}
                    className="h-4 w-4 accent-primary"
                  />
                  ICU Bed Required
                </label>
                <label className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={oxygenRequired === "yes"}
                    onChange={e => setOxygenRequired(e.target.checked ? "yes" : "no")}
                    className="h-4 w-4 accent-primary"
                  />
                  Oxygen Support
                </label>
              </div>

              <div>
                <Label className="text-xs font-bold">Special Field Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Hypothermia, severe flood lacerations, elderly patient..."
                  rows={2}
                  className="mt-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowHospitalDialog(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={notifyHospital.isPending || !selectedHospitalId}
                  className="rounded-xl bg-primary text-xs font-bold text-white"
                >
                  {notifyHospital.isPending ? "Notifying Facility…" : "Send Inbound Alert"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}

function AlertSetup({
  unread,
  state,
  detail,
  disabled: _disabled,
  onEnable,
}: {
  unread: number;
  state: PushState;
  detail: string;
  disabled: boolean;
  onEnable: () => void;
}) {
  const { t } = useLanguage();
  const label =
    state === "subscribed"
      ? t("Browser alerts active")
      : state === "permission_granted"
      ? t("Finish browser alert setup")
      : state === "unsupported"
      ? t("Background alerts unavailable")
      : t("responder.enableAlerts");
  const isLocked = state === "subscribed" || state === "unsupported";
  return (
    <div className="rounded-3xl border bg-white p-6 dark:bg-card">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
          <Bell className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-[#fff0ee] px-2.5 py-1 font-mono text-[10px] font-bold text-[#b44742]">
          {unread} {t("general.new")}
        </span>
      </div>
      <h2 className="mt-5 text-lg font-extrabold">{t("responder.assignmentAlerts")}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("responder.alertCopy")}</p>
      <button
        type="button"
        onClick={onEnable}
        disabled={isLocked}
        className="mt-4 w-full rounded-xl border border-[#91cbbb] px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-[#effaf6] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
      {detail && (
        <p
          className={`mt-3 text-xs leading-5 ${
            state === "failed"
              ? "text-destructive"
              : state === "subscribed"
              ? "text-[#19755f]"
              : "text-muted-foreground"
          }`}
        >
          {detail}
        </p>
      )}
      {!isLocked && (
        <button
          type="button"
          onClick={onEnable}
          className="mt-2 w-full text-xs font-bold text-primary underline underline-offset-4"
        >
          {t("responder.retryAlerts")}
        </button>
      )}
    </div>
  );
}

type RescuerProfileSummary = {
  callSign: string;
  phone: string | null;
  photoUrl: string | null;
  contactSharing: "yes" | "no";
  locationSharing: "yes" | "no";
};
type ProfileUpdate = {
  phone?: string | null;
  contactSharing?: "yes" | "no";
  photoDataUrl?: string | null;
  clearPhoto?: boolean;
};

export function ResponderProfileCard({
  profile,
  hasActiveMission,
  saving,
  onSave,
}: {
  profile: RescuerProfileSummary | null;
  hasActiveMission: boolean;
  saving: boolean;
  onSave: (input: ProfileUpdate) => void;
}) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [contactSharing, setContactSharing] = useState<"yes" | "no">(profile?.contactSharing ?? "no");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (profile?.phone !== undefined) setPhone(profile?.phone ?? "");
    if (profile?.contactSharing !== undefined) setContactSharing(profile?.contactSharing ?? "no");
  }, [profile?.phone, profile?.contactSharing]);

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_000_000) {
      setPhotoError(t("Choose a PNG, JPEG, or WebP image smaller than 1 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result));
      setPhotoError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave({
      phone: phone.trim() || null,
      contactSharing,
      ...(photoDataUrl ? { photoDataUrl } : {}),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 4000);
  };

  const preview = photoDataUrl || profile?.photoUrl;
  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6 dark:bg-card">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e7f7ee] text-primary">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7" />}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t("Your field profile")}</p>
            <h2 className="mt-1 text-xl font-extrabold">{profile?.callSign || t("responder.profilePending")}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t("Your contact details are shown only to the person linked to an active mission when you choose to share them.")}
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#91cbbb] px-4 py-2.5 text-sm font-bold text-primary hover:bg-[#effaf6]">
          <Camera className="h-4 w-4" /> {t("Add or change photo")}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} className="sr-only" />
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <Label htmlFor="rescuer-phone">{t("Assignment contact number")}</Label>
          <div className="flex gap-2">
            <Phone className="mt-3 h-4 w-4 shrink-0 text-primary" />
            <Input
              id="rescuer-phone"
              inputMode="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder={t("Phone number for active assignments")}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f0faf6] px-4 py-3 text-sm font-semibold text-[#285f55]">
          <input
            type="checkbox"
            checked={contactSharing === "yes"}
            onChange={event => setContactSharing(event.target.checked ? "yes" : "no")}
            className="h-4 w-4 accent-primary"
          />
          {t("Show my phone number to my active assignment")}
        </label>
      </div>

      {photoError && <p className="mt-3 text-xs font-semibold text-destructive">{photoError}</p>}
      {savedNotice && (
        <p className="mt-3 rounded-xl bg-[#e7f7ee] p-2.5 text-xs font-bold text-[#19755f]">
          ✓ Details and contact preferences saved successfully!
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={saving} className="rounded-xl">
          {saving ? t("responder.updating") : t("Save profile and contact settings")}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPhotoDataUrl(null);
              onSave({ clearPhoto: true });
            }}
            disabled={saving}
          >
            {t("Remove photo")}
          </Button>
        )}
      </div>

      <div
        className={`mt-6 rounded-2xl border p-4 ${
          hasActiveMission ? "border-[#b8ded4] bg-[#f8fcfa]" : "border-border bg-muted/40"
        }`}
      >
        <div className="flex gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              hasActiveMission ? "bg-primary text-white" : "bg-secondary text-primary"
            }`}
          >
            <LocateFixed className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-extrabold">Automatic mission location</h3>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              {hasActiveMission
                ? "Your location is shared automatically with the person linked to your active SOS and refreshes every 5 seconds. It stops and clears automatically when the mission is resolved."
                : "Location sharing starts automatically when Command assigns you an active SOS mission."}
            </p>
            {hasActiveMission && (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e7f6ef] px-3 py-1.5 text-xs font-bold text-[#19755f]">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Sharing automatically every 5 seconds
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RescuerRegistration() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const myReq = trpc.rescue.rescuer.myRegistration.useQuery();
  const request = trpc.rescue.rescuer.requestRegistration.useMutation({
    onSuccess: () => {
      void myReq.refetch();
    },
  });

  useEffect(() => {
    if (myReq.data) {
      if (myReq.data.phone && !phone) setPhone(myReq.data.phone);
      if (myReq.data.note && !note) setNote(myReq.data.note);
    }
  }, [myReq.data]);

  const isPendingReview = myReq.data?.status === "pending";

  return (
    <div className="relative min-h-screen app-grid flex items-center justify-center p-5">
      <div className="absolute right-4 top-4">
        <LanguageSelector compact />
      </div>
      <section className="w-full max-w-lg rounded-[2rem] border bg-white p-6 shadow-xl dark:bg-card">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7f7ee] text-primary">
          <ClipboardPenLine className="h-6 w-6" />
        </span>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          {t("Join the field team")}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{t("Request rescuer access")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(
            "Send your details to the Command Centre. An administrator will review and assign a secure field call sign before missions can be shown."
          )}
        </p>

        {isPendingReview && (
          <div className="mt-4 rounded-2xl border border-[#b8dfd5] bg-[#eff9f6] p-4 text-xs leading-5 text-[#185348]">
            <p className="font-bold">✓ Application Awaiting Review</p>
            <p className="mt-1">
              Your rescuer registration request is currently under review by the Command Centre. You can update your
              phone or notes below at any time.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">{t("Phone")}</Label>
            <Input
              id="phone"
              inputMode="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder={t("Optional field contact")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">{t("Experience or availability note")}</Label>
            <Textarea
              id="note"
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder={t("Example: trained boat operator, medical volunteer, local area knowledge…")}
            />
          </div>
        </div>

        <Button
          disabled={request.isPending}
          onClick={() => request.mutate({ phone: phone.trim() || undefined, note: note.trim() || undefined })}
          className="mt-6 w-full rounded-xl"
        >
          {request.isPending
            ? t("Sending request…")
            : isPendingReview
            ? "Update registration details"
            : t("Request rescuer access")}
        </Button>

        {request.isSuccess && (
          <p className="mt-4 rounded-xl bg-[#e7f7ee] p-3 text-sm font-semibold text-[#19755f]">
            {t("Request sent. Wait for Command Centre approval, then refresh this page.")}
          </p>
        )}
        {request.error && <p className="mt-4 text-sm font-semibold text-destructive">{request.error.message}</p>}
        <Button variant="outline" onClick={() => setLocation("/")} className="mt-3 w-full rounded-xl">
          {t("Return to safety hub")}
        </Button>
      </section>
    </div>
  );
}

function AlertsView({
  items,
  onRead,
}: {
  items: Array<{ id: number; title: string; body: string; readAt: Date | null; createdAt?: Date | string }>;
  onRead: (id: number) => void;
}) {
  const { t } = useLanguage();
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  // TTL Filter: only show alerts generated within 24 hours
  const validItems = items.filter(alert => {
    if (!alert.createdAt) return true;
    const alertTime = new Date(alert.createdAt).getTime();
    return now - alertTime <= TWENTY_FOUR_HOURS_MS;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <PageHeading
          eyebrow={t("responder.missionAlerts")}
          title={t("responder.operationalNotifications")}
        />
        <div className="flex items-center gap-2 self-start rounded-full border border-emerald-600/30 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Auto-clears after 24 hours</span>
        </div>
      </div>

      <div className="grid gap-3">
        {validItems.length ? (
          validItems.map(alert => (
            <button
              key={alert.id}
              onClick={() => !alert.readAt && onRead(alert.id)}
              className={`rounded-2xl border p-4 text-left transition hover:border-[#83c5b4] ${
                alert.readAt
                  ? "bg-white dark:bg-card"
                  : "bg-[#effaf6] dark:bg-emerald-950/20 border-emerald-500/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-extrabold">{alert.title}</p>
                    {alert.createdAt && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        · {formatRelativeTime(alert.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p>
                </div>
                {!alert.readAt && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#c94b45]" />}
              </div>
            </button>
          ))
        ) : (
          <Empty text={t("responder.noAlerts")} />
        )}
      </div>
    </section>
  );
}

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function resetPushRegistration() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async registration => {
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await registration.unregister();
    })
  );
}

function describePushFailure(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";
  if (/could not retrieve the public key/i.test(message))
    return t(
      "This browser’s PushManager key store did not respond. sudo MakeItWork’s VAPID pair is valid. Restart the browser or device, then retry; if it persists, clear this site’s storage and notification permission or use another current browser. In-app alerts remain available."
    );
  if (/no active Service Worker/i.test(message))
    return t("The alert worker is still starting. Wait a few seconds, refresh this page, and try again.");
  return message || t("We could not complete browser alert setup. Please try again or use the in-app Alerts view.");
}

function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
    </div>
  );
}

function ResponderMissionChat({
  missions,
}: {
  missions: Array<{ mission: { id: number; status: string }; incident: { publicCode: string } }>;
}) {
  const active = missions.find(({ mission }) => mission.status !== "resolved") || missions[0];
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();
  const thread = trpc.rescue.rescuer.missionMessages.useQuery(
    { missionId: active?.mission.id || 0 },
    { enabled: Boolean(active), refetchInterval: 5_000, retry: false }
  );
  const send = trpc.rescue.rescuer.sendMissionMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      if (active) void utils.rescue.rescuer.missionMessages.invalidate({ missionId: active.mission.id });
    },
  });
  if (!active) return null;
  return (
    <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm dark:bg-card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">SOS conversation</p>
          <h2 className="mt-1 text-lg font-extrabold">{active.incident.publicCode}</h2>
        </div>
      </div>
      <div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-2xl bg-[#f7faf9] p-3 dark:bg-muted/40">
        {thread.data?.length ? (
          thread.data.map(item => (
            <div
              key={item.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 ${
                item.authorType === "rescuer"
                  ? "ml-auto bg-[#174e46] text-white"
                  : "bg-white text-[#315e54] dark:bg-background dark:text-foreground"
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wide opacity-70">
                {item.authorType === "victim" ? "Victim" : item.authorType === "operations" ? "Operations" : "You"}
              </span>
              {item.message}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No messages yet. Send a concise update if contact is needed.</p>
        )}
      </div>
      {active.mission.status !== "resolved" && (
        <div className="mt-3 flex gap-2">
          <Input
            value={message}
            onChange={event => setMessage(event.target.value)}
            maxLength={500}
            placeholder="Send a short update"
            className="h-10 text-xs"
          />
          <Button
            disabled={!message.trim() || send.isPending}
            onClick={() => send.mutate({ missionId: active.mission.id, message: message.trim() })}
            className="h-10 w-10 shrink-0 rounded-xl p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
      {send.error && <p className="mt-2 text-xs font-semibold text-destructive">{send.error.message}</p>}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${
        status === "resolved"
          ? "bg-[#d9f3e8] text-[#19755f] dark:bg-emerald-950/50 dark:text-emerald-300"
          : status === "dispatched"
          ? "bg-[#dfeeff] text-[#255c7d] dark:bg-sky-950/50 dark:text-sky-300"
          : "bg-[#fff2d9] text-[#9b6615] dark:bg-amber-950/50 dark:text-amber-300"
      }`}
    >
      {status}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm leading-6 text-muted-foreground dark:bg-card/40">
      <UserRoundCheck className="mx-auto mb-3 h-7 w-7 text-primary/60" />
      {text}
    </div>
  );
}
