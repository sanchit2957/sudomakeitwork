import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, Lock, LogOut, Radio, ShieldAlert, Stethoscope } from "lucide-react";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type PortalRole = "rescuer" | "medical";

const portalConfig = {
  rescuer: {
    title: "Rescuer Portal",
    heading: "Rescuer Login",
    description: "Restricted access for authorized field rescue personnel.",
    prompt: "Enter your rescuer credentials below",
    destination: "/responder",
    icon: Radio,
  },
  medical: {
    title: "Medical Portal",
    heading: "Medical Login",
    description: "Restricted access for authorized medical operations personnel.",
    prompt: "Enter your medical credentials below",
    destination: "/medical",
    icon: Stethoscope,
  },
} as const;

export function RoleLogin({ role }: { role: PortalRole }) {
  const config = portalConfig[role];
  const Icon = config.icon;
  const { login, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await login({ email: email.trim(), password });
      if (result.user?.role !== role) {
        await logout();
        throw new Error(`This account is not authorized for the ${role === "rescuer" ? "Rescuer" : "Medical"} Portal.`);
      }
      setLocation(config.destination);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#122824] dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button onClick={() => setLocation("/login")} className="flex items-center gap-2.5 text-left transition hover:opacity-80">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm"><ArrowLeft className="h-4 w-4" /></span>
            <span>
              <span className="block text-base font-black tracking-tight">sudo <span className="text-[#da3e42]">MakeItWork</span></span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">Assam Emergency Network</span>
            </span>
          </button>
          <div className="flex items-center gap-3"><Button variant="outline" size="sm" onClick={() => setLocation("/login")}>Other Logins</Button><LanguageSelector compact /></div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10 md:py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400"><Icon className="h-4 w-4" /> {config.title}</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{config.heading}</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div className="border-b border-black/5 bg-[#fafcfb] p-4 dark:border-white/5 dark:bg-[#18191c]">
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0f766e]/10 text-[#0f766e] dark:text-emerald-400"><Lock className="h-4 w-4" /></span><div><h2 className="text-xs font-black uppercase tracking-wide">Official {config.title} Sign In</h2><p className="text-[11px] text-muted-foreground">{config.prompt}</p></div></div>
          </div>
          <div className="p-6">
            {errorMessage && <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div>{errorMessage}</div></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label htmlFor={`${role}-email`} className="text-xs font-bold">Email or Username</Label><Input id={`${role}-email`} type="text" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 h-11 rounded-xl" required /></div>
              <div><Label htmlFor={`${role}-password`} className="text-xs font-bold">Password</Label><div className="relative mt-1.5"><Input id={`${role}-password`} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} className="h-11 rounded-xl pr-11" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90"><Icon className="mr-2 h-4 w-4" />{isSubmitting ? "Authenticating…" : `Sign In to ${role === "rescuer" ? "Rescuer" : "Medical"}`}</Button>
            </form>
          </div>
        </div>
        <div className="mt-6 text-center"><button onClick={() => setLocation("/login")} className="text-xs font-bold text-[#0f766e] hover:underline dark:text-emerald-400">← Back to User / Other Logins</button></div>
      </main>
    </div>
  );
}

export function RescuerLogin() {
  return <RoleLogin role="rescuer" />;
}

export function MedicalLogin() {
  return <RoleLogin role="medical" />;
}
