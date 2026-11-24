import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building,
  CheckCircle2,
  Lock,
  LogOut,
  Radio,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users,
  Zap,
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
      <div className="min-h-screen bg-slate-50/70 text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 flex flex-col justify-between">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B0F17]/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-3 text-left transition hover:opacity-90 focus:outline-none"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-slate-800 font-black">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <div>
                <span className="block text-base font-black tracking-tight text-slate-950 dark:text-white leading-tight">
                  Sahay Command Architecture
                </span>
                <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  State Emergency Operations Centre (SEOC)
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                onClick={() => setLocation("/login")}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:flex"
              >
                <Users className="h-3.5 w-3.5 text-slate-500" />
                Citizen Hub
              </button>
              <LanguageSelector compact />
            </div>
          </div>
        </header>

        {/* Main Dual-Column Content */}
        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-6 pb-10 sm:py-10 my-auto flex-1 flex items-center">
          <div className="grid w-full gap-8 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Admin Form (lg:col-span-6 xl:col-span-5) */}
            <div className="mx-auto w-full max-w-md lg:col-span-6 xl:col-span-5">
              {/* Security Clearance Header */}
              <div className="text-left mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Level-1 Command Clearance
                </div>
                <h1 className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  State Command Centre
                </h1>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Authorized access for National and State Disaster Management Coordinators and Dispatch Controllers.
                </p>
              </div>

              {/* Active Session Notification if logged in */}
              {user && (
                <div className="mb-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
                      <Shield className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-foreground">{user.name || user.email}</span>
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-foreground dark:border-slate-800 dark:bg-slate-800">
                          {user.role}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{user.email || "Active Session"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => setLocation("/command")}
                      className="flex-1 h-10 rounded-lg bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-xs"
                    >
                      Enter Command Centre
                    </Button>
                    <Button
                      onClick={() => logout()}
                      variant="outline"
                      className="h-10 rounded-lg border-slate-200 dark:border-slate-800"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Admin Login Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="border-b border-slate-200/90 bg-slate-50/70 px-5 py-3.5 flex items-center gap-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-white">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Command Identification
                    </h2>
                    <p className="text-[10px] text-muted-foreground">
                      Secured Administrator Authentication Gate
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {errorMessage && (
                    <div
                      role="alert"
                      className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400"
                    >
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="leading-snug">{errorMessage}</div>
                    </div>
                  )}

                  <form onSubmit={handleAdminSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="admin-email" className="text-xs font-bold text-foreground">
                        Email Address
                      </Label>
                      <Input
                        id="admin-email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. admin@assamrescue.gov.in"
                        className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="admin-password" className="text-xs font-bold text-foreground">
                        Password
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Administrator password"
                        className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                        autoComplete="current-password"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[11px] text-muted-foreground">Default Credentials</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail("admin@assamrescue.gov.in");
                          setPassword("admin");
                          setErrorMessage("");
                        }}
                        className="font-mono text-[11px] font-bold text-slate-900 hover:underline dark:text-slate-100"
                      >
                        Demo Admin
                      </button>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Verifying Authorization…" : "Sign In to Command"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* User Portal Link */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-xs text-muted-foreground hover:text-foreground transition font-medium"
                >
                  Not an administrator?{" "}
                  <span className="text-foreground font-semibold underline underline-offset-2">
                    Switch to Citizen & Rescuer Portals
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column: Institutional Command Operations Architecture (Desktop >=lg) */}
            <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center pl-4 xl:pl-8">
              <div className="rounded-3xl border border-slate-200/90 bg-white/70 p-8 shadow-sm backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/60">
                {/* Badge & Title */}
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white dark:bg-slate-800">
                    <Terminal className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
                    State Emergency Operations Architecture
                  </span>
                </div>

                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Assam State Command Infrastructure
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Centralized decision console connecting State Disaster Management Authority (ASDMA), NDRF HQ, District Magistrates, and River Basin Flood Forecasting.
                </p>

                {/* Telemetry Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Building className="h-4 w-4" />
                      <span className="font-mono text-[10px] font-bold uppercase">District Centers</span>
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">35 DEOCs</div>
                    <p className="text-[10px] text-muted-foreground">Connected via dedicated satellite mesh</p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Activity className="h-4 w-4" />
                      <span className="font-mono text-[10px] font-bold uppercase">River Telemetry</span>
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">48 Gauges</div>
                    <p className="text-[10px] text-muted-foreground">CWC Brahmaputra danger level sensors</p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Radio className="h-4 w-4" />
                      <span className="font-mono text-[10px] font-bold uppercase">Fleet Mesh</span>
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">Sub-Second</div>
                    <p className="text-[10px] text-muted-foreground">Real-time GPS boat & drone streams</p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Server className="h-4 w-4" />
                      <span className="font-mono text-[10px] font-bold uppercase">Security Protocol</span>
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">SecOps-2026</div>
                    <p className="text-[10px] text-muted-foreground">Multi-agency sovereign cloud isolation</p>
                  </div>
                </div>

                {/* Audit & Compliance Warning */}
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 text-[11px] text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div className="leading-snug">
                    <span className="font-bold text-foreground">Sovereign Audit Log:</span> All logins and dispatch directives from this workstation are cryptographically signed and archived for parliamentary review.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Institutional Footer */}
        <footer className="py-4 text-center text-[10px] font-mono text-muted-foreground border-t border-slate-200/60 dark:border-slate-800">
          State Emergency Operations Centre &bull; Protocol SecOps-2026 &bull; Government of Assam
        </footer>
      </div>
    </DesktopOnlyGate>
  );
}
