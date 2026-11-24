import React from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { ProfileAvatar, getFirstName } from "@/components/ProfileAvatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2,
  ChevronRight,
  Edit3,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

export default function UserMore() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const roleLabel =
    user?.role === "admin"
      ? "Superadmin"
      : user?.role === "rescuer"
      ? "Rescuer"
      : user?.role === "medical" || user?.role === "hospital"
      ? "Hospital Staff"
      : "Citizen";

  const userDistrict = (user as any)?.homeDistrict;
  const bloodGroup = (user as any)?.bloodGroup;

  return (
    <div className="victim-page relative min-h-screen bg-white text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-28 pt-3">
        {/* Seamless Header matching Citizen Home */}
        <header className="flex items-center justify-between gap-3 pt-2 pb-4">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t("Citizen Safety Identity & Relief")}
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {t("Account & Community")}
            </h1>
          </div>
          <LanguageSelector compact />
        </header>

        {/* Institutional Profile Identity Card */}
        <section
          onClick={() => setLocation("/profile")}
          className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition hover:bg-muted/40 active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <ProfileAvatar user={user} size="xl" />
              <div>
                <p className="text-lg font-bold leading-tight text-foreground">
                  {getFirstName(user?.name, user?.email, t("Citizen"))}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{user?.email || t("Citizen Account")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                    <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    {t(roleLabel)}
                  </span>
                  {userDistrict && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {t(userDistrict)}
                    </span>
                  )}
                  {bloodGroup && (
                    <span className="inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-400">
                      {bloodGroup === "Not specified" ? t("Not specified") : bloodGroup}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-muted/50 text-foreground transition group-hover:bg-muted">
              <Edit3 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5" />
              {t("Tap to customize safety profile & emergency contacts")}
            </span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </section>

        {/* Disaster Relief & Donations Section */}
        <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-muted/60 text-foreground">
                <HeartHandshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("Community Relief")}
                </p>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  {t("Disaster Donations & Verified NGOs")}
                </h2>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              {t("Direct Aid")}
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t("Connect with verified relief foundations and emergency response organizations operating nationwide.")}
          </p>

          <div className="mt-4">
            <button
              onClick={() => setLocation("/donations")}
              className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 p-3.5 text-left transition hover:bg-muted/60 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground">
                  <Building2 className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{t("Donate to Relief Funds")}</span>
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                      {t("Verified NGOs")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("Find verified local relief teams, dispatch hubs, and emergency supply lines")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          </div>
        </section>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}
