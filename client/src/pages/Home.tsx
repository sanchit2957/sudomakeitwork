import { MapView } from "@/components/Map";
import LanguageSelector from "@/components/LanguageSelector";
import { FloodConditionsPanel } from "@/components/FloodConditionsPanel";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { blobToDataUrl, clearSosVoiceNote, readSosVoiceNote, saveSosVoiceNote, type SosVoiceNoteDraft } from "@/lib/sosVoiceNote";
import { flushOfflineSos, queueOfflineSos } from "@/lib/offlineSos";
import { createAndRedirectAfterRapidSos, redirectAfterRapidSos } from "@/lib/rapidSos";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { CloudRain, MapPin, Mic, MoreHorizontal, Navigation, PhoneCall, Radio, ShieldCheck, Siren, Square, ThermometerSun, Waves, Wifi, WifiOff } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type Point = { latitude: number; longitude: number };
const guwahati: Point = { latitude: 26.1445, longitude: 91.7362 };

export default function Home() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [position, setPosition] = useState<Point | null>(null);
  const [manualLocation, setManualLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(true);
  const [locationStatus, setLocationStatus] = useState<"finding" | "ready" | "unavailable">("finding");
  const [rapidStatus, setRapidStatus] = useState<"idle" | "locating" | "sending" | "queued" | "error">("idle");
  const [rapidNotice, setRapidNotice] = useState("");

  const activeWeatherCoords = manualLocation
    ? { latitude: manualLocation.lat, longitude: manualLocation.lng }
    : position
    ? { latitude: position.latitude, longitude: position.longitude }
    : undefined;

  const conditions = trpc.rescue.emergency.conditions.useQuery(activeWeatherCoords || {}, { refetchInterval: 15 * 60_000, refetchOnWindowFocus: true });
  const createSos = trpc.rescue.emergency.create.useMutation();

  const handleLocationChange = (lat: number, lng: number, name: string) => {
    setManualLocation({ name, lat, lng });
    setIsGpsActive(false);
  };

  const handleGpsLocate = () => {
    setManualLocation(null);
    setIsGpsActive(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        result => { setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude }); setLocationStatus("ready"); },
        () => setLocationStatus("unavailable"),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      );
    }
  };

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    if (!navigator.geolocation) { setLocationStatus("unavailable"); return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); }; }
    navigator.geolocation.getCurrentPosition(
      result => { setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude }); setLocationStatus("ready"); },
      () => setLocationStatus("unavailable"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    if (!online || !user) return;
    void flushOfflineSos(payload => createSos.mutateAsync(payload)).then(result => {
      const deliveredCode = result.delivered[0];
      if (!deliveredCode) return;
      clearSosVoiceNote();
      setRapidStatus("idle");
      setRapidNotice("");
      redirectAfterRapidSos(deliveredCode, setLocation);
    });
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

      if (!navigator.onLine) {
        const guestKey = localStorage.getItem("sudo-makeitwork-guest-key") || crypto.randomUUID().replaceAll("-", "");
        localStorage.setItem("sudo-makeitwork-guest-key", guestKey);
        queueOfflineSos({ ...payload, guestKey });
        setRapidStatus("queued");
        setRapidNotice(t("SOS is saved on this phone and will send automatically when connection returns."));
        return;
      }

      try {
        setRapidStatus("sending");
        await createAndRedirectAfterRapidSos({ payload, createSos: createSos.mutateAsync, navigate: setLocation });
        clearSosVoiceNote();
        setRapidStatus("idle");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const isSafeInputMessage = /^(Voice notes|Evidence|Locations|Available beds)/.test(message);
        setRapidStatus("error");
        setRapidNotice(isSafeInputMessage ? t(message) : t("SOS could not be sent. Check connection and try again."));
      }
    };

    setRapidStatus("locating");
    setRapidNotice(t("Getting location to send SOS immediately…"));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        result => {
          submitSosWithCoords(result.coords.latitude, result.coords.longitude, t("GPS location captured from this phone"));
        },
        () => {
          const fallback = position || guwahati;
          submitSosWithCoords(fallback.latitude, fallback.longitude, t("Assam emergency coordinates"));
        },
        { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 }
      );
    } else {
      const fallback = position || guwahati;
      submitSosWithCoords(fallback.latitude, fallback.longitude, t("Assam emergency coordinates"));
    }
  };

  const activePoint = position || guwahati;
  return <div className="victim-page min-h-screen bg-[#f6f8f7] text-[#142c2b] dark:bg-[#050505] dark:text-[#f4f4f5]"><main className="victim-main relative mx-auto min-h-screen max-w-lg overflow-hidden bg-[#fcfdfd] px-5 pb-28 pt-6 shadow-2xl shadow-[#113c35]/10 dark:bg-[#101011] dark:shadow-black/30 md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border">
    <header className="flex items-start justify-between gap-3"><button onClick={() => setLocation("/")} className="text-left"><span className="block text-2xl font-black tracking-[-0.06em]">sudo <span className="text-[#da3e42]">MakeItWork</span></span><span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-[0.17em] text-[#63817b]">Assam safety companion</span></button><div className="flex flex-col items-end gap-2"><div className="flex items-center gap-1.5"><button onClick={() => setLocation("/login")} className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase text-[#0f766e] transition hover:bg-[#0f766e]/20 dark:text-emerald-400">{user ? user.role : "Sign in"}</button><LanguageSelector compact /></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${online ? "bg-[#dff6e7] text-[#197b55]" : "bg-[#fff1dd] text-[#9b6519]"}`}>{online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{online ? t("Connected") : t("Offline")}</span></div></header>

    <section className="mt-6 flex flex-col items-center"><button onClick={startRapidSos} disabled={authLoading || rapidStatus === "locating" || rapidStatus === "sending"} aria-label={t("Send SOS")} className="group isolate grid h-44 w-44 shrink-0 aspect-square place-items-center overflow-hidden rounded-[9999px] border border-white/55 bg-[linear-gradient(145deg,rgba(255,109,118,.91),rgba(209,47,55,.84)_55%,rgba(174,27,36,.9))] text-white ring-1 ring-[#ca3540]/25 backdrop-blur-md transition active:scale-[.975] disabled:cursor-wait disabled:opacity-80"><span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-3 h-16 rounded-full bg-white/25 blur-md" /><span className="relative z-10 grid place-items-center">{rapidStatus === "locating" || rapidStatus === "sending" ? <Radio className="mb-2 h-8 w-8 animate-pulse" /> : <Siren className="mb-1 h-7 w-7" />}<span className="text-5xl font-black tracking-[-0.08em]">SOS</span><span className="mt-1 text-xs font-bold">{rapidStatus === "locating" ? t("Getting location") : rapidStatus === "sending" ? t("Sending SOS") : user ? t("Tap for immediate help") : t("Sign in to activate")}</span></span></button><p className="mt-6 flex items-center gap-2 rounded-full bg-[#fff3ef] px-3 py-1.5 text-[11px] font-bold text-[#a43d3e]"><Waves className="h-3.5 w-3.5" />{t("Use this only for an emergency")}</p>{rapidNotice && <p role="status" className={`mt-3 max-w-xs text-center text-xs font-semibold leading-5 ${rapidStatus === "error" ? "text-[#b73f43]" : "text-[#38675d]"}`}>{rapidNotice}</p>}</section>

    <VoiceNoteCard />
    <LocationPreview point={activePoint} state={locationStatus} />
    <FloodConditionsPanel
      conditions={conditions.data}
      loading={conditions.isLoading}
      onRefresh={() => conditions.refetch()}
      onLocationChange={handleLocationChange}
      selectedLocationName={manualLocation?.name}
      isGpsActive={isGpsActive}
      onGpsLocate={handleGpsLocate}
    />
  </main><VictimNavigation current="home" /></div>;
}

export function RapidSosControl({ authenticated, authLoading, status, notice, onActivate }: { authenticated: boolean; authLoading: boolean; status: "idle" | "locating" | "sending" | "queued" | "error"; notice: string; onActivate: () => void }) {
  const { t } = useLanguage();
  return <section className="mt-6 flex flex-col items-center"><button onClick={onActivate} disabled={authLoading || status === "locating" || status === "sending"} aria-label={t("Send SOS")} className="group isolate grid h-44 w-44 shrink-0 aspect-square place-items-center overflow-hidden rounded-[9999px] border border-white/55 bg-[linear-gradient(145deg,rgba(255,109,118,.91),rgba(209,47,55,.84)_55%,rgba(174,27,36,.9))] text-white ring-1 ring-[#ca3540]/25 backdrop-blur-md transition active:scale-[.975] disabled:cursor-wait disabled:opacity-80"><span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-3 h-16 rounded-full bg-white/25 blur-md" /><span className="relative z-10 grid place-items-center">{status === "locating" || status === "sending" ? <Radio className="mb-2 h-8 w-8 animate-pulse" /> : <Siren className="mb-1 h-7 w-7" />}<span className="text-5xl font-black tracking-[-0.08em]">SOS</span><span className="mt-1 text-xs font-bold">{status === "locating" ? t("Getting location") : status === "sending" ? t("Sending SOS") : authenticated ? t("Tap for immediate help") : t("Sign in to activate")}</span></span></button><p className="mt-6 flex items-center gap-2 rounded-full bg-[#fff3ef] px-3 py-1.5 text-[11px] font-bold text-[#a43d3e]"><Waves className="h-3.5 w-3.5" />{t("Use this only for an emergency")}</p>{notice && <p role="status" className={`mt-3 max-w-xs text-center text-xs font-semibold leading-5 ${status === "error" ? "text-[#b73f43]" : "text-[#38675d]"}`}>{notice}</p>}</section>;
}

function VoiceNoteCard() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<SosVoiceNoteDraft | null>(() => readSosVoiceNote());
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMessage(t("Voice recording is not supported in this browser.")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(type => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = async () => { const durationSeconds = Math.max(1, Math.min(120, Math.round((Date.now() - startedAt.current) / 1000))); const audio = new Blob(chunks, { type: next.mimeType || "audio/webm" }); if (audio.size > 3_000_000) { setMessage(t("Voice note is too large. Please keep it short.")); return; } const saved = { dataUrl: await blobToDataUrl(audio), durationSeconds, createdAt: Date.now() }; saveSosVoiceNote(saved); setDraft(saved); setMessage(t("Voice note saved for your SOS.")); stream.getTracks().forEach(track => track.stop()); };
      recorder.current = next; startedAt.current = Date.now(); next.start(); setRecording(true); setMessage(t("Recording… tap again to stop."));
    } catch { setMessage(t("Microphone permission is needed to record a voice note.")); }
  };
  const stop = () => { recorder.current?.stop(); recorder.current = null; setRecording(false); };
  return <section className="mt-8 rounded-[1.55rem] bg-white p-3 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10"><div className="flex items-center gap-3"><button onClick={recording ? stop : start} className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white transition active:scale-95 ${recording ? "bg-[#df3e43]" : "bg-[#174e46]"}`}>{recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}</button><button onClick={recording ? stop : start} className="min-w-0 flex-1 text-left"><p className="text-sm font-extrabold">{recording ? t("Stop and save voice note") : draft ? t("Voice note ready") : t("Record voice note")}</p><p className="mt-0.5 text-xs text-[#708881] dark:text-[#b9b9c0]">{draft ? `${draft.durationSeconds}s · ${t("Attached to your next SOS")}` : t("Speak briefly if typing is difficult")}</p></button>{draft && !recording && <button onClick={() => { clearSosVoiceNote(); setDraft(null); setMessage(""); }} aria-label={t("Remove voice note")} className="rounded-xl bg-[#f3f6f5] px-3 py-2 text-[11px] font-bold text-[#617970] dark:bg-[#29292d] dark:text-[#ededf0]">{t("Clear")}</button>}</div>{message && <p className="px-2 pb-1 pt-3 text-[11px] font-semibold text-[#54746b] dark:text-[#b9b9c0]">{message}</p>}</section>;
}

function LocationPreview({ point, state }: { point: Point; state: "finding" | "ready" | "unavailable" }) {
  const { t } = useLanguage();
  const pointKey = `${point.latitude.toFixed(6)}-${point.longitude.toFixed(6)}`;
  return <section className="mt-5 overflow-hidden rounded-[1.55rem] bg-white p-3 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10"><div className="relative overflow-hidden rounded-[1.15rem]"><MapView key={pointKey} className="h-44" initialCenter={{ lat: point.latitude, lng: point.longitude }} initialZoom={14} onMapReady={map => { if ((window as any).google?.maps?.marker?.AdvancedMarkerElement) new (window as any).google.maps.marker.AdvancedMarkerElement({ map, position: { lat: point.latitude, lng: point.longitude }, title: "Your location" }); }} onLeafletReady={async lMap => { const L = (await import("leaflet")).default; const icon = L.divIcon({ className: "loc-pin", html: `<div style="background:#df3e43;color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:12px;">📍</div>`, iconSize: [24, 24], iconAnchor: [12, 24] }); L.marker([point.latitude, point.longitude], { icon }).addTo(lMap); }} /><div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-extrabold shadow-sm dark:bg-[#1a1a1c]/95">{t("Map preview")}</div></div><div className="flex items-center justify-between px-1 pt-3"><span className="flex items-center gap-2 text-xs font-bold text-[#2d514a] dark:text-[#ededf0]"><MapPin className="h-4 w-4 text-[#df3e43]" />{state === "ready" ? t("Your current location") : state === "finding" ? t("Finding your location") : t("Map centered on Assam")}</span><span className="font-mono text-[10px] font-bold text-[#6a867e] dark:text-[#b9b9c0]">{point.latitude.toFixed(4)}° N, {point.longitude.toFixed(4)}° E</span></div></section>;
}

function FloodConditions({ conditions, loading }: { conditions?: { available: boolean; risk: string; activeFloodZones: number; current: { temperatureC: number | null; precipitationMm: number | null; windKmh: number | null }; forecast: { rainChance: number | null; rainAmountMm: number | null } }; loading: boolean }) {
  const { t } = useLanguage();
  const riskTone = conditions?.risk === "high" ? "bg-[#fff0ee] text-[#b83f43]" : conditions?.risk === "elevated" ? "bg-[#fff5df] text-[#9a681d]" : "bg-[#e6f6ef] text-[#197654]";
  return <section className="mt-5 rounded-[1.55rem] bg-white p-5 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035]"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black tracking-[-0.04em]">{t("Local flood conditions")}</h2><p className="mt-0.5 text-[11px] font-semibold text-[#789087]">{loading ? t("Updating local forecast") : conditions?.available ? t("Weather model based") : t("Weather source unavailable")}</p></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${riskTone}`}>{conditions?.risk === "high" ? t("High rain risk") : conditions?.risk === "elevated" ? t("Watch conditions") : t("Normal")}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><Stat icon={CloudRain} label={t("Rain forecast")} value={conditions?.forecast.rainChance !== null && conditions?.forecast.rainChance !== undefined ? `${conditions.forecast.rainChance}%` : "—"} detail={conditions?.forecast.rainAmountMm !== null && conditions?.forecast.rainAmountMm !== undefined ? `${conditions.forecast.rainAmountMm} mm` : t("No reading")} /><Stat icon={ThermometerSun} label={t("Weather now")} value={conditions?.current.temperatureC !== null && conditions?.current.temperatureC !== undefined ? `${Math.round(conditions.current.temperatureC)}°` : "—"} detail={conditions?.current.windKmh !== null && conditions?.current.windKmh !== undefined ? `${Math.round(conditions.current.windKmh)} km/h wind` : t("No reading")} /></div><div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f1f8f5] px-3 py-3 text-xs font-bold text-[#315e52]"><Waves className="h-5 w-5 shrink-0 text-[#277b6b]" /><span>{conditions?.activeFloodZones ? `${conditions.activeFloodZones} ${t("active flood-zone alerts nearby")}` : t("No official river gauge is linked yet. Follow local authority alerts.")}</span></div></section>;
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof CloudRain; label: string; value: string; detail: string }) { return <div className="rounded-2xl bg-[#f7faf9] p-3"><Icon className="h-5 w-5 text-[#277b6b]" /><p className="mt-3 text-[11px] font-bold text-[#6f8880]">{label}</p><p className="mt-0.5 text-xl font-black tracking-[-0.04em]">{value}</p><p className="mt-0.5 text-[10px] font-semibold text-[#719087]">{detail}</p></div>; }

export function VictimNavigation({ current }: { current: "home" | "track" | "safety" | "more" }) { const [, setLocation] = useLocation(); const { t } = useLanguage(); const items = [{ id: "home" as const, icon: Siren, label: t("SOS"), path: "/" }, { id: "track" as const, icon: Navigation, label: t("Track"), path: "/track" }, { id: "safety" as const, icon: ShieldCheck, label: t("Safety"), path: "/safety" }, { id: "more" as const, icon: MoreHorizontal, label: t("More"), path: "/more" }]; return <nav aria-label="Victim App navigation" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg justify-around border-t border-[#e7edeb] bg-white/95 px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:bottom-6 md:rounded-[1.6rem] md:border md:shadow-xl">{items.map(({ id, icon: Icon, label, path }) => <button key={id} onClick={() => setLocation(path)} className={`grid min-w-16 place-items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-extrabold ${current === id ? "text-[#df3e43]" : "text-[#7b8f88]"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${current === id ? "bg-[#fff0ef]" : ""}`}><Icon className="h-5 w-5" /></span>{label}</button>)}</nav>; }
