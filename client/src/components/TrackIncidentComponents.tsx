import { useAuth } from "@/_core/hooks/useAuth";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { ARRIVING_DISTANCE_KM, LIVE_LOCATION_STALE_THRESHOLD_MS } from "@/hooks/useLiveRescuerStream";
import { CheckCircle2, Clock3, MessageCircle, Navigation, Phone, Radio, Send, UserRound, Wifi, WifiOff } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export type AssignedRescuer = {
  callSign: string;
  name: string | null;
  photoUrl: string | null;
  phone: string | null;
  locationStatus: "live" | "paused" | "off";
  location: { latitude: number; longitude: number; updatedAt: Date } | null;
  destination?: { latitude: number; longitude: number };
  route?: { distanceKm: number; distanceText: string; durationMinutes: number; etaText: string; isApproximate: boolean; coordinates: [number, number][] } | null;
};

export function IncidentChat({ publicCode, active }: { publicCode: string; active: boolean }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();
  const messages = trpc.rescue.emergency.chatByCode.useQuery({ publicCode }, { refetchInterval: 5_000, retry: false });
  const send = trpc.rescue.emergency.sendChat.useMutation({
    onSuccess: () => {
      setMessage("");
      void utils.rescue.emergency.chatByCode.invalidate({ publicCode });
    },
  });

  return (
    <section className="glass-card mt-4 p-4 border border-[#E2E8F0]/40 dark:border-white/10 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#1D4ED8]/25 dark:text-[#F1F5F9]">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">{t("Message your rescue team")}</h2>
          <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
            {active ? t("Use short, useful updates") : t("This SOS is resolved")}
          </p>
        </div>
      </div>
      <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
        {messages.data?.length ? (
          messages.data.map((item) => (
            <div
              key={item.id}
              className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-5 ${item.authorType === "victim"
                ? "ml-auto bg-[#1D4ED8] text-white shadow-xs"
                : "bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]/40 dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:border-white/10"
                }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wide opacity-80">
                {item.authorType === "rescuer" ? t("Rescuer") : item.authorType === "operations" ? t("Operations") : t("You")}
              </span>
              {item.message}
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-[#F1F5F9]/80 dark:bg-[#1E293B]/60 px-3 py-2 text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
            {t("Your assigned rescue team will see messages here.")}
          </p>
        )}
      </div>
      {active && (
        user ? (
          <div className="mt-3 flex gap-2">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              placeholder={t("Type a short update")}
              className="h-10 bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:border-white/15 text-xs rounded-xl"
            />
            <Button
              disabled={!message.trim() || send.isPending}
              onClick={() => send.mutate({ publicCode, message: message.trim() })}
              className="h-10 w-10 shrink-0 rounded-xl bg-[#1D4ED8] hover:bg-[#1d47db] text-white p-0 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => startLogin()}
            className="mt-3 w-full rounded-xl bg-[#1D4ED8] hover:bg-[#1d47db] px-3 py-2.5 text-xs font-black text-white shadow-md shadow-[#1D4ED8]/25 transition"
          >
            {t("Sign in to send a message")}
          </button>
        )
      )}
      {send.error && <p className="mt-2 text-[10px] font-bold text-destructive">{send.error.message}</p>}
    </section>
  );
}

export function AssignedRescuerCard({
  rescuer,
  hospital,
  liveRescuer,
  liveRoute,
  isStale,
  lastEventAt: _lastEventAt,
}: {
  rescuer: AssignedRescuer;
  hospital?: { id: number; name: string; address: string; contactPhone: string | null; specialty: string; latitude: number; longitude: number } | null;
  liveRescuer?: { latitude: number; longitude: number; locationStatus: string; updatedAt: Date } | null;
  liveRoute?: { distanceKm: number; distanceText: string; durationMinutes: number; etaText: string; isApproximate: boolean; coordinates: [number, number][] } | null;
  isStale?: boolean;
  lastEventAt?: Date | null;
}) {
  const { t } = useLanguage();
  const [secondsAgo, setSecondsAgo] = useState(0);

  const effectiveLat = liveRescuer?.latitude ?? rescuer.location?.latitude;
  const effectiveLng = liveRescuer?.longitude ?? rescuer.location?.longitude;
  const effectiveRoute = liveRoute ?? (rescuer as any).route;
  const effectiveLocationStatus = (liveRescuer?.locationStatus ?? rescuer.locationStatus) as "live" | "paused" | "off";
  const updatedAt = liveRescuer?.updatedAt ?? rescuer.location?.updatedAt;

  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => setSecondsAgo(Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  const isArriving = effectiveRoute && effectiveRoute.distanceKm < ARRIVING_DISTANCE_KM;

  const locationLabel = (() => {
    if (isStale || secondsAgo > LIVE_LOCATION_STALE_THRESHOLD_MS / 1000) return `Last location ${secondsAgo}s ago`;
    if (effectiveLocationStatus === "live") return `Live GPS · Updated ${secondsAgo}s ago`;
    if (effectiveLocationStatus === "paused") return "Waiting for next location update";
    return "Location sharing starts after assignment";
  })();

  return (
    <section className="glass-panel mt-6 overflow-hidden border border-[#E2E8F0]/30 dark:border-white/10 shadow-md">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#1D4ED8]/25 dark:text-[#F1F5F9]">
            {rescuer.photoUrl ? (
              <img src={rescuer.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#1D4ED8] dark:text-[#F1F5F9] font-bold">{t("Your assigned rescuer")}</p>
            <h2 className="mt-1 text-lg font-black text-[#0F172A] dark:text-[#F8FAFC]">{rescuer.callSign}</h2>
            {rescuer.name && <p className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1]">{rescuer.name}</p>}
          </div>
        </div>
        {rescuer.phone ? (
          <a
            href={`tel:${rescuer.phone}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1D4ED8] hover:bg-[#1d47db] px-4 text-sm font-extrabold text-white shadow-md shadow-[#1D4ED8]/25 transition"
          >
            <Phone className="mr-2 h-4 w-4" /> {t("Call rescuer")}
          </a>
        ) : (
          <span className="rounded-xl border border-[#E2E8F0]/40 bg-white/80 dark:bg-[#1E293B]/80 dark:border-white/10 px-3 py-2 text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
            {t("Contact is shared when the responder enables it")}
          </span>
        )}
      </div>

      {effectiveRoute && (
        <div className={`border-t border-[#E2E8F0]/30 dark:border-white/10 p-4 ${isArriving ? "bg-emerald-500/10 dark:bg-emerald-950/30" : "bg-[#F1F5F9]/70 dark:bg-[#1E293B]/50"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-[#0F172A] dark:text-[#F8FAFC]">
                {isArriving ? "🏁 Arriving now" : `${effectiveRoute.isApproximate ? "~" : ""}${effectiveRoute.etaText}`}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#475569] dark:text-[#CBD5E1]">
                {effectiveRoute.distanceText} away{effectiveRoute.isApproximate ? " (estimated)" : ""}
              </p>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${isStale || secondsAgo > LIVE_LOCATION_STALE_THRESHOLD_MS / 1000
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                : effectiveLocationStatus === "live"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
            >
              {isStale || secondsAgo > LIVE_LOCATION_STALE_THRESHOLD_MS / 1000 ? (
                <>
                  <WifiOff className="h-3 w-3" /> Stale
                </>
              ) : effectiveLocationStatus === "live" ? (
                <>
                  <Wifi className="h-3 w-3" /> Live
                </>
              ) : (
                <>
                  <Clock3 className="h-3 w-3" /> Paused
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {hospital && (
        <div className="border-t border-[#E2E8F0]/30 dark:border-white/10 bg-[#EFF6FF]/60 dark:bg-[#1E293B]/60 p-3.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]">
          <div className="flex items-center gap-2 font-black text-sm text-[#1D4ED8] dark:text-[#F1F5F9]">
            <span>🏥</span> <span>Destination Hospital: {hospital.name}</span>
          </div>
          <p className="mt-1 text-[#334155] dark:text-[#CBD5E1]">📍 {hospital.address} · Specialty: {hospital.specialty}</p>
          {hospital.contactPhone && (
            <p className="mt-1 font-bold">
              📞 Desk:{" "}
              <a href={`tel:${hospital.contactPhone}`} className="underline font-black text-[#1D4ED8] dark:text-[#F1F5F9]">
                {hospital.contactPhone}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="border-t border-[#E2E8F0]/30 dark:border-white/10 bg-white/70 dark:bg-[#0F172A]/70 p-4">
        <div className="flex items-center gap-2">
          <Radio
            className={`h-4 w-4 ${effectiveLocationStatus === "live" && !isStale ? "animate-pulse text-[#1D4ED8] dark:text-[#F1F5F9]" : "text-muted-foreground"
              }`}
          />
          <p className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">{locationLabel}</p>
        </div>
        {effectiveLat !== undefined && effectiveLng !== undefined ? (
          <>
            <p className="mt-1 text-xs leading-5 text-[#475569] dark:text-[#94A3B8]">
              {t("This position is visible while the assigned mission is active.")}
            </p>
            <LiveRescuerMap
              latitude={effectiveLat!}
              longitude={effectiveLng!}
              destination={rescuer.destination}
              hospital={hospital}
              roadCoordinates={effectiveRoute?.coordinates ?? null}
              etaText={effectiveRoute ? `${effectiveRoute.isApproximate ? "~" : ""}${effectiveRoute.etaText}` : null}
            />
          </>
        ) : (
          <p className="mt-1 text-xs leading-5 text-[#475569] dark:text-[#94A3B8]">
            {t("The rescuer's position begins updating automatically when their assigned mission is active.")}
          </p>
        )}
      </div>
    </section>
  );
}

export function PostRescueCheckInCard({ publicCode }: { publicCode: string }) {
  const { t: _t } = useLanguage();
  const utils = trpc.useUtils();
  const existingCheckIn = trpc.rescue.emergency.myCheckInByCode.useQuery({ publicCode });
  const submitCheckIn = trpc.rescue.emergency.submitPostRescueCheckIn.useMutation({
    onSuccess: () => {
      void utils.rescue.emergency.myCheckInByCode.invalidate({ publicCode });
    },
  });

  const [allotted, setAllotted] = useState<"yes" | "no">("no");
  const [helpCategory, setHelpCategory] = useState<"medical" | "trapped" | "evacuation" | "other">("evacuation");
  const [notes, setNotes] = useState("");

  if (existingCheckIn.data) {
    const c = existingCheckIn.data;
    return (
      <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/40 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-base font-black">Post-Rescue Check-in Recorded</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#334155] dark:text-[#CBD5E1]">
          Thank you for confirming your post-rescue status. Relief operations and field coordinators have received your response.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white dark:bg-[#1E293B] p-3 border border-[#E2E8F0]/40 dark:border-white/10">
            <span className="font-bold text-muted-foreground block text-[10px] uppercase">Relief Centre Allotted</span>
            <span className="font-black text-sm text-[#1D4ED8] dark:text-[#F1F5F9] uppercase">{c.reliefCentreAllotted}</span>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#1E293B] p-3 border border-[#E2E8F0]/40 dark:border-white/10">
            <span className="font-bold text-muted-foreground block text-[10px] uppercase">Category Details</span>
            <span className="font-black text-sm text-[#1D4ED8] dark:text-[#F1F5F9] uppercase">{c.helpCategory}</span>
          </div>
        </div>
        {c.notes && (
          <p className="mt-2.5 rounded-xl bg-white dark:bg-[#1E293B] p-3 text-xs text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0]/40 dark:border-white/10 leading-relaxed">
            <strong>Notes:</strong> {c.notes}
          </p>
        )}
      </section>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCheckIn.mutate({
      publicCode,
      reliefCentreAllotted: allotted,
      helpCategory,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <section className="glass-card mt-6 p-5 border border-[#E2E8F0]/40 dark:border-white/10 shadow-sm">
      <div className="flex items-center gap-2 text-[#0F172A] dark:text-[#F8FAFC]">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-base font-black">Post-Rescue Check-in</h2>
      </div>
      <p className="mt-1 text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
        Please complete this quick safety check-in to confirm your ongoing relief needs with the response team.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
            Were you allotted a relief centre?
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAllotted("yes")}
              className={`rounded-xl py-2.5 text-xs font-extrabold transition border ${allotted === "yes" ? "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs" : "bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:border-white/10 hover:bg-[#F1F5F9]/60"
                }`}
            >
              ✓ Yes, Allotted
            </button>
            <button
              type="button"
              onClick={() => setAllotted("no")}
              className={`rounded-xl py-2.5 text-xs font-extrabold transition border ${allotted === "no" ? "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs" : "bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:border-white/10 hover:bg-[#F1F5F9]/60"
                }`}
            >
              ✕ No, Not Yet
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
            Additional Details & Category
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["medical", "Medical help"],
                ["trapped", "Trapped / evacuation"],
                ["evacuation", "Shelter / relocation"],
                ["other", "Other support"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setHelpCategory(val)}
                className={`rounded-xl p-2.5 text-left text-xs font-bold transition border ${helpCategory === val ? "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs" : "bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:border-white/10 hover:bg-[#F1F5F9]/60"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
            Notes & Field Requirements (Optional)
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Specify any immediate medical requirements, family member locations, or camp details…"
            maxLength={2000}
            className="mt-1.5 min-h-20 bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:border-white/15 text-xs rounded-xl"
          />
        </div>

        <Button
          type="submit"
          disabled={submitCheckIn.isPending}
          className="w-full rounded-xl bg-[#1D4ED8] hover:bg-[#1d47db] text-white font-black text-xs h-11 shadow-md shadow-[#1D4ED8]/25 transition"
        >
          {submitCheckIn.isPending ? "Submitting Check-in…" : "Submit Post-Rescue Details"}
        </Button>
        {submitCheckIn.error && (
          <p className="text-xs text-destructive font-semibold">{submitCheckIn.error.message}</p>
        )}
      </form>
    </section>
  );
}

function LiveRescuerMap({
  latitude,
  longitude,
  destination,
  hospital,
  roadCoordinates,
  etaText,
}: {
  latitude: number;
  longitude: number;
  destination?: { latitude: number; longitude: number };
  hospital?: { name: string; latitude: number; longitude: number } | null;
  roadCoordinates?: [number, number][] | null;
  etaText?: string | null;
}) {
  const { t } = useLanguage();
  const mapRef = useRef<google.maps.Map | null>(null);
  const leafletMapRef = useRef<any>(null);
  const rescuerMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const leafletRescuerRef = useRef<any>(null);
  const leafletRouteRef = useRef<any>(null);
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const rescuerPosition = { lat: latitude, lng: longitude };
  const targetPosition = hospital ? { lat: hospital.latitude, lng: hospital.longitude } : (destination ? { lat: destination.latitude, lng: destination.longitude } : null);

  const createEndpointPin = useCallback((kind: "user" | "rescuer" | "hospital") => {
    if (!window.google?.maps?.marker?.PinElement) return { element: document.createElement("div") };
    const { PinElement } = window.google.maps.marker;
    if (kind === "hospital") return new PinElement({ background: "#0f766e", borderColor: "#ffffff", glyph: "H", glyphColor: "#ffffff", scale: 1.15 });
    return kind === "user"
      ? new PinElement({ background: "#1a73e8", borderColor: "#ffffff", scale: 1.15 })
      : new PinElement({ background: "#d23f43", borderColor: "#ffffff", glyph: "R", glyphColor: "#ffffff", scale: 1.15 });
  }, []);

  const drawRoute = useCallback((map: google.maps.Map) => {
    if (!targetPosition || !window.google?.maps) { setRouteSummary(null); return; }
    const maps = window.google.maps;
    new maps.DirectionsService().route({ origin: rescuerPosition, destination: targetPosition, travelMode: maps.TravelMode.DRIVING }, (result: any, status: any) => {
      const leg = result?.routes?.[0]?.legs?.[0];
      const path = result?.routes?.[0]?.overview_path;
      if (status !== "OK" || !result || !leg || !path?.length) { routePolylineRef.current?.setMap(null); routePolylineRef.current = null; setRouteSummary(etaText || null); return; }
      routePolylineRef.current?.setMap(null);
      routePolylineRef.current = new maps.Polyline({ map, path, strokeColor: "#d23f43", strokeOpacity: 1, strokeWeight: 7, geodesic: true, zIndex: 100 });
      map.fitBounds(result.routes[0].bounds);
      setRouteSummary(`${leg.duration?.text || t("ETA unavailable")} · ${leg.distance?.text || t("Route calculated")}`);
    });
  }, [rescuerPosition.lat, rescuerPosition.lng, targetPosition?.lat, targetPosition?.lng, etaText, t]);

  const placeMarkers = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter(rescuerPosition);
    map.setZoom(15);
    if (window.google?.maps?.marker?.AdvancedMarkerElement) {
      rescuerMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map, position: rescuerPosition, title: "Assigned rescuer", content: createEndpointPin("rescuer").element });
      if (targetPosition) destinationMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map, position: targetPosition, title: "Your SOS location", content: createEndpointPin(hospital ? "hospital" : "user").element });
    }
    drawRoute(map);
  }, [createEndpointPin, drawRoute, rescuerPosition.lat, rescuerPosition.lng, targetPosition?.lat, targetPosition?.lng, hospital, t]);

  const handleLeafletReady = useCallback(async (lMap: any) => {
    const L = (await import("leaflet")).default;
    leafletMapRef.current = lMap;
    const group = L.layerGroup().addTo(lMap);

    const rescuerIcon = L.divIcon({
      className: "rescuer-pin",
      html: `<div style="background:#174e46;color:#fff;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);font-size:16px;transition:transform 0.4s ease;">🛡️</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const rMarker = L.marker([latitude, longitude], { icon: rescuerIcon, title: "Assigned rescuer" });
    rMarker.bindPopup(`<strong style="color:#174e46;">${t("Assigned Rescuer")}</strong><br/><span>${t("En route")}</span>`);
    group.addLayer(rMarker);
    leafletRescuerRef.current = rMarker;

    if (targetPosition) {
      const destIcon = L.divIcon({
        className: "dest-pin",
        html: `<div style="background:${hospital ? "#0f766e" : "#c94b45"};color:#fff;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);font-size:16px;">${hospital ? "🏥" : "🚨"}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const sMarker = L.marker([targetPosition.lat, targetPosition.lng], { icon: destIcon, title: "Your SOS location" });
      sMarker.bindPopup(`<strong style="color:#174e46;">${hospital?.name || t("Your SOS Location")}</strong>`);
      group.addLayer(sMarker);

      const routeCoords: [number, number][] = roadCoordinates?.length
        ? roadCoordinates
        : [[latitude, longitude], [targetPosition.lat, targetPosition.lng]];

      const routeLine = L.polyline(routeCoords, {
        color: "#d23f43",
        weight: 6,
        opacity: 0.85,
        dashArray: roadCoordinates?.length ? undefined : "8, 8",
      });
      group.addLayer(routeLine);
      leafletRouteRef.current = routeLine;
      lMap.fitBounds(L.latLngBounds(routeCoords), { padding: [40, 40] });
      setRouteSummary(etaText || "Route active.");
    }
  }, [latitude, longitude, targetPosition, hospital, roadCoordinates, etaText, t]);

  useEffect(() => {
    if (mapRef.current && window.google?.maps?.marker?.AdvancedMarkerElement) {
      if (rescuerMarkerRef.current) rescuerMarkerRef.current.position = rescuerPosition;
      if (targetPosition) {
        if (destinationMarkerRef.current) destinationMarkerRef.current.position = targetPosition;
        else destinationMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, position: targetPosition, title: "Your SOS location", content: createEndpointPin(hospital ? "hospital" : "user").element });
      }
      drawRoute(mapRef.current);
    }
  }, [createEndpointPin, drawRoute, rescuerPosition.lat, rescuerPosition.lng, targetPosition?.lat, targetPosition?.lng, hospital, t]);

  useEffect(() => {
    if (!leafletRescuerRef.current) return;
    leafletRescuerRef.current.setLatLng([latitude, longitude]);
    if (leafletRouteRef.current && roadCoordinates?.length) {
      leafletRouteRef.current.setLatLngs(roadCoordinates);
      if (etaText) setRouteSummary(etaText);
    }
  }, [latitude, longitude, roadCoordinates, etaText]);

  return (
    <>
      <MapView className="mt-3 h-60 overflow-hidden rounded-xl" initialCenter={rescuerPosition} initialZoom={15} onMapReady={placeMarkers} onLeafletReady={handleLeafletReady} />
      {routeSummary && (
        <p className="mt-2 flex items-center gap-2 rounded-xl bg-[#fff5f3] px-3 py-2 text-xs font-bold text-[#a43f3d]">
          <Navigation className="h-4 w-4" />Live route · ETA: {routeSummary}
        </p>
      )}
    </>
  );
}
