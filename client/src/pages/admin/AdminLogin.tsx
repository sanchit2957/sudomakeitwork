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
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2.5 text-left transition hover:opacity-85 focus:outline-none"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted/60 text-foreground font-black shadow-xs">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <div>
                <span className="block text-base font-bold tracking-tight text-foreground">
                  Sahay Command Architecture
                </span>
                <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  State Emergency Operations Centre
                </span>
              </div>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/login")}
                className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition sm:flex"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Citizen Hub
              </button>
              <LanguageSelector compact />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md px-4 py-8 md:py-12 my-auto">
          {/* State Command Security Banner */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Restricted Clearance
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              State Command Centre
            </h1>
            <p className="mx-auto mt-2 text-xs leading-relaxed text-muted-foreground max-w-sm">
              Authorized access for National and State Disaster Management Coordinators and Dispatch Controllers.
            </p>
          </div>

          {/* Active Session Notification if logged in */}
          {user && (
            <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border bg-muted/60 text-foreground">
                  <Shield className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{user.name || user.email}</span>
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-foreground">
                      {user.role}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{user.email || "Active Session"}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => setLocation("/command")}
                  className="flex-1 h-10 rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 font-bold text-white hover:opacity-90 text-xs"
                >
                  Enter Command Centre
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  className="h-10 rounded-lg border-border"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Admin Login Card */}
          <div className="mt-6 rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="border-b border-border bg-muted/20 px-5 py-3.5 flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-card text-foreground">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Command Identification
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  Secured Administrator Authentication Gate
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {errorMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-700 dark:text-red-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="admin-email" className="text-xs font-medium text-foreground">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@sahay.gov.in"
                    className="mt-1.5 h-10 text-xs"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="admin-password" className="text-xs font-medium text-foreground">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Administrator password"
                    className="mt-1.5 h-10 text-xs"
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
                    className="font-mono text-[11px] font-bold text-foreground hover:underline"
                  >
                    Demo Admin
                  </button>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 font-bold text-white hover:opacity-90 text-xs"
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
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Not an administrator? <span className="text-foreground font-semibold underline underline-offset-2">Switch to Citizen & Rescuer Portals</span>
            </button>
          </div>
        </main>

        <footer className="py-4 text-center text-[10px] font-mono text-muted-foreground border-t border-border">
          State Emergency Operations Centre &bull; Protocol SecOps-2026
        </footer>
      </div>
    </DesktopOnlyGate>
  );
}
