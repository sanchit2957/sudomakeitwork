import LanguageSelector from "@/components/LanguageSelector";
import OperationsMap from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { flushOfflineSos, queueOfflineSos, readOfflineSosOutbox, type OfflineSosPayload } from "@/lib/offlineSos";
import { clearSosVoiceNote, readSosVoiceNote } from "@/lib/sosVoiceNote";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, Check, ChevronDown, Crosshair, ImagePlus, LocateFixed, MapPin, Minus, Plus, Radio, Siren, UsersRound, Wifi, WifiOff } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const emptyLayers = { incidents: [], shelters: [], hospitals: [], floodZones: [], rescuers: [] };
type EmergencyType = "flood" | "medical" | "trapped" | "evacuation" | "other";
type Severity = "critical" | "high" | "medium" | "low";

const emergencyChoices: Array<{ value: EmergencyType; labelKey: string; src: string; alt: string; severity: Severity }> = [
  { value: "flood", labelKey: "emergency.flood", src: "/manus-storage/panic-flood-rescue_a9f5b532.png", alt: "Flood rescue boat", severity: "high" },
  { value: "medical", labelKey: "emergency.medical", src: "/manus-storage/panic-medical-help_96aa56f9.png", alt: "First aid kit", severity: "critical" },
  { value: "evacuation", labelKey: "emergency.shelter", src: "/manus-storage/panic-evacuation_199e3c5d.png", alt: "Family moving to shelter", severity: "high" },
];

