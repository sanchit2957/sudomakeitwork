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
import { useLiveRescuerStream, ARRIVING_DISTANCE_KM, LIVE_LOCATION_STALE_THRESHOLD_MS } from "@/hooks/useLiveRescuerStream";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, MessageCircle, Navigation, Phone, Radio, Search, Send, ShieldCheck, Siren, UserRound, UsersRound, Wifi, WifiOff } from "lucide-react";
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type AssignedRescuer = { callSign: string; name: string | null; photoUrl: string | null; phone: string | null; locationStatus: "live" | "paused" | "off"; location: { latitude: number; longitude: number; updatedAt: Date } | null; destination?: { latitude: number; longitude: number }; route?: { distanceKm: number; distanceText: string; durationMinutes: number; etaText: string; isApproximate: boolean; coordinates: [number, number][] } | null };

export default function Track() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const initialCode = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code")?.toUpperCase() : "") || getLatestSos() || "";
  const [code, setCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState(initialCode);
  const liveStream = useLiveRescuerStream(/^SOS-[A-Z0-9]{8}$/.test(submittedCode) ? submittedCode : null);
  const status = trpc.rescue.emergency.statusByCode.useQuery(
    { publicCode: submittedCode },
    {
      enabled: /^SOS-[A-Z0-9]{8}$/.test(submittedCode),
      // When SSE is healthy, reduce polling to 20s for background consistency. Fall back to 4s when SSE is down.
      refetchInterval: liveStream.pollingIntervalMs ?? 20_000,
      retry: false,
    }
  );
  const stages = useMemo(() => [
    { key: "pending", short: t("SOS received"), label: t("SOS received"), icon: Siren, tone: "bg-[#fff2d9] text-[#9b6615]" },
    { key: "dispatched", short: t("Rescuer assigned"), label: t("Rescuer assigned"), icon: Radio, tone: "bg-[#e3eefb] text-[#255c7d]" },
    { key: "resolved", short: t("Rescue completed"), label: t("Rescue completed"), icon: CheckCircle2, tone: "bg-[#d9f3e8] text-[#19755f]" },
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

  const dispatchStatusLabel = useMemo(() => {
    if (!status.data) return "";
    if (status.data.status === "resolved") {
      return t("Rescue completed");
    }
    if (status.data.assignedRescuer) {
      if ((status.data as any).destinationHospitalName) {
        return `En route to ${(status.data as any).destinationHospitalName}`;
      }
      return t("Rescuer assigned — responder en route");
    }
    // While matching / radius broadening / triage in progress
    return t("Searching for rescuer...");
  }, [status.data, t]);

  return <div className="min-h-screen bg-[#f6f8f7]"><main className="mx-auto min-h-screen max-w-lg bg-[#fcfdfd] px-5 pb-28 pt-6 md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border"><header className="flex items-start justify-between"><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-left"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#174e46] text-white"><ArrowLeft className="h-5 w-5" /></span><span><span className="block text-xl font-black tracking-[-.05em]">{t("track.heading")}</span><span className="block text-[10px] font-bold text-[#6b8780]">{t("track.private")}</span></span></button><LanguageSelector compact /></header><form onSubmit={search} className="mt-7 flex gap-2 rounded-[1.35rem] bg-white p-2 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035]"><Input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="SOS-XXXXXXXX" aria-label={t("track.code")} className="h-11 border-0 font-mono font-medium shadow-none focus-visible:ring-0" /><Button type="submit" className="h-11 rounded-xl bg-[#174e46]"><Search className="h-4 w-4" /></Button></form>{status.isFetching && <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5 animate-spin" /> {t("track.checking")}</p>}{status.error && <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-[#f3c4c1] bg-[#fff5f4] p-4 text-sm text-[#a53d38]"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{status.error.message}</p></div>}{status.data && <section className="mt-5 overflow-hidden rounded-[1.8rem] bg-white shadow-[0_18px_40px_-28px_rgb(21_75_67/0.35)] ring-1 ring-black/[.035]"><div className="bg-[#174e46] p-5 text-white"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b1dbd1]">{t("track.yourSos")}</p><p className="mt-1 font-mono text-lg">{status.data.publicCode}</p></div><div className="flex flex-col items-end gap-1"><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold">{t("track.liveCheck")}</span>{(status.data as any).requestCategory && <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300 ring-1 ring-emerald-400/30">{(status.data as any).requestCategory}</span>}</div></div><div className="mt-5 flex items-center gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm"><CurrentIcon className="h-8 w-8 text-white" /></div><div><div className="flex items-center gap-2 text-[#b9ddd5]"><CurrentIcon className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">{t("track.now")}</span></div><p className="mt-2 text-lg font-extrabold leading-tight">{dispatchStatusLabel}</p></div></div></div><div className="p-4"><div className="grid grid-cols-3 gap-2">{stages.map((stage, index) => { const Icon = stage.icon; const complete = index <= activeIndex; return <div key={stage.key} className={`rounded-2xl p-3 text-center ${complete ? stage.tone : "bg-muted text-muted-foreground"}`}><Icon className="mx-auto h-5 w-5" /><span className="mt-2 block text-xs font-extrabold">{stage.short}</span></div>; })}</div>{(status.data as any).dispatchStatus === "escalated" && <div role="status" className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-bold text-amber-900 dark:text-amber-300"><Clock3 className="h-5 w-5 shrink-0 text-amber-600" /><span>{t("State Command Centre has taken direct priority oversight of this incident.")}</span></div>}{(status.data as any).destinationHospitalName && <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-extrabold text-emerald-950 dark:text-emerald-200"><span>🏥</span><span>{t("En route to")} {(status.data as any).destinationHospitalName}</span></div>}<div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f0faf6] p-3 text-sm font-semibold text-[#285f55]"><MapPin className="h-5 w-5 shrink-0 text-primary" /><span>{status.data.locationLabel}</span></div>{status.data.assignedRescuer && <AssignedRescuerCard rescuer={status.data.assignedRescuer} hospital={(status.data as any).destinationHospital} liveRescuer={liveStream.rescuer} liveRoute={liveStream.route} isStale={liveStream.isStale} lastEventAt={liveStream.lastEventAt} />}{status.data.status === "resolved" && <PostRescueCheckInCard publicCode={status.data.publicCode} />}<RequestDetails publicCode={status.data.publicCode} active={status.data.status !== "resolved"} /><IncidentChat publicCode={status.data.publicCode} active={status.data.status !== "resolved"} /><div className="mt-4 rounded-xl border border-[#b8ded4] bg-[#f8fcfa] p-3 text-xs leading-5 text-[#285f55]"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" /> {t("track.safetyNote")}</div></div></section>}</main><VictimNavigation current="track" /></div>;
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

export function AssignedRescuerCard({
  rescuer,
  hospital,
  liveRescuer,
  liveRoute,
  isStale,
  lastEventAt,
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

  // Merge: SSE live position takes priority over tRPC polling
  const effectiveLat = liveRescuer?.latitude ?? rescuer.location?.latitude;
  const effectiveLng = liveRescuer?.longitude ?? rescuer.location?.longitude;
  const effectiveRoute = liveRoute ?? (rescuer as any).route;
  const effectiveLocationStatus = (liveRescuer?.locationStatus ?? rescuer.locationStatus) as "live" | "paused" | "off";
  const updatedAt = liveRescuer?.updatedAt ?? rescuer.location?.updatedAt;

  // Seconds-ago counter for GPS freshness label
  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => setSecondsAgo(Math.round((Date.now() - updatedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  // Arrival stage: Arriving if distance < ARRIVING_DISTANCE_KM
  const isArriving = effectiveRoute && effectiveRoute.distanceKm < ARRIVING_DISTANCE_KM;

  // Location status label
  const locationLabel = (() => {
    if (isStale || secondsAgo > LIVE_LOCATION_STALE_THRESHOLD_MS / 1000) return `Last location ${secondsAgo}s ago`;
    if (effectiveLocationStatus === "live") return `Live GPS · Updated ${secondsAgo}s ago`;
    if (effectiveLocationStatus === "paused") return "Waiting for next location update";
    return "Location sharing starts after assignment";
  })();

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#b8ded4] bg-[#f8fcfa]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#d9f3e8] text-primary">
            {rescuer.photoUrl ? <img src={rescuer.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6" />}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("Your assigned rescuer")}</p>
            <h2 className="mt-1 text-lg font-extrabold text-[#173d37]">{rescuer.callSign}</h2>
            {rescuer.name && <p className="text-sm text-muted-foreground">{rescuer.name}</p>}
          </div>
        </div>
        {rescuer.phone ? (
          <a href={`tel:${rescuer.phone}`} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground">
            <Phone className="mr-2 h-4 w-4" /> {t("Call rescuer")}
          </a>
        ) : (
          <span className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground">
            {t("Contact is shared when the responder enables it")}
          </span>
        )}
      </div>

      {/* Uber-style ETA hero card */}
      {effectiveRoute && (
        <div className={`border-t border-[#cbe8df] p-4 ${isArriving ? "bg-emerald-50" : "bg-[#f0faf7]"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-[#174e46]">
                {isArriving ? "🏁 Arriving now" : `${effectiveRoute.isApproximate ? "~" : ""}${effectiveRoute.etaText}`}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#4a7b72]">{effectiveRoute.distanceText} away{effectiveRoute.isApproximate ? " (estimated)" : ""}</p>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${
              isStale || secondsAgo > LIVE_LOCATION_STALE_THRESHOLD_MS / 1000
                ? "bg-amber-100 text-amber-800"
                : effectiveLocationStatus === "live"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-gray-100 text-gray-600"
            }`}>
              {isStale || secondsAgo > LIVE_LOCATION_STALE_THRESHOLD_MS / 1000
                ? <><WifiOff className="h-3 w-3" /> Stale</>
                : effectiveLocationStatus === "live"
                ? <><Wifi className="h-3 w-3" /> Live</>
                : <><Clock3 className="h-3 w-3" /> Paused</>}
            </div>
          </div>
        </div>
      )}

      {hospital && (
        <div className="border-t border-[#cbe8df] bg-emerald-50/60 p-3.5 text-xs text-emerald-950">
          <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-800">
            <span>🏥</span> <span>Destination Hospital: {hospital.name}</span>
          </div>
          <p className="mt-1 text-emerald-700">📍 {hospital.address} · Specialty: {hospital.specialty}</p>
          {hospital.contactPhone && (
            <p className="mt-1 font-semibold">📞 Desk: <a href={`tel:${hospital.contactPhone}`} className="underline font-bold">{hospital.contactPhone}</a></p>
          )}
        </div>
      )}

      <div className="border-t border-[#cbe8df] bg-white/70 p-4">
        <div className="flex items-center gap-2">
          <Radio className={`h-4 w-4 ${effectiveLocationStatus === "live" && !isStale ? "animate-pulse text-primary" : "text-muted-foreground"}`} />
          <p className="text-sm font-extrabold text-[#173d37]">{locationLabel}</p>
        </div>
        {(effectiveLat !== undefined && effectiveLng !== undefined) ? (
          <>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("This position is visible while the assigned mission is active.")}</p>
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
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("The rescuer's position begins updating automatically when their assigned mission is active.")}</p>
        )}
      </div>
    </section>
  );
}


export function PostRescueCheckInCard({ publicCode }: { publicCode: string }) {
  const { t } = useLanguage();
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
      <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50/50 p-5">
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-base font-extrabold">Post-Rescue Check-in Recorded</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-emerald-900">
          Thank you for confirming your post-rescue status. Relief operations and field coordinators have received your response.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white p-3 border border-emerald-200">
            <span className="font-bold text-muted-foreground block text-[10px] uppercase">Relief Centre Allotted</span>
            <span className="font-extrabold text-sm text-emerald-800 uppercase">{c.reliefCentreAllotted}</span>
          </div>
          <div className="rounded-xl bg-white p-3 border border-emerald-200">
            <span className="font-bold text-muted-foreground block text-[10px] uppercase">Category Details</span>
            <span className="font-extrabold text-sm text-emerald-800 uppercase">{c.helpCategory}</span>
          </div>
        </div>
        {c.notes && (
          <p className="mt-2.5 rounded-xl bg-white p-3 text-xs text-zinc-700 border border-emerald-200 leading-relaxed">
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
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#9fd5c7] bg-[#f2faf7] p-5">
      <div className="flex items-center gap-2 text-[#174e46]">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-extrabold">Post-Rescue Check-in</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Please complete this quick safety check-in to confirm your ongoing relief needs with the response team.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-black text-[#174e46]">
            Were you allotted a relief centre?
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAllotted("yes")}
              className={`rounded-xl py-2.5 text-xs font-extrabold transition border ${allotted === "yes" ? "bg-[#174e46] text-white border-[#174e46]" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"}`}
            >
              ✓ Yes, Allotted
            </button>
            <button
              type="button"
              onClick={() => setAllotted("no")}
              className={`rounded-xl py-2.5 text-xs font-extrabold transition border ${allotted === "no" ? "bg-[#174e46] text-white border-[#174e46]" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"}`}
            >
              ✕ No, Not Yet
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-[#174e46]">
            Additional Details & Category
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              ["medical", "Medical help"],
              ["trapped", "Trapped / evacuation"],
              ["evacuation", "Shelter / relocation"],
              ["other", "Other support"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setHelpCategory(val)}
                className={`rounded-xl p-2.5 text-left text-xs font-bold transition border ${helpCategory === val ? "bg-emerald-800 text-white border-emerald-900" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-[#174e46]">
            Notes & Field Requirements (Optional)
          </label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Specify any immediate medical requirements, family member locations, or camp details…"
            maxLength={2000}
            className="mt-1.5 min-h-20 bg-white text-xs"
          />
        </div>

        <Button
          type="submit"
          disabled={submitCheckIn.isPending}
          className="w-full rounded-xl bg-[#174e46] text-white font-extrabold text-xs h-11 shadow-sm"
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
  const leafletMapRef = useRef<L.Map | null>(null);
  const rescuerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destinationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const leafletRescuerRef = useRef<L.Marker | null>(null);
  const leafletRouteRef = useRef<L.Polyline | null>(null);
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

  // Leaflet: initial map setup with road polyline or fallback dashed line
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

      // Prefer server-computed road polyline; fallback to dashed straight line
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

  // Google Maps: update marker when rescuer position changes
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

  // Leaflet: smoothly move rescuer marker when position updates
  useEffect(() => {
    if (!leafletRescuerRef.current) return;
    leafletRescuerRef.current.setLatLng([latitude, longitude]);
    if (leafletRouteRef.current && roadCoordinates?.length) {
      leafletRouteRef.current.setLatLngs(roadCoordinates);
      if (etaText) setRouteSummary(etaText);
    }
  }, [latitude, longitude, roadCoordinates, etaText]);

  return <><MapView className="mt-3 h-60 overflow-hidden rounded-xl" initialCenter={rescuerPosition} initialZoom={15} onMapReady={placeMarkers} onLeafletReady={handleLeafletReady} />{routeSummary && <p className="mt-2 flex items-center gap-2 rounded-xl bg-[#fff5f3] px-3 py-2 text-xs font-bold text-[#a43f3d]"><Navigation className="h-4 w-4" />Live route · ETA: {routeSummary}</p>}</>;
}

