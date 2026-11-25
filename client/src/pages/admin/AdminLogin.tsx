/*
From Uiverse.io by kyle1dev - https://uiverse.io/kyle1dev/honest-snail-17
MIT License, Copyright (c) kyle1dev (Kyle)
*/
import { useAuth } from "@/_core/hooks/useAuth";
import "@/components/ModernAuthForm.css";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
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
  const [showPassword, setShowPassword] = useState(false);

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
        portal: "admin",
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
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC]">
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
                  Sahay Emergency Network
                </span>
                <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">
                  Emergency & Disaster Response Platform
                </span>
              </span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/")}
                className="hidden items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-[#151718] sm:flex"
              >
                <Users className="h-3.5 w-3.5" />
                All Portals
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

        {/* Admin Login Card */}
        <div className="modern-form mt-7 sm:mt-10 !max-w-xl !p-6 sm:!p-8 shadow-xl">
          <div className="border-b border-black/5 bg-[#fafcfb] p-4.5 rounded-2xl mb-6 dark:border-white/5 dark:bg-[#18191c]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wide text-foreground">
                  Official Command Sign In
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Enter your administrative credentials to access the State Command Centre
                </p>
              </div>
            </div>
          </div>

            {errorMessage && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div className="input-group">
                <Label htmlFor="admin-email" className="text-xs font-bold mb-1.5 block text-foreground/90">
                  Email or Username
                </Label>
                <div className="input-wrapper">
                  <User className="input-icon" />
                  <Input
                    id="admin-email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@assamrescue.gov.in"
                    className="form-input !h-12 text-sm"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <Label htmlFor="admin-password" className="text-xs font-bold mb-1.5 block text-foreground/90">
                  Command Password
                </Label>
                <div className="input-wrapper">
                  <KeyRound className="input-icon" />
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter command password"
                    className="form-input !h-12 pr-10 text-sm"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="submit-button !h-12 w-full text-sm font-bold shadow-md shadow-blue-600/30 transition active:scale-[0.98]"
                >
                  <span className="button-text flex items-center justify-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5" />
                    {isSubmitting ? "Verifying Authorization…" : "Sign In to Command"}
                  </span>
                  <div className="button-glow"></div>
                </button>
              </div>
            </form>
          </div>

          {/* All Portals Link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setLocation("/")}
              className="text-xs font-bold text-[#0f766e] hover:underline dark:text-emerald-400"
            >
              ← Back to All Portals (Main Homepage)
            </button>
          </div>
        </main>
      </div>
    </DesktopOnlyGate>
  );
}
