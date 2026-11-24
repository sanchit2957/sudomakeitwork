import React from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { ProfileAvatar, UserProfileBadge, getFirstName } from "@/components/ProfileAvatar";
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
    <div className="victim-page relative min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-28 pt-4">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{t("More")}</p>
            <p className="text-[10px] font-bold text-muted-foreground">
              {t("Profile & Community Support")}
            </p>
          </div>
          <LanguageSelector compact />
        </header>

        {/* Top Profile Card - Clickable to Open Customization Page */}
        <section
          onClick={() => setLocation("/profile")}
          className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xs transition hover:bg-slate-950 active:scale-[.99] dark:bg-slate-950"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <ProfileAvatar user={user} size="xl" className="ring-2 ring-white/20" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-black leading-tight text-white">
                    {getFirstName(user?.name, user?.email, t("Citizen"))}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{user?.email || t("Citizen Account")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                    <ShieldCheck className="h-3 w-3 text-sky-400" />
                    {t(roleLabel)}
                  </span>
                  {userDistrict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      <MapPin className="h-2.5 w-2.5" />
                      {t(userDistrict)}
                    </span>
                  )}
                  {bloodGroup && (
                    <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      {bloodGroup === "Not specified" ? t("Not specified") : bloodGroup}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white transition group-hover:bg-white/20">
              <Edit3 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-sky-400" />
              {t("Tap to customize safety profile & emergency contacts")}
            </span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 text-slate-400" />
          </div>
        </section>

        {/* Disaster Relief & Donations Section */}
        <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {t("Community Relief")}
                </p>
                <p className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  {t("Disaster Donations")}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
              <Sparkles className="h-3 w-3" />
              {t("Direct Aid")}
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t("Connect with verified relief NGOs and community disaster foundations operating in Assam.")}
          </p>

          <div className="mt-4">
            <button
              onClick={() => setLocation("/donations")}
              className="group flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-left transition hover:border-slate-300 hover:shadow-xs active:scale-[.99] dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex items-center gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t("Donate to NGO")}</span>
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                      {t("Verified NGOs")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("Find nearby grassroots flood relief teams and contact numbers")}
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