export default function Emergency() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [contactName, setContactName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [emergencyType, setEmergencyType] = useState<EmergencyType>("flood");
  const [severity, setSeverity] = useState<Severity>("high");
  const [peopleAffected, setPeopleAffected] = useState(1);
  const [notes, setNotes] = useState("");
  const [evidenceDataUrl, setEvidenceDataUrl] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [voiceNote] = useState(() => readSosVoiceNote());
  const [guestKey, setGuestKey] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [outboxCount, setOutboxCount] = useState(0);
  const [deliveredCode, setDeliveredCode] = useState("");
  const createSos = trpc.rescue.emergency.create.useMutation();
  const refreshOutbox = () => setOutboxCount(readOfflineSosOutbox().length);

  useEffect(() => {
    const stored = localStorage.getItem("sudo-makeitwork-guest-key");
    const key = stored || crypto.randomUUID().replaceAll("-", "");
    if (!stored) localStorage.setItem("sudo-makeitwork-guest-key", key);
    setGuestKey(key);
    refreshOutbox();
    const setConnected = () => setOnline(navigator.onLine);
    window.addEventListener("online", setConnected);
    window.addEventListener("offline", setConnected);
    window.addEventListener("sudo-sos-outbox", refreshOutbox);
    return () => {
      window.removeEventListener("online", setConnected);
      window.removeEventListener("offline", setConnected);
      window.removeEventListener("sudo-sos-outbox", refreshOutbox);
    };
  }, []);

  useEffect(() => {
    if (!online || !guestKey || !outboxCount) return;
    void flushOfflineSos(async payload => createSos.mutateAsync(payload)).then(result => {
      if (result.delivered[0]) {
        setDeliveredCode(result.delivered[0]);
        setNotice(t("emergency.delivered"));
      }
      refreshOutbox();
    });
  }, [online, guestKey, outboxCount, t]);

  const ready = latitude !== null && longitude !== null && guestKey;
  const coordinates = useMemo(() => latitude !== null && longitude !== null ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : t("emergency.locationMissing"), [latitude, longitude, t]);
  const useGps = () => {
    if (!navigator.geolocation) {
      setNotice(t("emergency.gpsUnavailable"));
      return;
    }
    setNotice(t("emergency.finding"));
    navigator.geolocation.getCurrentPosition(point => {
      setLatitude(point.coords.latitude);
      setLongitude(point.coords.longitude);
      setLocationLabel(current => current || t("emergency.gpsShared"));
      setNotice(t("emergency.locationReady"));
    }, () => setNotice(t("emergency.gpsFailure")), { enableHighAccuracy: true, timeout: 12_000 });
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_500_000) {
      setNotice(t("emergency.fileError"));
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setEvidenceDataUrl(String(reader.result)); setFileName(file.name); };
    reader.readAsDataURL(file);
  };
  const payload = (): OfflineSosPayload | null => !ready || latitude === null || longitude === null ? null : ({
    contactName: contactName.trim() || undefined,
    locationLabel: locationLabel.trim() || t("emergency.gpsShared"),
    latitude,
    longitude,
    emergencyType,
    severity,
    peopleAffected,
    notes: notes.trim() || undefined,
    evidenceDataUrl,
    voiceNoteDataUrl: voiceNote?.dataUrl,
    voiceNoteDurationSeconds: voiceNote?.durationSeconds,
    guestKey,
  });
  const submit = async () => {
    const next = payload();
    if (!next) { setNotice(t("emergency.locationRequired")); return; }
    if (!navigator.onLine) { const pending = queueOfflineSos(next); setOutboxCount(pending); setNotice(t("emergency.savedOffline")); return; }
    try {
      const result = await createSos.mutateAsync(next);
      clearSosVoiceNote();
      setLocation(`/track?code=${result.publicCode}`);
    } catch (error) {
      if (!navigator.onLine || /network|fetch/i.test(error instanceof Error ? error.message : "")) {
        const pending = queueOfflineSos(next);
        setOutboxCount(pending);
        setNotice(t("emergency.signalLost"));
        return;
      }
      setNotice(t("emergency.sendFailure"));
    }
  };

  return <div className="min-h-screen bg-[#f6fbf8]">
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur md:px-8">
      <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> {t("general.safetyHub")}</button>
      <div className="flex items-center gap-2"><LanguageSelector compact /><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${online ? "bg-[#e7f7ee] text-[#18775e]" : "bg-[#fff2d9] text-[#9b6615]"}`}>{online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{online ? t("general.connected") : t("general.offline")}</span></div>
    </header>
    <main className="mx-auto max-w-3xl px-4 py-6 pb-12 md:py-10">
      <section className="rounded-[2rem] bg-[#174e46] p-6 text-white shadow-[0_28px_70px_-35px_rgb(20_78_70/0.9)] md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b1dbd1]">{t("emergency.help")}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{t("emergency.choose")}</h1>
        <p className="mt-2 text-sm leading-6 text-[#c4e2db]">{t("emergency.pictureHint")}</p>
        <div className="mt-5 grid grid-cols-3 gap-3">{emergencyChoices.map(choice => <button key={choice.value} onClick={() => { setEmergencyType(choice.value); setSeverity(choice.severity); }} className={`overflow-hidden rounded-2xl border-2 p-2 text-center transition active:scale-[0.98] ${emergencyType === choice.value ? "border-white bg-white text-[#174e46] shadow-lg" : "border-white/15 bg-white/5 text-white hover:bg-white/10"}`}><img src={choice.src} alt={choice.alt} className="mx-auto h-20 w-20 object-contain" /><span className="mt-1 block text-xs font-extrabold leading-4">{t(choice.labelKey)}</span>{emergencyType === choice.value && <Check className="mx-auto mt-1 h-3.5 w-3.5 text-[#277b6b]" />}</button>)}</div>
      </section>
      <section className="mt-5 rounded-[2rem] border bg-white p-5 shadow-sm md:p-7"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t("emergency.stepLocation")}</p><h2 className="mt-1 text-xl font-extrabold">{t("emergency.shareLocation")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("emergency.gpsHint")}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary"><LocateFixed className="h-5 w-5" /></span></div><Button onClick={useGps} className="mt-5 h-16 w-full rounded-2xl bg-[#277b6b] text-base font-extrabold text-white hover:bg-[#1f685a]"><Crosshair className="mr-3 h-5 w-5" /> {t("emergency.shareMyLocation")}</Button><div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${ready ? "bg-[#e7f7ee] text-[#18775e]" : "bg-[#f4f8f6] text-muted-foreground"}`}><MapPin className="h-4 w-4" /> {coordinates}</div></section>
      <section className="mt-5 rounded-[2rem] border bg-white p-5 shadow-sm md:p-7"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t("emergency.stepPeople")}</p><h2 className="mt-1 text-xl font-extrabold">{t("emergency.people")}</h2></div><UsersRound className="h-6 w-6 text-primary" /></div><div className="mt-5 flex items-center justify-center gap-5"><Button type="button" variant="outline" onClick={() => setPeopleAffected(value => Math.max(1, value - 1))} className="h-14 w-14 rounded-2xl"><Minus className="h-5 w-5" /></Button><output className="grid h-16 min-w-20 place-items-center rounded-2xl bg-[#eaf7f2] text-3xl font-extrabold text-primary">{peopleAffected}</output><Button type="button" variant="outline" onClick={() => setPeopleAffected(value => Math.min(500, value + 1))} className="h-14 w-14 rounded-2xl"><Plus className="h-5 w-5" /></Button></div></section>
      <details className="group mt-5 rounded-2xl border bg-white px-5 py-4 shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-extrabold"><span>{t("emergency.moreDetails")}</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><div className="mt-5 grid gap-4"><div className="grid gap-2"><Label htmlFor="landmark">{t("emergency.landmark")}</Label><Input id="landmark" value={locationLabel} onChange={event => setLocationLabel(event.target.value)} placeholder={t("emergency.landmarkPlaceholder")} /></div><div className="grid gap-2"><Label htmlFor="contact">{t("emergency.contact")}</Label><Input id="contact" value={contactName} onChange={event => setContactName(event.target.value)} placeholder={t("general.optional")} /></div><div className="grid gap-2"><Label htmlFor="notes">{t("emergency.importantDetail")}</Label><Textarea id="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder={t("emergency.detailPlaceholder")} className="min-h-20" /></div><div className="grid gap-2"><Label>{t("emergency.photo")}</Label><label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed bg-[#f9fcfb] px-4 py-3 text-sm font-semibold"><span className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-primary" /> {fileName || t("emergency.addPhoto")}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="sr-only" /></label></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="latitude">Latitude</Label><Input id="latitude" type="number" step="any" value={latitude ?? ""} onChange={event => setLatitude(event.target.value ? Number(event.target.value) : null)} /></div><div className="grid gap-2"><Label htmlFor="longitude">Longitude</Label><Input id="longitude" type="number" step="any" value={longitude ?? ""} onChange={event => setLongitude(event.target.value ? Number(event.target.value) : null)} /></div></div><OperationsMap layers={emptyLayers} onPickLocation={point => { setLatitude(point.lat); setLongitude(point.lng); setLocationLabel(current => current || `${t("emergency.mapPin")} ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`); }} compact /></div></details>
      {outboxCount > 0 && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#f1d9a7] bg-[#fff8e7] p-4 text-sm leading-6 text-[#805b16]"><WifiOff className="mt-0.5 h-5 w-5 shrink-0" /><span><strong>{t("emergency.outbox", { count: outboxCount })}</strong> {t("emergency.outboxHint")}</span></div>}
      {deliveredCode && <button onClick={() => setLocation(`/track?code=${deliveredCode}`)} className="mt-5 w-full rounded-2xl bg-[#e7f7ee] p-4 text-left text-sm font-bold text-[#18775e]">{t("emergency.delivered")} {deliveredCode} <ArrowLeft className="ml-1 inline h-4 w-4 rotate-180" /></button>}
      {notice && <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-muted-foreground"><AlertCircle className="mt-1 h-4 w-4 shrink-0" /> {notice}</p>}
      <Button disabled={createSos.isPending} onClick={submit} className="mt-6 h-18 w-full rounded-2xl bg-[#c94b45] text-lg font-extrabold text-white shadow-xl shadow-[#c94b45]/20 hover:bg-[#b9423d]"><Siren className="mr-3 h-6 w-6" /> {createSos.isPending ? t("emergency.sending") : online ? t("emergency.send") : t("emergency.saveOffline")}</Button>
      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground"><Radio className="mr-1 inline h-3.5 w-3.5" /> {t("emergency.offlineWarning")}</p>
    </main>
  </div>;
}
