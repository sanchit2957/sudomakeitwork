import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const { user, login, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        role: "admin",
      });

      const role = res.user?.role;
      if (role !== "admin") {
        await logout();
        throw new Error("This account is not authorized for the Administrator Portal.");
      }
      setLocation("/command");
    } catch (err: any) {
      setErrorMessage(err?.message || "Administrator authentication failed. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DesktopOnlyGate portalName="State Command Centre" portalType="admin">
      <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-slate-950">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B0F17]/90 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2.5 text-left transition hover:opacity-85 focus:outline-none"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500 text-slate-950 font-black shadow-xs">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-base font-black tracking-tight text-white">
                  Sahay Command Architecture
                </span>
                <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-sky-400">
                  State Emergency Operations Centre
                </span>
              </span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/login")}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition sm:flex"
              >
                <Users className="h-3.5 w-3.5 text-sky-400" />
                Citizen Hub
              </button>
              <LanguageSelector compact />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md px-4 py-8 md:py-12 my-auto">
          {/* State Command Security Banner */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Restricted Clearance
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-white">
              State Command Centre
            </h1>
            <p className="mx-auto mt-2 text-xs leading-relaxed text-slate-400 max-w-sm">
              Authorized access for State Disaster Management Administrators, Coordinators, and District Dispatchers.
            </p>
          </div>

          {/* Active Session Notification if logged in */}
          {user && (
            <div className="mt-6 rounded-2xl border border-sky-500/30 bg-slate-900/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  <Shield className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{user.name || user.email}</span>
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-sky-300">
                      {user.role}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{user.email || "Active Session"}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => setLocation("/command")}
                  className="flex-1 h-10 rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400"
                >
                  Enter Command Centre
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  className="h-10 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Admin Login Card */}
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-950/60 px-5 py-3.5 flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Command Identification
                </h2>
                <p className="text-[10px] text-slate-400">
                  Secured Administrator Authentication Gate
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {errorMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="admin-email" className="text-xs font-bold text-slate-300">Email or Username</Label>
                  <Input
                    id="admin-email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@assamrescue.gov.in"
                    className="mt-1.5 h-10 rounded-lg bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="admin-password" className="text-xs font-bold text-slate-300">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Administrator password"
                    className="mt-1.5 h-10 rounded-lg bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500 text-sm"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-slate-500">Default Credentials</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@assamrescue.gov.in");
                      setPassword("admin");
                      setErrorMessage("");
                    }}
                    className="font-mono text-[11px] font-bold text-sky-400 hover:underline"
                  >
                    Demo Admin
                  </button>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400 shadow-md shadow-sky-500/20 text-xs"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Verifying Authorization…" : "Sign In to Command"}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* User Portal Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setLocation("/login")}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Not an administrator? <span className="text-sky-400 underline underline-offset-2">Switch to Citizen & Rescuer Portals</span>
            </button>
          </div>
        </main>

        <footer className="py-4 text-center text-[10px] font-mono text-slate-600 border-t border-slate-800/80">
          State Emergency Operations Centre &bull; Protocol SecOps-2026
        </footer>
      </div>
    </DesktopOnlyGate>
  );
}
