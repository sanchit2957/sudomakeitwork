import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, ClipboardCheck, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type RegistrationForm = { hospitalName: string; address: string; contactPhone: string; latitude: string; longitude: string; note: string };
const emptyForm = (): RegistrationForm => ({ hospitalName: "", address: "", contactPhone: "", latitude: "", longitude: "", note: "" });

export default function HospitalRegistration() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [form, setForm] = useState<RegistrationForm>(emptyForm);
  const [locationNotice, setLocationNotice] = useState("");
  const utils = trpc.useUtils();
  const mine = trpc.rescue.hospital.mine.useQuery(undefined, { enabled: Boolean(user) });
  const request = trpc.rescue.hospital.requestRegistration.useMutation({ onSuccess: () => void utils.rescue.hospital.mine.invalidate() });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationNotice("This device cannot provide a location. Enter the coordinates manually."); return; }
    setLocationNotice("Finding hospital location…");
    navigator.geolocation.getCurrentPosition(point => {
      setForm(previous => ({ ...previous, latitude: point.coords.latitude.toFixed(6), longitude: point.coords.longitude.toFixed(6) }));
      setLocationNotice("Hospital coordinates recorded.");
    }, () => setLocationNotice("Location could not be acquired. Enter the coordinates manually."), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
  };

  const submit = () => {
    const latitude = Number(form.latitude); const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setLocationNotice("Add valid hospital coordinates before submitting."); return; }
    request.mutate({ hospitalName: form.hospitalName, address: form.address, contactPhone: form.contactPhone, latitude, longitude, note: form.note.trim() || undefined });
  };

  if (loading) return <div className="min-h-screen app-grid grid place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white" /></div>;
  if (!user) return (
    <div className="min-h-screen app-grid p-6 flex items-center justify-center">
      <div className="absolute right-4 top-4"><LanguageSelector compact /></div>
      <section className="m-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-border bg-muted/60 text-foreground"><Building2 className="h-7 w-7" /></span>
        <span className="mt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Hospital Onboarding</span>
        <h1 className="mt-1 text-xl font-bold text-foreground">Register Clinical Facility</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Sign in to register your healthcare facility for National Command dispatch integration. Clinical portal unlocks after verification.</p>
        <Button onClick={() => startLogin()} className="mt-5 w-full bg-neutral-900 hover:opacity-90 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-bold">Sign in to Register</Button>
        <Button variant="outline" onClick={() => setLocation("/safety")} className="mt-2.5 w-full rounded-lg text-xs border-border">Return to Safety</Button>
      </section>
    </div>
  );
  if (user.role === "medical") return (
    <div className="min-h-screen app-grid p-6 flex items-center justify-center">
      <div className="absolute right-4 top-4"><LanguageSelector compact /></div>
      <section className="m-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        <h1 className="mt-3 text-lg font-bold text-foreground">Hospital Operations Access Active</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your verified hospital operations desk is active for live capacity tracking, ICU telemetry, and inbound emergency intake.</p>
        <Button onClick={() => setLocation("/medical")} className="mt-5 w-full bg-neutral-900 hover:opacity-90 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-bold">Open Hospital Dashboard</Button>
      </section>
    </div>
  );
  if (mine.data?.status === "pending") return (
    <div className="min-h-screen app-grid p-6 flex items-center justify-center">
      <div className="absolute right-4 top-4"><LanguageSelector compact /></div>
      <section className="m-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <span className="mt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Verification in Progress</span>
        <h1 className="mt-1 text-lg font-bold text-foreground">Application Under Review</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Command coordinators are verifying <strong>{mine.data.hospitalName}</strong> credentials. Clinical portal access will be granted upon accreditation.</p>
        <Button variant="outline" onClick={() => setLocation("/safety")} className="mt-5 w-full rounded-lg text-xs border-border">Return to Safety</Button>
      </section>
    </div>
  );
  if (mine.data?.status === "rejected") return (
    <div className="min-h-screen app-grid p-6 flex items-center justify-center">
      <div className="absolute right-4 top-4"><LanguageSelector compact /></div>
      <section className="m-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-3 text-lg font-bold text-foreground">Registration Update Required</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{mine.data.reviewNote || "Please review the hospital details and submit again."}</p>
        <Button onClick={() => void utils.rescue.hospital.mine.invalidate()} className="mt-5 w-full bg-neutral-900 hover:opacity-90 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-bold">Edit Registration</Button>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen app-grid p-4 sm:p-8 flex items-center justify-center">
      <div className="absolute right-4 top-4"><LanguageSelector compact /></div>
      <main className="mx-auto w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xs sm:p-8">
        <div className="flex items-start gap-3.5 pb-4 border-b border-border">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border bg-muted/60 text-foreground"><Building2 className="h-6 w-6" /></span>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">National Healthcare Network</span>
            <h1 className="mt-0.5 text-xl font-bold text-foreground">Register Clinical Facility</h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Submit facility telemetry and contact for National Disaster Response integration.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3.5">
          <FormField label="Hospital or Medical Facility Name" value={form.hospitalName} onChange={hospitalName => setForm({ ...form, hospitalName })} />
          <FormField label="Official Address / Landmark" value={form.address} onChange={address => setForm({ ...form, address })} />
          <FormField label="Emergency Intake Phone Number" value={form.contactPhone} onChange={contactPhone => setForm({ ...form, contactPhone })} type="tel" />
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">Facility Geospatial Coordinates</p>
                <p className="text-[11px] text-muted-foreground">Acquire GPS at facility or specify latitude/longitude.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} className="rounded-lg text-xs border-border"><MapPin className="mr-1.5 h-3.5 w-3.5" />Acquire GPS</Button>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <FormField label="Latitude" value={form.latitude} onChange={latitude => setForm({ ...form, latitude })} type="number" />
              <FormField label="Longitude" value={form.longitude} onChange={longitude => setForm({ ...form, longitude })} type="number" />
            </div>
            {locationNotice && <p className="mt-2 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{locationNotice}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium text-foreground">Clinical Accreditation Notes (Optional)</Label>
            <Textarea value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="min-h-20 text-xs" />
          </div>
        </div>
        <Button disabled={!form.hospitalName.trim() || !form.address.trim() || !form.contactPhone.trim() || request.isPending} onClick={submit} className="mt-5 h-11 w-full rounded-lg bg-neutral-900 hover:opacity-90 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs"><ClipboardCheck className="mr-2 h-4 w-4" />{request.isPending ? "Submitting Registration…" : "Submit for Verification"}</Button>
        {request.isSuccess && <p className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">Registration submitted. Clinical desk will unlock following accreditation review.</p>}
        {request.error && <p className="mt-3 text-xs font-semibold text-destructive">{request.error.message}</p>}
      </main>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div className="grid gap-1.5"><Label className="text-xs font-medium text-foreground">{label}</Label><Input type={type} value={value} onChange={event => onChange(event.target.value)} className="text-xs" /></div>; }
