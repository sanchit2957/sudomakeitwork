import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, Phone, Radio, Search, ShieldCheck, Siren, UserRound } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

export default function Track() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const initialCode = new URLSearchParams(window.location.search).get("code")?.toUpperCase() || "";
  const [code, setCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState(initialCode);
  const status = trpc.rescue.emergency.statusByCode.useQuery({ publicCode: submittedCode }, { enabled: /^SOS-[A-Z0-9]{8}$/.test(submittedCode), refetchInterval: 10_000, retry: false });
  const stages = useMemo(() => [
    { key: "pending", short: t("track.seen"), label: t("track.pending"), icon: Siren, image: "/manus-storage/panic-flood-rescue_a9f5b532.png", tone: "bg-[#fff2d9] text-[#9b6615]" },
    { key: "dispatched", short: t("track.moving"), label: t("track.dispatched"), icon: Radio, image: "/manus-storage/panic-evacuation_199e3c5d.png", tone: "bg-[#e3eefb] text-[#255c7d]" },
    { key: "resolved", short: t("track.done"), label: t("track.resolved"), icon: CheckCircle2, image: "/manus-storage/panic-medical-help_96aa56f9.png", tone: "bg-[#d9f3e8] text-[#19755f]" },
  ] as const, [t]);
  useEffect(() => { if (initialCode) setSubmittedCode(initialCode); }, [initialCode]);
  const search = (event: FormEvent) => { event.preventDefault(); setSubmittedCode(code.trim().toUpperCase()); };
  const activeIndex = status.data ? Math.max(0, stages.findIndex(stage => stage.key === status.data!.status)) : 0;
  const current = stages[activeIndex];
  const CurrentIcon = current.icon;
  return <div className="min-h-screen bg-[#f6fbf8]">
    <header className="flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:px-8"><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> {t("general.safetyHub")}</button><div className="flex items-center gap-2"><LanguageSelector compact /><span className="rounded-full bg-secondary px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("track.private")}</span></div></header>
    <main className="mx-auto max-w-2xl px-4 py-8 md:py-12"><section className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-[#174e46] text-white"><Radio className="h-7 w-7" /></span><h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#173d37]">{t("track.heading")}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("track.intro")}</p></section><form onSubmit={search} className="mt-7 flex gap-2 rounded-2xl border bg-white p-2 shadow-sm"><Input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="SOS-XXXXXXXX" aria-label={t("track.code")} className="h-12 border-0 font-mono font-medium shadow-none focus-visible:ring-0" /><Button type="submit" className="h-12 rounded-xl"><Search className="mr-2 h-4 w-4" /> {t("track.see")}</Button></form>{status.isFetching && <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5 animate-spin" /> {t("track.checking")}</p>}{status.error && <div role="alert" className="mt-6 flex gap-3 rounded-2xl border border-[#f3c4c1] bg-[#fff5f4] p-4 text-sm text-[#a53d38]"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{status.error.message}</p></div>}{status.data && <section className="mt-7 overflow-hidden rounded-[2rem] border bg-white shadow-[0_18px_50px_-30px_rgb(21_75_67/0.35)]"><div className="bg-[#174e46] p-6 text-white"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b1dbd1]">{t("track.yourSos")}</p><p className="mt-1 font-mono text-lg">{status.data.publicCode}</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold">{t("track.liveCheck")}</span></div><div className="mt-6 flex items-center gap-4"><img src={current.image} alt="" className="h-24 w-24 rounded-2xl bg-white object-contain p-2" /><div><div className="flex items-center gap-2 text-[#b9ddd5]"><CurrentIcon className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">{t("track.now")}</span></div><p className="mt-2 text-xl font-extrabold leading-tight">{current.label}</p></div></div></div><div className="p-5 md:p-6"><div className="grid grid-cols-3 gap-2">{stages.map((stage, index) => { const Icon = stage.icon; const complete = index <= activeIndex; return <div key={stage.key} className={`rounded-2xl p-3 text-center ${complete ? stage.tone : "bg-muted text-muted-foreground"}`}><Icon className="mx-auto h-5 w-5" /><span className="mt-2 block text-xs font-extrabold">{stage.short}</span></div>; })}</div><div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f0faf6] p-4 text-sm font-semibold text-[#285f55]"><MapPin className="h-5 w-5 shrink-0 text-primary" /><span>{status.data.locationLabel}</span></div>{status.data.assignedRescuer && <AssignedRescuerCard rescuer={status.data.assignedRescuer} />}<div className="mt-5 rounded-xl border border-[#b8ded4] bg-[#f8fcfa] p-4 text-xs leading-5 text-[#285f55]"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" /> {t("track.safetyNote")}</div></div></section>}</main>
  </div>;
}

type AssignedRescuer = { callSign: string; name: string | null; photoUrl: string | null; phone: string | null; locationStatus: "live" | "paused" | "off"; location: { latitude: number; longitude: number; updatedAt: Date } | null };

export function AssignedRescuerCard({ rescuer }: { rescuer: AssignedRescuer }) {
  const { t } = useLanguage();
  return <section className="mt-6 overflow-hidden rounded-2xl border border-[#b8ded4] bg-[#f8fcfa]"><div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#d9f3e8] text-primary">{rescuer.photoUrl ? <img src={rescuer.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6" />}</div><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("Your assigned rescuer")}</p><h2 className="mt-1 text-lg font-extrabold text-[#173d37]">{rescuer.callSign}</h2>{rescuer.name && <p className="text-sm text-muted-foreground">{rescuer.name}</p>}</div></div>{rescuer.phone ? <a href={`tel:${rescuer.phone}`} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground"><Phone className="mr-2 h-4 w-4" /> {t("Call rescuer")}</a> : <span className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground">{t("Contact is shared when the responder enables it")}</span>}</div><div className="border-t border-[#cbe8df] bg-white/70 p-4"><div className="flex items-center gap-2"><Radio className={`h-4 w-4 ${rescuer.locationStatus === "live" ? "animate-pulse text-primary" : "text-muted-foreground"}`} /><p className="text-sm font-extrabold text-[#173d37]">{rescuer.locationStatus === "live" ? t("Live location is updating") : rescuer.locationStatus === "paused" ? t("Location sharing is paused") : t("Location sharing has not started")}</p></div>{rescuer.location ? <><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("This position is visible only while the assigned mission is active.")}</p><LiveRescuerMap latitude={rescuer.location.latitude} longitude={rescuer.location.longitude} /></> : <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("The rescuer can start sharing their position once they choose to do so from their field workspace.")}</p>}</div></section>;
}

function LiveRescuerMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const position = { lat: latitude, lng: longitude };
  const placeMarker = (map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter(position);
    map.setZoom(15);
    markerRef.current = new window.google!.maps.marker.AdvancedMarkerElement({ map, position, title: "Assigned rescuer" });
  };
  useEffect(() => { if (!mapRef.current || !markerRef.current) return; mapRef.current.setCenter(position); markerRef.current.position = position; }, [latitude, longitude]);
  return <MapView className="mt-3 h-60 overflow-hidden rounded-xl" initialCenter={position} initialZoom={15} onMapReady={placeMarker} />;
}
