import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, ClipboardCheck, MapPin, ShieldCheck, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type RegistrationForm = { hospitalName: string; address: string; contactPhone: string; latitude: string; longitude: string; note: string };
const emptyForm = (): RegistrationForm => ({ hospitalName: "", address: "", contactPhone: "", latitude: "", longitude: "", note: "" });

export default function UserHospitalRegister() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [form, setForm] = useState<RegistrationForm>(emptyForm);
  const [locationNotice, setLocationNotice] = useState("");
  const utils = trpc.useUtils();
  const mine = trpc.rescue.hospital.mine.useQuery(undefined, { enabled: Boolean(user) });
  const request = trpc.rescue.hospital.requestRegistration.useMutation({ onSuccess: () => void utils.rescue.hospital.mine.invalidate() });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice("This device cannot provide a location. Enter coordinates manually.");
      return;
    }
    setLocationNotice("Detecting hospital coordinates…");
    navigator.geolocation.getCurrentPosition(
      point => {
        setForm(previous => ({ ...previous, latitude: point.coords.latitude.toFixed(6), longitude: point.coords.longitude.toFixed(6) }));
        setLocationNotice("Hospital coordinates recorded.");
      },
      () => setLocationNotice("Location detection failed. Enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const submit = () => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationNotice("Please enter valid hospital latitude and longitude coordinates.");
      return;
    }
    request.mutate({
      hospitalName: form.hospitalName,
      address: form.address,
      contactPhone: form.contactPhone,
      latitude,
      longitude,
      note: form.note.trim() || undefined,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0A0E17]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E17] p-6 flex flex-col justify-center">
        <div className="absolute right-4 top-4">
          <LanguageSelector compact />
        </div>
        <section className="mx-auto max-w-md w-full rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
            <Building2 className="h-6 w-6" />
          </span>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Hospital Onboarding
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Register a Healthcare Facility</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Sign in to submit your medical center for State Command verification. Specialized hospital operational access unlocks upon verification.
          </p>
          <Button onClick={() => startLogin()} className="mt-6 w-full rounded-xl bg-teal-600 font-semibold text-white hover:bg-teal-700">
            Sign In to Register
          </Button>
          <Button variant="outline" onClick={() => setLocation("/safety")} className="mt-2.5 w-full rounded-xl text-xs">
            Return to Safety
          </Button>
        </section>
      </div>
    );
  }

  if (user.role === "medical") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E17] p-6 flex flex-col justify-center">
        <div className="absolute right-4 top-4">
          <LanguageSelector compact />
        </div>
        <section className="mx-auto max-w-md w-full rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-teal-600" />
          <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Hospital Staff Access Active</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Your medical center credentials are authenticated. Your dedicated clinical desk is available.
          </p>
          <Button onClick={() => setLocation("/medical")} className="mt-6 w-full rounded-xl bg-teal-600 font-semibold text-white hover:bg-teal-700">
            Open Hospital Operations Desk
          </Button>
        </section>
      </div>
    );
  }

  if (mine.data?.status === "pending") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E17] p-6 flex flex-col justify-center">
        <div className="absolute right-4 top-4">
          <LanguageSelector compact />
        </div>
        <section className="mx-auto max-w-md w-full rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <ClipboardCheck className="mx-auto h-12 w-12 text-amber-500" />
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Verification Pending
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Registration Submitted</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            State Command administrators are reviewing credentials for <strong>{mine.data.hospitalName}</strong>. Following review, your account will unlock clinical inventory controls.
          </p>
          <Button variant="outline" onClick={() => setLocation("/safety")} className="mt-6 w-full rounded-xl text-xs">
            Return to Safety
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 dark:bg-[#0A0E17]">
      <div className="absolute right-4 top-4">
        <LanguageSelector compact />
      </div>
      <main className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Verified Medical Network
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">Register Healthcare Facility</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Register medical center coordinates and operational contact. Once approved, clinical staff manage live beds, ICU capacity, oxygen, and inbound victim triage in real time.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <FormField label="Hospital or Health Centre Name" value={form.hospitalName} onChange={hospitalName => setForm({ ...form, hospitalName })} />
          <FormField label="Address or Sector Landmark" value={form.address} onChange={address => setForm({ ...form, address })} />
          <FormField label="Emergency Contact Phone" value={form.contactPhone} onChange={contactPhone => setForm({ ...form, contactPhone })} type="tel" />

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Facility Coordinates</p>
                <p className="text-[11px] text-slate-500">Detect device GPS at the hospital, or input coordinates directly.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} className="rounded-xl text-xs">
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                Detect Location
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FormField label="Latitude" value={form.latitude} onChange={latitude => setForm({ ...form, latitude })} type="number" />
              <FormField label="Longitude" value={form.longitude} onChange={longitude => setForm({ ...form, longitude })} type="number" />
            </div>
            {locationNotice && <p className="mt-2 font-mono text-[11px] font-semibold text-teal-600">{locationNotice}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Accreditation / Operational Note (Optional)</Label>
            <Textarea
              value={form.note}
              onChange={event => setForm({ ...form, note: event.target.value })}
              className="min-h-20 text-xs bg-white dark:bg-slate-800"
              placeholder="Detail bed wings, trauma facilities, or registration credentials…"
            />
          </div>
        </div>

        <Button
          disabled={!form.hospitalName.trim() || !form.address.trim() || !form.contactPhone.trim() || request.isPending}
          onClick={submit}
          className="mt-6 h-11 w-full rounded-xl bg-teal-600 font-semibold text-white shadow-xs hover:bg-teal-700 transition"
        >
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {request.isPending ? "Submitting application…" : "Submit for State Command Verification"}
        </Button>

        {request.isSuccess && (
          <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Registration submitted. State Command review will process your request shortly.
          </p>
        )}
        {request.error && <p className="mt-4 text-xs font-semibold text-rose-600">{request.error.message}</p>}
      </main>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-9 text-xs bg-white dark:bg-slate-800"
      />
    </div>
  );
}
