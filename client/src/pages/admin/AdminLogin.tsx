import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const { user, login, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user || user.role === "admin") return;
    setLocation(user.role === "rescuer" ? "/responder" : user.role === "medical" ? "/medical" : "/");
  }, [setLocation, user]);

  const [email, setEmail] = useState("admin@assamrescue.gov.in");
  const [password, setPassword] = useState("admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await login({
        email: email.trim(),
        password: password,
      });

      const role = res.user?.role;
      if (role === "admin") {
        setLocation("/command");
      } else {
        setLocation(role === "rescuer" ? "/responder" : role === "medical" ? "/medical" : "/");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Administrator authentication failed. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#122824] transition-colors dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-80"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight">
                sudo <span className="text-[#da3e42]">MakeItWork</span>
              </span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">
                State Disaster Management
              </span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/login")}
              className="hidden items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-[#151718] sm:flex"
            >
              <Users className="h-3.5 w-3.5" />
              Switch to User Portal
            </button>
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10 md:py-16">
        {/* State Command Security Banner */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            State Command Centre
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
            Admin Portal
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Restricted access for State Disaster Management Administrators and Coordinators.
          </p>
        </div>

        {/* Active Session Notification if logged in */}
        {user && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-[#0f766e]/30 bg-white p-5 shadow-sm dark:border-emerald-500/20 dark:bg-[#151718]">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0f766e] text-white shadow-md">
                <Shield className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-extrabold">{user.name || user.email}</span>
                  <span className="rounded bg-[#0f766e]/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-[#0f766e] dark:text-emerald-400">
                    {user.role}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{user.email || "Active Session"}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => setLocation("/command")}
                className="flex-1 rounded-xl bg-[#0f766e] font-bold text-white hover:bg-[#0f766e]/90"
              >
                Enter Command Centre
              </Button>
              <Button
                onClick={() => logout()}
                variant="outline"
                className="rounded-xl font-semibold"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Admin Login Card */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div className="border-b border-black/5 bg-[#fafcfb] p-4 dark:border-white/5 dark:bg-[#18191c]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0f766e]/10 text-[#0f766e] dark:text-emerald-400">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wide text-foreground">
                  Official Command Sign In
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Enter your administrative credentials below
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <Label htmlFor="admin-email" className="text-xs font-bold">Email or Username</Label>
                <Input
                  id="admin-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@assamrescue.gov.in"
                  className="mt-1.5 h-11 rounded-xl"
                  required
                />
              </div>

              <div>
                <Label htmlFor="admin-password" className="text-xs font-bold">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 h-11 rounded-xl"
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Verifying Authorization…" : "Sign In to Command"}
                </Button>
              </div>
            </form>
          </div>

          {/* Quick Prefill Bar */}
          <div className="border-t border-black/5 bg-[#f8faf9] p-4 text-center dark:border-white/5 dark:bg-[#16181b]">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@assamrescue.gov.in");
                setPassword("admin");
              }}
              className="rounded-lg border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 dark:border-white/5 dark:bg-[#1e2024]"
            >
              👑 Fill Admin Credentials (`admin` / `admin`)
            </button>
          </div>
        </div>

        {/* User Portal Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setLocation("/login")}
            className="text-xs font-bold text-[#0f766e] hover:underline dark:text-emerald-400"
          >
            ← Not an administrator? Go to User & Operational Portals (Rescue, Medical & Citizen)
          </button>
        </div>
      </main>
    </div>
  );
}
