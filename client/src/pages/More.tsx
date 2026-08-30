import React from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Hospital,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  User,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useLocation } from "wouter";

export default function More() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const roleLabel =
    user?.role === "admin"
      ? "Superadmin"
      : user?.role === "rescuer"
      ? "Rescuer"
      : user?.role === "medical"
      ? "Medical"
      : "Citizen";

  const userDistrict = (user as any)?.homeDistrict;
  const userPhone = (user as any)?.phone;
  const bloodGroup = (user as any)?.bloodGroup;

  return (
    <div className="victim-page min-h-screen bg-[#f6f8f7] text-[#122824] transition-colors dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fcfdfd] px-5 pb-28 pt-6 transition-colors dark:bg-[#111214] md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border dark:md:border-white/10">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-black tracking-[-.06em] text-[#122824] dark:text-white">{t("More")}</p>
            <p className="mt-1 text-[10px] font-bold text-[#6b8780] dark:text-[#8a9f99]">{t("Profile & Operations Gateways")}</p>
          </div>
          <LanguageSelector compact />
        </header>

        {/* Top Profile Card - Clickable to Open Customization Page */}
        <section
          onClick={() => setLocation("/profile")}
          className="group mt-7 cursor-pointer rounded-[1.8rem] bg-gradient-to-br from-[#174e46] via-[#1a554c] to-[#0f3832] p-5 text-white shadow-[0_14px_30px_rgba(23,78,70,0.18)] ring-1 ring-white/10 transition hover:shadow-xl active:scale-[.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 ring-2 ring-white/20 backdrop-blur-md transition group-hover:scale-105">
                <UserRound className="h-7 w-7 text-[#d3eee6]" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-black leading-tight text-white">{user?.name || t("Assam Safety Network")}</p>
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

        {/* Protected Operations Wing */}
        <section className="mt-5 rounded-[1.55rem] border border-[#d7e8e2] bg-[#f7fcfa] p-4 dark:border-white/10 dark:bg-[#16171a]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#277b6b] dark:text-[#5eead4]">
            {t("Protected Operations App")}
          </p>
          <p className="mt-1 text-sm font-black text-[#122824] dark:text-white">{t("For authorized response teams")}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <AccessButton icon={ShieldCheck} label={t("Government")} onClick={() => setLocation("/command")} />
            <AccessButton icon={Hospital} label={t("Medical")} onClick={() => setLocation("/medical")} />
            <AccessButton icon={UsersRound} label={t("Rescuer")} onClick={() => setLocation("/responder")} />
          </div>
        </section>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}

function AccessButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Hospital;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="grid place-items-center gap-1 rounded-2xl border border-black/5 bg-white px-2 py-3 text-[10px] font-black text-[#315e54] shadow-sm transition hover:bg-[#f3f7f5] active:scale-95 dark:border-white/10 dark:bg-[#1c1d22] dark:text-[#d3eee6] dark:hover:bg-[#25262c]"
    >
      <Icon className="h-4 w-4 text-[#277b6b] dark:text-[#5eead4]" />
      {label}
    </button>
  );
}
