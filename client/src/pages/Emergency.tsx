import OperationsMap from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, Crosshair, ImagePlus, MapPin, ShieldCheck, Siren } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const emptyLayers = { incidents: [], shelters: [], floodZones: [], rescuers: [] };
type EmergencyType = "flood" | "medical" | "trapped" | "evacuation" | "other";
type Severity = "critical" | "high" | "medium" | "low";

export default function Emergency() {
  const [, setLocation] = useLocation();
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
  const [guestKey, setGuestKey] = useState("");
  const [notice, setNotice] = useState("");
  const createSos = trpc.rescue.emergency.create.useMutation();

  useEffect(() => {
    const stored = window.localStorage.getItem("riverguard-guest-key");
    const key = stored || crypto.randomUUID().replaceAll("-", "");
    if (!stored) window.localStorage.setItem("riverguard-guest-key", key);
    setGuestKey(key);
  }, []);

  const coordinates = useMemo(() => latitude !== null && longitude !== null ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : "No location selected", [latitude, longitude]);
  const ready = latitude !== null && longitude !== null && locationLabel.trim().length >= 3 && guestKey;

  const useGps = () => {
    if (!navigator.geolocation) { setNotice("GPS is unavailable on this device. Enter coordinates or select a map point instead."); return; }
    setNotice("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      point => {
        setLatitude(point.coords.latitude); setLongitude(point.coords.longitude);
        setLocationLabel(current => current || `GPS location near ${point.coords.latitude.toFixed(5)}, ${point.coords.longitude.toFixed(5)}`);
        setNotice("GPS location captured. Add a nearby landmark to help teams verify it.");
      },
      () => setNotice("We could not access GPS. Enter the nearest known coordinates or select a point on the map."),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_500_000) { setNotice("Use a PNG, JPEG, or WebP image no larger than 1.5 MB."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => { setEvidenceDataUrl(String(reader.result)); setFileName(file.name); };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!ready || latitude === null || longitude === null) return;
    try {
      const result = await createSos.mutateAsync({ contactName: contactName.trim() || undefined, locationLabel: locationLabel.trim(), latitude, longitude, emergencyType, severity, peopleAffected, notes: notes.trim() || undefined, evidenceDataUrl, guestKey });
      setLocation(`/track?code=${result.publicCode}`);
    } catch { /* The mutation error is rendered near the action. */ }
  };

  return <div className="min-h-screen bg-[#f6fbf8]">
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-8"><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> Back to safety hub</button><div className="flex items-center gap-2 rounded-full bg-[#fff0ee] px-3 py-1.5 text-xs font-bold text-[#b44742]"><Siren className="h-3.5 w-3.5" /> Emergency report</div></header>
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8"><div className="mb-7 max-w-2xl"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">One clear request · one coordination trail</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#173d37]">Tell rescue teams what you need.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Share only what is useful. Your request receives a private tracking reference when submitted.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"><div className="grid gap-5"><div className="grid gap-2"><Label htmlFor="contact">Your name <span className="text-muted-foreground">(optional)</span></Label><Input id="contact" value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Name or family identifier" /></div>
          <ChoiceGrid title="What kind of help is needed?" values={[['flood','Flooding'],['trapped','Trapped'],['medical','Medical'],['evacuation','Evacuation'],['other','Other']] as const} value={emergencyType} onChange={setEmergencyType} />
          <ChoiceGrid title="How urgent is it?" values={[['critical','Critical'],['high','High'],['medium','Medium'],['low','Low']] as const} value={severity} onChange={setSeverity} urgency />
          <div className="grid gap-2"><Label htmlFor="people">People needing help</Label><Input id="people" type="number" min={1} max={500} value={peopleAffected} onChange={event => setPeopleAffected(Math.max(1, Number(event.target.value)))} /></div>
          <div className="grid gap-2"><Label htmlFor="notes">What should teams know? <span className="text-muted-foreground">(optional)</span></Label><Textarea id="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="For example: roof access, child present, medical condition, visible landmark…" className="min-h-24" /></div>
          <div className="grid gap-2"><Label>Photo evidence <span className="text-muted-foreground">(optional)</span></Label><label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed bg-[#f9fcfb] px-4 py-3 text-sm hover:bg-[#f1faf6]"><span className="flex items-center gap-2 font-semibold"><ImagePlus className="h-4 w-4 text-primary" /> {fileName || "Add one image (max 1.5 MB)"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="sr-only" /></label></div>
        </div></section>
        <section className="space-y-4"><div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Location</p><h2 className="mt-1 text-lg font-extrabold">Pin where help is needed</h2></div><Button onClick={useGps} variant="outline" className="rounded-xl border-[#8fc9b9] bg-[#f4fbf8] text-primary hover:bg-[#e4f6ef]"><Crosshair className="mr-2 h-4 w-4" /> Use GPS</Button></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Use GPS when safe, tap the map to place a pin, or enter coordinates manually. Add a landmark so teams can verify the place.</p><div className="mt-4 grid gap-2"><Label htmlFor="location-label">Landmark or address</Label><Input id="location-label" value={locationLabel} onChange={event => setLocationLabel(event.target.value)} placeholder="Nearest landmark, village, road, or building" /></div><div className="mt-3 grid grid-cols-2 gap-3"><CoordinateInput id="latitude" label="Latitude" value={latitude} onChange={setLatitude} placeholder="26.2006" /><CoordinateInput id="longitude" label="Longitude" value={longitude} onChange={setLongitude} placeholder="92.9376" /></div><div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2 font-mono text-[11px] text-primary"><MapPin className="h-3.5 w-3.5" /> {coordinates}</div>{notice && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {notice}</p>}</div>
          <OperationsMap layers={emptyLayers} onPickLocation={point => { setLatitude(point.lat); setLongitude(point.lng); setLocationLabel(current => current || `Map pin near ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`); setNotice("Map pin selected. Add a nearby landmark before submitting."); }} compact />
          <div className="rounded-2xl border border-[#b7ddd2] bg-[#effaf6] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-sm leading-6 text-[#245e53]">Your report is stored with a private reference. It is not marked as delivered until the operations team records an update.</p></div><Button disabled={!ready || createSos.isPending} onClick={submit} className="mt-4 h-13 w-full rounded-xl bg-[#c94b45] text-base font-extrabold text-white hover:bg-[#b9423d] disabled:bg-[#dca39f]"><Siren className="mr-2 h-5 w-5" /> {createSos.isPending ? "Sending SOS…" : "Send emergency request"}</Button>{createSos.error && <p role="alert" className="mt-3 flex gap-2 text-xs font-semibold text-destructive"><AlertCircle className="h-4 w-4" /> {createSos.error.message}</p>}</div>
        </section>
      </div>
    </main>
  </div>;
}

function ChoiceGrid<T extends string>({ title, values, value, onChange, urgency = false }: { title: string; values: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void; urgency?: boolean }) {
  return <fieldset><legend className="mb-2 text-sm font-bold">{title}</legend><div className={`grid gap-2 ${urgency ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>{values.map(([candidate, label]) => <button type="button" key={candidate} onClick={() => onChange(candidate)} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${value === candidate ? candidate === 'critical' ? 'border-[#c94b45] bg-[#fff0ee] text-[#b44742]' : 'border-primary bg-[#e8f7f1] text-primary' : 'bg-white hover:bg-muted'}`}>{label}</button>)}</div></fieldset>;
}
function CoordinateInput({ id, label, value, onChange, placeholder }: { id: string; label: string; value: number | null; onChange: (value: number | null) => void; placeholder: string }) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" step="any" value={value ?? ""} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} placeholder={placeholder} /></div>; }
