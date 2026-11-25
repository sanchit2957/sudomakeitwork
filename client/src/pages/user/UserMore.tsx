import React from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/components/VictimNavigation";
import { ProfileAvatar, UserProfileBadge, getFirstName } from "@/components/ProfileAvatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2,
  ChevronRight,
  Edit3,
  HeartHandshake,
  LayoutGrid,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

export default function UserMore() {
  const { user, logout } = useAuth();
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
    <div className="victim-page relative min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC] overflow-x-hidden">
      {/* iOS Liquid Glass Ambient Refraction Layer */}
      <div className="liquid-ambient-bg" />

      <main className="victim-main relative z-10 mx-auto min-h-screen w-full max-w-[1520px] px-4 sm:px-6 lg:px-10 pb-36 pt-6">
        <header className="glass-card mb-5 flex items-center justify-between p-3.5 shadow-sm">
          <div>
            <p className="text-xl font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">{t("More")}</p>
            <p className="text-xs font-semibold text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
              {t("Profile & Community Support")}
            </p>
          </div>
          <LanguageSelector compact />
        </header>

        {/* Top Profile Card - Clickable to Open Customization Page */}
        <section
          onClick={() => setLocation("/profile")}
          className="glass-panel glass-panel-dark group cursor-pointer overflow-hidden rounded-2xl bg-[#0F172A] p-5 text-white shadow-md transition hover:shadow-lg active:scale-[.99] dark:bg-[#182353]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <ProfileAvatar user={user} size="xl" className="ring-2 ring-white/30" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-black leading-tight text-[#F8FAFC]">
                    {getFirstName(user?.name, user?.email, t("Citizen"))}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-[#F1F5F9]/80">{user?.email || t("Citizen Account")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#F8FAFC]">
                    <ShieldCheck className="h-3 w-3 text-[#F1F5F9]" />
                    {t(roleLabel)}
                  </span>
                  {userDistrict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold text-[#F1F5F9]">
                      <MapPin className="h-2.5 w-2.5" />
                      {t(userDistrict)}
                    </span>
                  )}
                  {bloodGroup && (
                    <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-200">
                      {bloodGroup === "Not specified" ? t("Not specified") : bloodGroup}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 text-white transition group-hover:bg-white/25">
              <Edit3 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-[#F1F5F9]">
            <span className="flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-[#F1F5F9]" />
              {t("Tap to customize safety profile & emergency contacts")}
            </span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </section>

        {/* Disaster Relief & Donations Section */}
        <section className="glass-panel mt-5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#1D4ED8] text-white">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[.14em] text-[#1D4ED8] dark:text-[#F1F5F9]">
                  {t("Community Relief")}
                </p>
                <p className="text-base font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                  {t("Disaster Donations")}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1D4ED8]/10 px-2.5 py-1 text-xs font-bold text-[#1D4ED8] dark:bg-[#1D4ED8]/20 dark:text-[#F1F5F9]">
              <Sparkles className="h-3 w-3" />
              {t("Direct Aid")}
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-[#0F172A]/70 dark:text-[#F1F5F9]/70 text-prose-justified">
            {t("Connect with verified relief NGOs and community disaster foundations operating across India.")}
          </p>

          <div className="mt-4">
            {/* Donate to NGO Card */}
            <button
              onClick={() => setLocation("/donations")}
              className="group glass-card flex w-full items-center justify-between p-4 text-left transition hover:border-[#1D4ED8]/40 hover:shadow-md active:scale-[.99]"
            >
              <div className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F1F5F9] text-[#1D4ED8] transition group-hover:scale-105 dark:bg-[#1D4ED8]/30 dark:text-[#F1F5F9]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">{t("Donate to NGO")}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {t("Verified NGOs")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                    {t("Find nearby grassroots flood relief teams and contact numbers")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#E2E8F0] transition group-hover:translate-x-1 group-hover:text-[#1D4ED8] dark:group-hover:text-[#F1F5F9]" />
            </button>
          </div>
        </section>
        {/* Portal Switch & Session Controls */}
        <section className="glass-panel mt-5 p-4 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-xs font-bold text-[#0F172A] transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-[#F8FAFC]"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>{t("All Portals (Main Hub)")}</span>
          </button>
          {user && (
            <button
              type="button"
              onClick={() => void logout().then(() => setLocation("/login"))}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("Sign Out")}</span>
            </button>
          )}
        </section>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}
