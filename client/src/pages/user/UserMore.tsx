import React from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { ProfileAvatar, UserProfileBadge, getFirstName } from "@/components/ProfileAvatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  HeartHandshake,
  Landmark,
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
    <div className="victim-page min-h-screen bg-[#f6f8f7] text-[#122824] transition-colors dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fcfdfd] px-5 pb-28 pt-6 transition-colors dark:bg-[#111214] md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border dark:md:border-white/10">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-black tracking-[-.06em] text-[#122824] dark:text-white">{t("More")}</p>
            <p className="mt-1 text-[10px] font-bold text-[#6b8780] dark:text-[#8a9f99]">{t("Profile & Community Support")}</p>
          </div>
          <LanguageSelector compact />
        </header>

        {/* Top Profile Card - Clickable to Open Customization Page */}
        <section
          onClick={() => setLocation("/profile")}
          className="group mt-6 cursor-pointer rounded-[1.8rem] bg-gradient-to-br from-[#174e46] via-[#1a554c] to-[#0f3832] p-5 text-white shadow-[0_14px_30px_rgba(23,78,70,0.18)] ring-1 ring-white/10 transition hover:shadow-xl active:scale-[.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                user={user}
                size="xl"
                className="ring-2 ring-white/30"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-black leading-tight text-white">{getFirstName(user?.name, user?.email, t("Citizen"))}</p>
                </div>
                <p className="mt-0.5 text-xs text-[#c2e2db]">{user?.email || t("Citizen Account")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#e6f7f3]">
                    <ShieldCheck className="h-3 w-3 text-[#5eead4]" />
                    {t(roleLabel)}
                  </span>
                  {userDistrict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-[#d3eee6]">
                      <MapPin className="h-2.5 w-2.5" />
                      {t(userDistrict)}
                    </span>
                  )}
                  {bloodGroup && (
                    <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
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

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-[#d3eee6]">
            <span className="flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-[#5eead4]" />
              {t("Tap to customize safety profile & emergency contacts")}
            </span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </section>

        {/* Disaster Relief & Donations Section */}
        <section className="mt-5 rounded-[1.8rem] border border-[#d6ebe3] bg-gradient-to-b from-[#f4faf7] to-[#eef7f3] p-5 shadow-[0_8px_24px_rgba(23,78,70,0.06)] dark:border-white/10 dark:from-[#16181b] dark:to-[#121316]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#174e46] text-white dark:bg-emerald-500/20 dark:text-emerald-300">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#277b6b] dark:text-[#5eead4]">
                  {t("Community Relief")}
                </p>
                <p className="text-base font-black tracking-tight text-[#122824] dark:text-white">
                  {t("Disaster Donations")}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#174e46]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#174e46] dark:bg-emerald-500/10 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              {t("Direct Aid")}
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#597870] dark:text-[#8ea49d]">
            {t("Connect with verified relief NGOs and community disaster foundations operating in Assam.")}
          </p>

          <div className="mt-4">
            {/* Donate to NGO Card */}
            <button
              onClick={() => setLocation("/donations")}
              className="group flex w-full items-center justify-between rounded-2xl border border-[#cbe4db] bg-white p-4 text-left shadow-sm transition hover:border-[#174e46]/40 hover:shadow-md active:scale-[.99] dark:border-white/10 dark:bg-[#1a1c20] dark:hover:border-emerald-500/40"
            >
              <div className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e6f6f0] text-[#176a5a] transition group-hover:scale-105 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-[#13302b] dark:text-white">{t("Donate to NGO")}</span>
                    <span className="rounded-full bg-[#e6f6f0] px-2 py-0.5 text-[9px] font-bold uppercase text-[#176a5a] dark:bg-emerald-950/60 dark:text-emerald-300">{t("Verified NGOs")}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#63817a] dark:text-[#8ea49d]">
                    {t("Find nearby grassroots flood relief teams and contact numbers")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8da79f] transition group-hover:translate-x-1 group-hover:text-[#174e46] dark:text-neutral-500 dark:group-hover:text-emerald-300" />
            </button>
          </div>
        </section>

        {/* Hospital Registration */}
        <button
          onClick={() => setLocation("/hospital/register")}
          className="mt-5 flex w-full items-center gap-4 rounded-[1.55rem] border border-[#c8ddef] bg-[#f5f9ff] p-4 text-left transition hover:bg-[#eef5fc] active:scale-[.99] dark:border-blue-950 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf2fb] text-[#255c7d] dark:bg-blue-900/40 dark:text-blue-300">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-black text-[#234b77] dark:text-blue-300">{t("Hospital registration")}</span>
            <span className="mt-1 block text-xs leading-5 text-[#58738f] dark:text-blue-200/70">
              {t("Hospitals can request verified staff access and publish live resource information.")}
            </span>
          </span>
        </button>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}

