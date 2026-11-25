import React from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowRight,
  Hospital,
  Lock,
  PhoneCall,
  Radio,
  Shield,
  ShieldCheck,
  Siren,
  UserPlus,
} from "lucide-react";
import { useLocation } from "wouter";

type PortalCardConfig = {
  id: "citizen" | "rescuer";
  title: string;
  loginPath: string;
  registerPath: string;
  icon: typeof Siren;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  buttonBg: string;
};

const PORTAL_CARDS: PortalCardConfig[] = [
  {
    id: "citizen",
    title: "Citizen Portal",
    loginPath: "/login?mode=signin",
    registerPath: "/login?mode=register",
    icon: Siren,
    accentBg: "bg-red-500/12 dark:bg-red-500/20",
    accentText: "text-red-600 dark:text-red-400",
    accentBorder: "hover:border-red-500/50",
    buttonBg: "bg-[#DC2626] hover:bg-[#b91c1c] text-white",
  },
  {
    id: "rescuer",
    title: "Rescuer Portal",
    loginPath: "/responder/login?mode=signin",
    registerPath: "/responder/login?mode=register",
    icon: Radio,
    accentBg: "bg-emerald-500/12 dark:bg-emerald-500/20",
    accentText: "text-emerald-700 dark:text-emerald-400",
    accentBorder: "hover:border-emerald-500/50",
    buttonBg: "bg-[#0f766e] hover:bg-[#0d625b] text-white",
  },
];

export default function LandingHub() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="victim-page relative min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#090d16] dark:text-[#F8FAFC] overflow-x-hidden">
      <div className="liquid-ambient-bg" />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 px-4 py-3.5 backdrop-blur-md dark:border-white/10 dark:bg-[#0f172a]/85 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f766e] text-white shadow-md shadow-[#0f766e]/25">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-base font-black tracking-tight sm:text-lg">
                Sahay Emergency Network
              </span>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">
                Pan-India Disaster &amp; Emergency Response Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              data-testid="portal-panel-admin"
              onClick={() => setLocation("/admin/login?mode=signin")}
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-1.5 rounded-xl border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-500/20 dark:border-indigo-400/30 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <Shield className="h-3.5 w-3.5" />
              <span data-testid="portal-login-admin">Admin Portal</span>
            </Button>
            <a
              href="tel:112"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#b91c1c]"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Emergency 112
            </a>
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        {/* Hero Banner */}
        <section className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Multi-Portal Command &amp; Response Architecture
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            {t("Select Your Operational Portal")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each role operates with an independent session, dedicated authentication flow, and specialized dashboard. Choose a panel below to sign in or register.
          </p>

          {/* Portal Scope Switcher Tab */}
          <div className="mx-auto mt-7 flex max-w-sm items-center justify-center rounded-2xl border border-black/5 bg-black/5 p-1.5 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-foreground shadow-xs dark:bg-[#151718]"
            >
              <Radio className="h-3.5 w-3.5 text-[#0f766e]" />
              Public &amp; Responders
            </button>
            <button
              type="button"
              data-testid="portal-panel-hospital"
              onClick={() => setLocation("/hospital/login?mode=signin")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-muted-foreground transition hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10"
            >
              <Hospital className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Hospital Desk →
            </button>
          </div>
        </section>

        {/* 2 Cleanly Rearranged Public & Field Operation Panels */}
        <section
          aria-label="Platform Portals"
          className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2"
        >
          {PORTAL_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                data-testid={`portal-panel-${card.id}`}
                onClick={() => setLocation(card.loginPath)}
                className={`glass-panel group relative flex cursor-pointer flex-col justify-between rounded-3xl border border-black/8 bg-white/95 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-white/12 dark:bg-[#111827]/95 ${card.accentBorder}`}
              >
                <div className="flex flex-col items-center py-6 text-center">
                  <span className={`grid h-16 w-16 place-items-center rounded-2xl ${card.accentBg} ${card.accentText} transition-transform group-hover:scale-105 shadow-sm`}>
                    <Icon className="h-8 w-8" />
                  </span>
                  <h2 className="mt-5 text-xl font-bold tracking-tight text-foreground">
                    {card.title}
                  </h2>
                </div>

                {/* Role Actions */}
                <div
                  className="mt-4 flex flex-col gap-2.5 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    data-testid={`portal-login-${card.id}`}
                    onClick={() => setLocation(card.loginPath)}
                    className={`h-11 w-full rounded-xl text-xs font-bold shadow-sm transition active:scale-[0.98] ${card.buttonBg}`}
                  >
                    <Lock className="mr-2 h-3.5 w-3.5" />
                    Sign In
                    <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-80" />
                  </Button>
                  {card.registerPath && (
                    <Button
                      type="button"
                      variant="outline"
                      data-testid={`portal-register-${card.id}`}
                      onClick={() => setLocation(card.registerPath)}
                      className="h-10 w-full rounded-xl border-black/15 text-xs font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                    >
                      <UserPlus className="mr-2 h-3.5 w-3.5" />
                      Register
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Hospital Portal Redirection Banner */}
        <section className="mx-auto mt-8 max-w-3xl">
          <div
            onClick={() => setLocation("/hospital/login?mode=signin")}
            className="group flex cursor-pointer flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-blue-500/25 bg-blue-500/5 p-5 shadow-xs transition hover:border-blue-500/45 hover:bg-blue-500/10 dark:border-blue-400/20 dark:bg-blue-950/25"
          >
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 shadow-xs dark:text-blue-400">
                <Hospital className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">Hospital Medical Desk</h3>
                  <span className="rounded-md bg-blue-500/15 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    Medical Authority
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Publish ER &amp; ICU bed capacity, blood reserves, and manage inbound trauma dispatch.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                data-testid="portal-login-hospital"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation("/hospital/login?mode=signin");
                }}
                className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98]"
              >
                Sign In
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="portal-register-hospital"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation("/hospital/login?mode=register");
                }}
                className="h-10 rounded-xl border-black/15 text-xs font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                Register
              </Button>
            </div>
          </div>
        </section>

        {/* Bottom Info & Independent Session Guarantee */}
        <section className="mt-10 rounded-3xl border border-black/8 bg-white/80 p-5 text-center shadow-xs backdrop-blur-sm dark:border-white/10 dark:bg-[#111827]/75">
          <p className="text-xs font-semibold text-muted-foreground">
            <strong className="text-foreground">Independent Multi-Portal Sessions:</strong> You can sign into Citizen, Rescuer, Hospital, and Admin portals simultaneously in separate tabs without session conflicts.
          </p>
        </section>
      </main>
    </div>
  );
}
