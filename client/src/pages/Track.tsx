import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { VictimNavigation } from "@/pages/Home";
import { getLatestSos } from "@/lib/rapidSos";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, MessageCircle, Navigation, Phone, Radio, Search, Send, ShieldCheck, Siren, UserRound, UsersRound } from "lucide-react";
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type AssignedRescuer = { callSign: string; name: string | null; photoUrl: string | null; phone: string | null; locationStatus: "live" | "paused" | "off"; location: { latitude: number; longitude: number; updatedAt: Date } | null; destination?: { latitude: number; longitude: number } };

export default function Track() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const initialCode = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code")?.toUpperCase() : "") || getLatestSos() || "";
  const [code, setCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState(initialCode);
  const status = trpc.rescue.emergency.statusByCode.useQuery({ publicCode: submittedCode }, { enabled: /^SOS-[A-Z0-9]{8}$/.test(submittedCode), refetchInterval: 5_000, retry: false });
  const stages = useMemo(() => [
    { key: "pending", short: t("track.seen"), label: t("track.pending"), icon: Siren, tone: "bg-[#fff2d9] text-[#9b6615]" },
    { key: "dispatched", short: t("track.moving"), label: t("track.dispatched"), icon: Radio, tone: "bg-[#e3eefb] text-[#255c7d]" },
    { key: "resolved", short: t("track.done"), label: t("track.resolved"), icon: CheckCircle2, tone: "bg-[#d9f3e8] text-[#19755f]" },
  ] as const, [t]);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("code")?.toUpperCase() || getLatestSos() || "";
    if (fromUrl) {
      setCode(fromUrl);
      setSubmittedCode(fromUrl);
    }
  }, [window.location.search]);
  const search = (event: FormEvent) => { event.preventDefault(); setSubmittedCode(code.trim().toUpperCase()); };
  const activeIndex = status.data ? Math.max(0, stages.findIndex(stage => stage.key === status.data!.status)) : 0;
  const current = stages[activeIndex];
  const CurrentIcon = current.icon;
  return <div className="min-h-screen bg-[#f6f8f7]"><main className="mx-auto min-h-screen max-w-lg bg-[#fcfdfd] px-5 pb-28 pt-6 md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border"><header className="flex items-start justify-between"><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-left"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#174e46] text-white"><ArrowLeft className="h-5 w-5" /></span><span><span className="block text-xl font-black tracking-[-.05em]">{t("track.heading")}</span><span className="block text-[10px] font-bold text-[#6b8780]">{t("track.private")}</span></span></button><LanguageSelector compact /></header><form onSubmit={search} className="mt-7 flex gap-2 rounded-[1.35rem] bg-white p-2 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035]"><Input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="SOS-XXXXXXXX" aria-label={t("track.code")} className="h-11 border-0 font-mono font-medium shadow-none focus-visible:ring-0" /><Button type="submit" className="h-11 rounded-xl bg-[#174e46]"><Search className="h-4 w-4" /></Button></form>{status.isFetching && <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5 animate-spin" /> {t("track.checking")}</p>}{status.error && <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-[#f3c4c1] bg-[#fff5f4] p-4 text-sm text-[#a53d38]"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{status.error.message}</p></div>}{status.data && <section className="mt-5 overflow-hidden rounded-[1.8rem] bg-white shadow-[0_18px_40px_-28px_rgb(21_75_67/0.35)] ring-1 ring-black/[.035]"><div className="bg-[#174e46] p-5 text-white"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b1dbd1]">{t("track.yourSos")}</p><p className="mt-1 font-mono text-lg">{status.data.publicCode}</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold">{t("track.liveCheck")}</span></div><div className="mt-5 flex items-center gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm"><CurrentIcon className="h-8 w-8 text-white" /></div><div><div className="flex items-center gap-2 text-[#b9ddd5]"><CurrentIcon className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">{t("track.now")}</span></div><p className="mt-2 text-xl font-extrabold leading-tight">{current.label}</p></div></div></div><div className="p-4"><div className="grid grid-cols-3 gap-2">{stages.map((stage, index) => { const Icon = stage.icon; const complete = index <= activeIndex; return <div key={stage.key} className={`rounded-2xl p-3 text-center ${complete ? stage.tone : "bg-muted text-muted-foreground"}`}><Icon className="mx-auto h-5 w-5" /><span className="mt-2 block text-xs font-extrabold">{stage.short}</span></div>; })}</div><div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f0faf6] p-3 text-sm font-semibold text-[#285f55]"><MapPin className="h-5 w-5 shrink-0 text-primary" /><span>{status.data.locationLabel}</span></div>{status.data.assignedRescuer && <AssignedRescuerCard rescuer={status.data.assignedRescuer} />}<RequestDetails publicCode={status.data.publicCode} active={status.data.status !== "resolved"} /><IncidentChat publicCode={status.data.publicCode} active={status.data.status !== "resolved"} /><div className="mt-4 rounded-xl border border-[#b8ded4] bg-[#f8fcfa] p-3 text-xs leading-5 text-[#285f55]"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" /> {t("track.safetyNote")}</div></div></section>}</main><VictimNavigation current="track" /></div>;
}

