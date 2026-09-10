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
    <div className="victim-page min-h-screen bg-[#f8f7f2] text-[#1c1917] transition-colors dark:bg-[#0a0b0d] dark:text-[#f8fafc]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fdfcf7] px-5 pb-28 pt-6 transition-colors dark:bg-[#121316] md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border md:border-black/10 dark:md:border-white/10">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-black tracking-[-.06em] text-[#1c1917] dark:text-[#f8fafc]">{t("More")} ⋯</p>
            <p className="mt-1 text-xs font-bold text-[#78716c] dark:text-[#a8a29e]">{t("Profile & Community Support")} 🤝</p>
          </div>
          <LanguageSelector compact />
        </header>

        {/* Top Profile Card - Clickable to Open Customization Page */}
        <section
          onClick={() => setLocation("/profile")}
          className="group mt-6 cursor-pointer rounded-[1.8rem] bg-gradient-to-br from-[#881337] via-[#4c0519] to-[#1c1917] p-5 text-white shadow-[0_14px_30px_rgba(136,19,55,0.25)] ring-1 ring-white/15 transition hover:shadow-xl active:scale-[.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                user={user}
                size="xl"
                className="ring-2 ring-[#facc15]/60"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-black leading-tight text-white">{getFirstName(user?.name, user?.email, t("Citizen"))}</p>
                </div>
                <p className="mt-0.5 text-xs text-[#fde047]">{user?.email || t("Citizen Account")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    <ShieldCheck className="h-3 w-3 text-[#facc15]" />
                    {t(roleLabel)}
                  </span>
                  {userDistrict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-[#fef08a]">
                      <MapPin className="h-2.5 w-2.5" />
                      {t(userDistrict)}
                    </span>
                  )}
                  {bloodGroup && (
                    <span className="inline-flex items-center rounded-full bg-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-100">
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

          <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-xs font-semibold text-[#fef9c3]">
            <span className="flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-[#facc15]" />
              {t("Tap to customize safety profile & emergency contacts")}
            </span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </section>

        {/* Disaster Relief & Donations Section */}
        <section className="mt-5 rounded-[1.8rem] border border-black/10 bg-gradient-to-b from-[#fdfcf7] to-[#f8f7f2] p-5 shadow-md dark:border-white/10 dark:from-[#18191d] dark:to-[#121316]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#881337] text-[#facc15] dark:bg-[#eab308]/20 dark:text-[#facc15]">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#881337] dark:text-[#facc15]">
                  {t("Community Relief")} 🤝
                </p>
                <p className="text-base font-black tracking-tight text-[#1c1917] dark:text-[#f8fafc]">
                  {t("Disaster Donations")}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#881337]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#881337] dark:bg-[#eab308]/20 dark:text-[#facc15]">
              <Sparkles className="h-3 w-3" />
              {t("Direct Aid")}
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#57534e] dark:text-[#a8a29e]">
            {t("Connect with verified relief NGOs and community disaster foundations operating in Assam.")}
          </p>

          <div className="mt-4">
            {/* Donate to NGO Card */}
            <button
              onClick={() => setLocation("/donations")}
              className="group flex w-full items-center justify-between rounded-2xl border border-black/10 bg-[#fdfcf7] p-4 text-left shadow-sm transition hover:border-[#881337]/40 hover:shadow-md active:scale-[.99] dark:border-white/10 dark:bg-[#1a1c20] dark:hover:border-[#facc15]/40"
            >
              <div className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#881337]/10 text-[#881337] transition group-hover:scale-105 dark:bg-[#eab308]/15 dark:text-[#facc15]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-[#1c1917] dark:text-[#f8fafc]">{t("Donate to NGO")} 🏢</span>
                    <span className="rounded-full bg-[#881337]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#881337] dark:bg-[#eab308]/20 dark:text-[#facc15]">{t("Verified NGOs")}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#78716c] dark:text-[#a8a29e]">
                    {t("Find nearby grassroots flood relief teams and contact numbers")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#78716c] transition group-hover:translate-x-1 group-hover:text-[#881337] dark:text-neutral-500 dark:group-hover:text-[#facc15]" />
            </button>
          </div>
        </section>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}

