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
  id: "citizen" | "rescuer" | "hospital" | "admin";
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  loginPath: string;
  registerPath: string;
  icon: typeof Siren;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  buttonBg: string;
  highlights: string[];
};

const PORTAL_CARDS: PortalCardConfig[] = [
  {
    id: "citizen",
    title: "Citizen Portal",
    subtitle: "SOS Emergency Hub & Safety",
    description:
      "Trigger rapid GPS SOS alerts, record voice distress notes, track rescue units live, and locate verified Pan-India hospitals.",
    badge: "Public Safety",
    loginPath: "/login?mode=signin",
    registerPath: "/login?mode=register",
    icon: Siren,
    accentBg: "bg-red-500/12 dark:bg-red-500/20",
    accentText: "text-red-600 dark:text-red-400",
    accentBorder: "hover:border-red-500/50",
    buttonBg: "bg-[#DC2626] hover:bg-[#b91c1c] text-white",
    highlights: ["1-Tap Emergency SOS", "Live Rescue Tracking", "9,360+ Verified Hospitals"],
  },
  {
    id: "rescuer",
    title: "Rescuer Portal",
    subtitle: "Field Operations & Dispatch",
    description:
      "Receive instant emergency offers, navigate with flood-aware road routing, coordinate victim chat, and manage active missions.",
    badge: "Gov Code Gated",
    loginPath: "/responder/login?mode=signin",
    registerPath: "/responder/login?mode=register",
    icon: Radio,
    accentBg: "bg-emerald-500/12 dark:bg-emerald-500/20",
    accentText: "text-emerald-700 dark:text-emerald-400",
    accentBorder: "hover:border-emerald-500/50",
    buttonBg: "bg-[#0f766e] hover:bg-[#0d625b] text-white",
    highlights: ["Real-Time Mission Offers", "Flood-Aware Routing", "BLE Radar & Voice Playback"],
  },
  {
    id: "hospital",
    title: "Hospital Portal",
    subtitle: "ER / ICU Readiness & Triage",
    description:
      "Publish live emergency & ICU bed capacity, oxygen and blood reserves, manage multiple branches, and prepare for incoming SOS cases.",
    badge: "Medical Desk",
    loginPath: "/hospital/login?mode=signin",
    registerPath: "/hospital/login?mode=register",
    icon: Hospital,
    accentBg: "bg-blue-500/12 dark:bg-blue-500/20",
    accentText: "text-[#1D4ED8] dark:text-blue-400",
    accentBorder: "hover:border-[#1D4ED8]/50",
    buttonBg: "bg-[#1D4ED8] hover:bg-[#1e40af] text-white",
    highlights: ["Live ER & ICU Capacity", "Inbound SOS Alerts", "Multi-Branch Management"],
  },
  {
    id: "admin",
    title: "Admin Portal",
    subtitle: "State Command & Governance",
    description:
      "Oversee Pan-India incidents, inspect DBSCAN spatial SOS clusters, manage flood zones & shelters, and authorize responders & hospitals.",
    badge: "Command Authority",
    loginPath: "/admin/login?mode=signin",
    registerPath: "/admin/login?mode=register",
    icon: Shield,
    accentBg: "bg-indigo-500/12 dark:bg-indigo-500/20",
    accentText: "text-indigo-700 dark:text-indigo-300",
    accentBorder: "hover:border-indigo-500/50",
    buttonBg: "bg-[#0F172A] hover:bg-[#1e293b] dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white",
    highlights: ["DBSCAN SOS Clusters", "Access Code Governance", "Staff & Hospital Approvals"],
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
        </section>

        {/* 4 Clearly Separated Role Panels */}
        <section
          aria-label="Platform Portals"
          className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
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
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${card.accentBg} ${card.accentText}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider ${card.accentBg} ${card.accentText}`}>
                      {card.badge}
                    </span>
                  </div>

                  {/* Title & Purpose */}
                  <h2 className="mt-5 text-xl font-black tracking-tight text-foreground">
                    {card.title}
                  </h2>
                  <p className={`mt-0.5 text-xs font-bold ${card.accentText}`}>
                    {card.subtitle}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>

                  {/* Capabilities */}
                  <ul className="mt-4 space-y-1.5 border-t border-black/5 pt-4 dark:border-white/10">
                    {card.highlights.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs font-semibold text-foreground/85">
                        <span className={`h-1.5 w-1.5 rounded-full ${card.accentText} bg-current`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Separate Login & Registration Actions */}
                <div
                  className="mt-6 flex flex-col gap-2 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    data-testid={`portal-login-${card.id}`}
                    onClick={() => setLocation(card.loginPath)}
                    className={`h-11 w-full rounded-xl text-xs font-black shadow-sm transition active:scale-[0.98] ${card.buttonBg}`}
                  >
                    <Lock className="mr-2 h-3.5 w-3.5" />
                    Sign In
                    <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-80" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`portal-register-${card.id}`}
                    onClick={() => setLocation(card.registerPath)}
                    className="h-10 w-full rounded-xl border-black/15 text-xs font-bold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                  >
                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                    Register
                  </Button>
                </div>
              </article>
            );
          })}
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