export function RequestDetails({ publicCode, active }: { publicCode: string; active: boolean }) {
  const { user } = useAuth(); const { t } = useLanguage(); const [open, setOpen] = useState(false); const [peopleAffected, setPeopleAffected] = useState(1); const [emergencyType, setEmergencyType] = useState<"flood" | "medical" | "trapped" | "evacuation" | "other">("flood"); const [helpNeeds, setHelpNeeds] = useState(""); const [notes, setNotes] = useState(""); const utils = trpc.useUtils(); const details = trpc.rescue.emergency.myDetailsByCode.useQuery({ publicCode }, { enabled: Boolean(user && open), retry: false }); const update = trpc.rescue.emergency.updateMyDetails.useMutation({ onSuccess: () => { setOpen(false); void utils.rescue.emergency.myDetailsByCode.invalidate({ publicCode }); } });
  useEffect(() => { if (details.data) { setPeopleAffected(details.data.peopleAffected); setEmergencyType(details.data.emergencyType); setHelpNeeds(details.data.helpNeeds || ""); setNotes(details.data.notes || ""); } }, [details.data]);
  if (!active) return null;
  if (!user) return <button onClick={() => startLogin()} className="mt-4 w-full rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] px-4 py-3 text-sm font-extrabold text-primary">{t("Sign in to add request details")}</button>;
  if (!open) return <button onClick={() => setOpen(true)} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] p-4 text-left"><span><span className="block text-sm font-extrabold text-[#173d37]">{t("Add more details")}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{t("People with you, help needed, and useful updates for responders.")}</span></span><UsersRound className="h-5 w-5 text-primary" /></button>;
  if (details.error) return null;
  return <section className="mt-4 rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-[#173d37]">{t("Add request details")}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Your SOS is already active. These updates help the assigned team prepare.")}</p></div><button onClick={() => setOpen(false)} className="text-xs font-extrabold text-primary">{t("Close")}</button></div><div className="mt-4"><p className="text-xs font-bold text-[#58746c]">{t("People needing help")}</p><div className="mt-2 flex items-center gap-3"><Button type="button" variant="outline" onClick={() => setPeopleAffected(value => Math.max(1, value - 1))} className="h-10 w-10 rounded-xl p-0">−</Button><output className="grid h-10 min-w-12 place-items-center rounded-xl bg-white text-lg font-black text-primary">{peopleAffected}</output><Button type="button" variant="outline" onClick={() => setPeopleAffected(value => Math.min(500, value + 1))} className="h-10 w-10 rounded-xl p-0">+</Button></div></div><div className="mt-4"><p className="text-xs font-bold text-[#58746c]">{t("What help do you need?")}</p><div className="mt-2 grid grid-cols-2 gap-2">{([['flood', t('Flood rescue')],['medical', t('Medical help')],['trapped', t('Trapped / evacuation')],['evacuation', t('Shelter / relocation')],['other', t('Other')]] as const).map(([value, label]) => <button key={value} onClick={() => setEmergencyType(value as any)} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-extrabold ${emergencyType === value ? "border-primary bg-white text-primary" : "border-transparent bg-white text-[#5f776f]"}`}>{label}</button>)}</div></div><div className="mt-4 grid gap-3"><Textarea value={helpNeeds} onChange={event => setHelpNeeds(event.target.value)} maxLength={1000} placeholder={t("For example: boat needed, urgent medicine, elderly person, food and water")} className="min-h-18 bg-white text-xs" /><Textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} placeholder={t("Optional extra detail for the rescue team")} className="min-h-18 bg-white text-xs" /></div><Button disabled={update.isPending || details.isLoading} onClick={() => update.mutate({ publicCode, peopleAffected, emergencyType, helpNeeds: helpNeeds.trim() || undefined, notes: notes.trim() || undefined })} className="mt-4 w-full rounded-xl bg-[#174e46]">{update.isPending ? t("Saving update…") : t("Save details for rescue team")}</Button>{update.error && <p className="mt-2 text-xs font-semibold text-destructive">{update.error.message}</p>}</section>;
}

export function IncidentChat({ publicCode, active }: { publicCode: string; active: boolean }) {
  const { user } = useAuth(); const { t } = useLanguage(); const [message, setMessage] = useState(""); const utils = trpc.useUtils();
  const messages = trpc.rescue.emergency.chatByCode.useQuery({ publicCode }, { refetchInterval: 5_000, retry: false });
  const send = trpc.rescue.emergency.sendChat.useMutation({ onSuccess: () => { setMessage(""); void utils.rescue.emergency.chatByCode.invalidate({ publicCode }); } });
  return <section className="mt-4 rounded-2xl border border-[#d8e8e2] bg-[#fbfefd] p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#e7f6ef] text-primary"><MessageCircle className="h-4 w-4" /></span><div><h2 className="text-sm font-black">{t("Message your rescue team")}</h2><p className="text-[10px] font-semibold text-[#708981]">{active ? t("Use short, useful updates") : t("This SOS is resolved")}</p></div></div><div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">{messages.data?.length ? messages.data.map(item => <div key={item.id} className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${item.authorType === "victim" ? "ml-auto bg-[#174e46] text-white" : "bg-[#eef7f4] text-[#24564b]"}`}><span className="block text-[9px] font-black uppercase tracking-wide opacity-70">{item.authorType === "rescuer" ? t("Rescuer") : item.authorType === "operations" ? t("Operations") : t("You")}</span>{item.message}</div>) : <p className="rounded-xl bg-[#f3f7f5] px-3 py-2 text-xs text-[#748a83]">{t("Your assigned rescue team will see messages here.")}</p>}</div>{active && (user ? <div className="mt-3 flex gap-2"><Input value={message} onChange={event => setMessage(event.target.value)} maxLength={500} placeholder={t("Type a short update")} className="h-10 bg-white text-xs" /><Button disabled={!message.trim() || send.isPending} onClick={() => send.mutate({ publicCode, message: message.trim() })} className="h-10 w-10 shrink-0 rounded-xl bg-[#174e46] p-0"><Send className="h-4 w-4" /></Button></div> : <button onClick={() => startLogin()} className="mt-3 w-full rounded-xl bg-[#174e46] px-3 py-2.5 text-xs font-black text-white">{t("Sign in to send a message")}</button>)}{send.error && <p className="mt-2 text-[10px] font-bold text-destructive">{send.error.message}</p>}</section>;
}

export function AssignedRescuerCard({ rescuer }: { rescuer: AssignedRescuer }) { const { t } = useLanguage(); return <section className="mt-6 overflow-hidden rounded-2xl border border-[#b8ded4] bg-[#f8fcfa]"><div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#d9f3e8] text-primary">{rescuer.photoUrl ? <img src={rescuer.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6" />}</div><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("Your assigned rescuer")}</p><h2 className="mt-1 text-lg font-extrabold text-[#173d37]">{rescuer.callSign}</h2>{rescuer.name && <p className="text-sm text-muted-foreground">{rescuer.name}</p>}</div></div>{rescuer.phone ? <a href={`tel:${rescuer.phone}`} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground"><Phone className="mr-2 h-4 w-4" /> {t("Call rescuer")}</a> : <span className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground">{t("Contact is shared when the responder enables it")}</span>}</div><div className="border-t border-[#cbe8df] bg-white/70 p-4"><div className="flex items-center gap-2"><Radio className={`h-4 w-4 ${rescuer.locationStatus === "live" ? "animate-pulse text-primary" : "text-muted-foreground"}`} /><p className="text-sm font-extrabold text-[#173d37]">{rescuer.locationStatus === "live" ? t("Live rescuer location · updating every 5 seconds") : rescuer.locationStatus === "paused" ? t("Waiting for the next automatic location update") : t("Location sharing starts automatically after assignment")}</p></div>{rescuer.location ? <><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("This position is visible only while the assigned mission is active.")}</p><LiveRescuerMap latitude={rescuer.location.latitude} longitude={rescuer.location.longitude} destination={rescuer.destination} /></> : <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("The rescuer’s position begins updating automatically when their assigned mission is active.")}</p>}</div></section>; }

function LiveRescuerMap({ latitude, longitude, destination }: { latitude: number; longitude: number; destination?: { latitude: number; longitude: number } }) {
  const { t } = useLanguage();
  const mapRef = useRef<google.maps.Map | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const rescuerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destinationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const leafletRouteRef = useRef<L.Polyline | null>(null);
  const leafletMarkersRef = useRef<L.LayerGroup | null>(null);
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const rescuerPosition = { lat: latitude, lng: longitude };
  const sosPosition = destination ? { lat: destination.latitude, lng: destination.longitude } : null;

  const createEndpointPin = useCallback((kind: "user" | "rescuer") => {
    if (!window.google?.maps?.marker?.PinElement) return { element: document.createElement("div") };
    const { PinElement } = window.google.maps.marker;
    return kind === "user"
      ? new PinElement({ background: "#1a73e8", borderColor: "#ffffff", scale: 1.15 })
      : new PinElement({ background: "#d23f43", borderColor: "#ffffff", glyph: "R", glyphColor: "#ffffff", scale: 1.15 });
  }, []);

  const drawRoute = useCallback((map: google.maps.Map) => {
    if (!sosPosition || !window.google?.maps) { setRouteSummary(null); return; }
    const maps = window.google.maps;
    new maps.DirectionsService().route({ origin: rescuerPosition, destination: sosPosition, travelMode: maps.TravelMode.DRIVING }, (result: any, status: any) => {
      const leg = result?.routes?.[0]?.legs?.[0];
      const path = result?.routes?.[0]?.overview_path;
      if (status !== "OK" || !result || !leg || !path?.length) { routePolylineRef.current?.setMap(null); routePolylineRef.current = null; setRouteSummary("Route estimate is temporarily unavailable."); return; }
      routePolylineRef.current?.setMap(null);
      routePolylineRef.current = new maps.Polyline({ map, path, strokeColor: "#d23f43", strokeOpacity: 1, strokeWeight: 7, geodesic: true, zIndex: 100 });
      map.fitBounds(result.routes[0].bounds);
      setRouteSummary(`${leg.duration?.text || t("ETA unavailable")} · ${leg.distance?.text || t("Route calculated")}`);
    });
  }, [rescuerPosition.lat, rescuerPosition.lng, sosPosition?.lat, sosPosition?.lng, t]);

  const placeMarkers = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter(rescuerPosition);
    map.setZoom(15);
    if (window.google?.maps?.marker?.AdvancedMarkerElement) {
      rescuerMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map, position: rescuerPosition, title: "Assigned rescuer", content: createEndpointPin("rescuer").element });
      if (sosPosition) destinationMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map, position: sosPosition, title: "Your SOS location", content: createEndpointPin("user").element });
    }
    drawRoute(map);
  }, [createEndpointPin, drawRoute, rescuerPosition.lat, rescuerPosition.lng, sosPosition?.lat, sosPosition?.lng, t]);

  const handleLeafletReady = useCallback(async (lMap: any) => {
    const L = (await import("leaflet")).default;
    leafletMapRef.current = lMap;
    const group = L.layerGroup().addTo(lMap);
    leafletMarkersRef.current = group;

    const rescuerIcon = L.divIcon({
      className: "rescuer-pin",
      html: `<div style="background:#174e46;color:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:14px;">🛡️</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const rMarker = L.marker([latitude, longitude], { icon: rescuerIcon, title: "Assigned rescuer" });
    rMarker.bindPopup(`<strong style="color:#174e46;">${t("Assigned Rescuer")}</strong><br/><span>${t("En route to your location")}</span>`);
    group.addLayer(rMarker);

    if (sosPosition) {
      const sosIcon = L.divIcon({
        className: "sos-pin",
        html: `<div style="background:#c94b45;color:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:14px;">🚨</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const sMarker = L.marker([sosPosition.lat, sosPosition.lng], { icon: sosIcon, title: "Your SOS location" });
      sMarker.bindPopup(`<strong style="color:#c94b45;">${t("Your SOS Location")}</strong>`);
      group.addLayer(sMarker);

      const route = L.polyline([[latitude, longitude], [sosPosition.lat, sosPosition.lng]], {
        color: "#d23f43",
        weight: 6,
        opacity: 0.85,
        dashArray: "8, 8",
      });
      group.addLayer(route);
      lMap.fitBounds(L.latLngBounds([[latitude, longitude], [sosPosition.lat, sosPosition.lng]]), { padding: [40, 40] });
      setRouteSummary("Route estimate is temporarily unavailable.");
    }
  }, [latitude, longitude, sosPosition, t]);

  useEffect(() => {
    if (mapRef.current && window.google?.maps?.marker?.AdvancedMarkerElement) {
      if (rescuerMarkerRef.current) rescuerMarkerRef.current.position = rescuerPosition;
      if (sosPosition) {
        if (destinationMarkerRef.current) destinationMarkerRef.current.position = sosPosition;
        else destinationMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, position: sosPosition, title: "Your SOS location", content: createEndpointPin("user").element });
      }
      drawRoute(mapRef.current);
    }
  }, [createEndpointPin, drawRoute, rescuerPosition.lat, rescuerPosition.lng, sosPosition?.lat, sosPosition?.lng, t]);

  return <><MapView className="mt-3 h-60 overflow-hidden rounded-xl" initialCenter={rescuerPosition} initialZoom={15} onMapReady={placeMarkers} onLeafletReady={handleLeafletReady} />{routeSummary && <p className="mt-2 flex items-center gap-2 rounded-xl bg-[#fff5f3] px-3 py-2 text-xs font-bold text-[#a43f3d]"><Navigation className="h-4 w-4" />Live route · ETA: {routeSummary}</p>}</>;
}
