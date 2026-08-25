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
      setLocationNotice("Hospital location added.");
    }, () => setLocationNotice("Location could not be added. Enter the coordinates manually."), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
  };

  const submit = () => {
    const latitude = Number(form.latitude); const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setLocationNotice("Add a valid hospital location before submitting."); return; }
    request.mutate({ hospitalName: form.hospitalName, address: form.address, contactPhone: form.contactPhone, latitude, longitude, note: form.note.trim() || undefined });
  };

  if (loading) return <div className="min-h-screen app-grid grid place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!user) return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf2fb] text-[#255c7d]"><Building2 className="h-7 w-7" /></span><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Hospital onboarding</p><h1 className="mt-2 text-xl font-extrabold">Register a hospital</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to submit your hospital for administrator verification. Staff access starts only after approval.</p><Button onClick={() => startLogin()} className="mt-6 w-full">Sign in to register</Button><Button variant="outline" onClick={() => setLocation("/safety")} className="mt-3 w-full">Return to Safety</Button></section></div>;
  if (user.role === "medical") return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><CheckCircle2 className="mx-auto h-12 w-12 text-[#19755f]" /><h1 className="mt-4 text-xl font-extrabold">Hospital staff access is active</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your approved hospital dashboard is ready for live capacity and supply updates.</p><Button onClick={() => setLocation("/medical")} className="mt-6 w-full">Open hospital dashboard</Button></section></div>;
  if (mine.data?.status === "pending") return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ClipboardCheck className="mx-auto h-12 w-12 text-[#255c7d]" /><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Verification in progress</p><h1 className="mt-2 text-xl font-extrabold">Hospital request submitted</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">An administrator will verify <strong>{mine.data.hospitalName}</strong>. After approval, this account receives a hospital-only resource dashboard.</p><Button variant="outline" onClick={() => setLocation("/safety")} className="mt-6 w-full">Return to Safety</Button></section></div>;
  if (mine.data?.status === "rejected") return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ShieldCheck className="mx-auto h-12 w-12 text-[#b44742]" /><h1 className="mt-4 text-xl font-extrabold">Registration needs an update</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{mine.data.reviewNote || "Please review the hospital details and submit again."}</p><Button onClick={() => void utils.rescue.hospital.mine.invalidate()} className="mt-6 w-full">Edit registration</Button></section></div>;

  return <div className="min-h-screen app-grid bg-[#f3faf7] p-4 sm:p-8"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><main className="mx-auto w-full max-w-2xl rounded-[2rem] border bg-card p-5 shadow-xl sm:p-8"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#eaf2fb] text-[#255c7d]"><Building2 className="h-7 w-7" /></span><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Verified hospital network</p><h1 className="mt-1 text-2xl font-extrabold">Register your hospital</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Share the hospital location and a contact. After approval, staff can update beds, ICU capacity, transport, food, medicine, water, and power status in real time.</p></div></div><div className="mt-7 grid gap-4"><FormField label="Hospital or health centre name" value={form.hospitalName} onChange={hospitalName => setForm({ ...form, hospitalName })} /><FormField label="Address or landmark" value={form.address} onChange={address => setForm({ ...form, address })} /><FormField label="Emergency contact number" value={form.contactPhone} onChange={contactPhone => setForm({ ...form, contactPhone })} type="tel" /><div className="rounded-2xl border border-[#cfe4dc] bg-[#f7fcfa] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-extrabold">Hospital location</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use the device location at the hospital, or enter coordinates below.</p></div><Button type="button" variant="outline" onClick={useCurrentLocation} className="rounded-xl"><MapPin className="mr-2 h-4 w-4" />Use location</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><FormField label="Latitude" value={form.latitude} onChange={latitude => setForm({ ...form, latitude })} type="number" /><FormField label="Longitude" value={form.longitude} onChange={longitude => setForm({ ...form, longitude })} type="number" /></div>{locationNotice && <p className="mt-3 text-xs font-semibold text-[#277b6b]">{locationNotice}</p>}</div><div className="grid gap-2"><Label>Verification note (optional)</Label><Textarea value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} placeholder="Describe the hospital service or authorized staff role." className="min-h-24" /></div></div><Button disabled={!form.hospitalName.trim() || !form.address.trim() || !form.contactPhone.trim() || request.isPending} onClick={submit} className="mt-6 h-12 w-full rounded-xl"><ClipboardCheck className="mr-2 h-4 w-4" />{request.isPending ? "Submitting registration…" : "Send for administrator approval"}</Button>{request.isSuccess && <p className="mt-4 rounded-xl bg-[#e7f7ee] p-3 text-sm font-semibold text-[#19755f]">Registration sent. You will receive hospital dashboard access after approval.</p>}{request.error && <p className="mt-4 text-sm font-semibold text-destructive">{request.error.message}</p>}</main></div>;
}

function FormField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div className="grid gap-2"><Label>{label}</Label><Input type={type} value={value} onChange={event => onChange(event.target.value)} /></div>; }
