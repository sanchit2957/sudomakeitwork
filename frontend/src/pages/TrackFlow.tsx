import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLatestSos, rememberLatestSos } from "@/lib/rapidSos";
import { trpc } from "@/lib/trpc";
import { VictimNavigation } from "@/pages/Home";
import { AssignedRescuerCard, IncidentChat, PostRescueCheckInCard } from "@/pages/Track";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, Radio, ShieldCheck, Siren } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

export default function TrackFlow() {
  const [, setLocation] = useLocation(); const { t } = useLanguage(); const { user } = useAuth();
  const codeFromPath = new URLSearchParams(window.location.search).get("code")?.toUpperCase() || "";
  const publicCode = codeFromPath || getLatestSos();
  useEffect(() => { if (publicCode) rememberLatestSos(publicCode); }, [publicCode]);
  const status = trpc.rescue.emergency.statusByCode.useQuery({ publicCode }, { enabled: /^SOS-[A-Z0-9]{8}$/.test(publicCode), refetchInterval: 5_000, refetchIntervalInBackground: true, retry: false });
  const stages = useMemo(() => [
    { key: "pending", label: t("SOS received"), copy: t("Searching for rescuer..."), icon: Siren, emoji: "🚨" },
    { key: "dispatched", label: t("Rescuer assigned"), copy: t("Your responder’s profile and live updates appear here"), icon: Radio, emoji: "🛟" },
    { key: "resolved", label: t("Rescue completed"), copy: t("This rescue flow is recorded on this device"), icon: CheckCircle2, emoji: "✅" }
  ] as const, [t]);
  const activeIndex = status.data ? Math.max(0, stages.findIndex(stage => stage.key === status.data!.status)) : 0;
  return (
    <div className="victim-page min-h-screen bg-[#f8f7f2] text-[#1c1917] transition-colors dark:bg-[#0a0b0d] dark:text-[#f8fafc]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fdfcf7] px-5 pb-28 pt-6 transition-colors dark:bg-[#121316] md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border md:border-black/10 dark:md:border-white/10 shadow-xl">
        {/* Universal Header Bar */}
        <header className="flex items-center justify-between gap-3 pb-2">
          <button onClick={() => setLocation("/")} className="group flex items-center gap-2.5 text-left transition hover:opacity-85 active:scale-95">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#881337] text-white shadow-sm transition dark:bg-[#eab308] dark:text-[#0a0b0d]">
              <ArrowLeft className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-lg font-black tracking-[-.04em] text-[#1c1917] dark:text-[#f8fafc]">
                {t("Your rescue flow")}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#78716c] dark:text-[#a8a29e]">
                {t("Saved on this device")}
              </span>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {!publicCode && (
          <section className="mt-8 rounded-[2rem] border-2 border-dashed border-[#fecdd3] bg-[#fff1f2] p-8 text-center dark:border-[#7f1d1d]/40 dark:bg-[#450a0a]/20">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#881337] text-white shadow-md dark:bg-[#dc2626]">
              <Siren className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-black text-[#881337] dark:text-[#fca5a5]">{t("No active SOS yet")}</h1>
            <p className="mt-2 text-xs leading-5 text-[#78716c] dark:text-[#d6d3d1]">{t("When you activate SOS, your rescue flow will remain here—even after refresh.")}</p>
            <Button onClick={() => setLocation("/")} className="mt-5 rounded-xl bg-[#881337] px-6 py-2.5 text-xs font-black text-white hover:bg-[#9f1239] active:scale-95 dark:bg-[#dc2626] dark:hover:bg-[#ef4444]">
              {t("Go to SOS")} 🚨
            </Button>
          </section>
        )}

        {status.isFetching && (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-[#ca8a04] dark:text-[#facc15]">
            <Clock3 className="h-4 w-4 animate-spin" /> {t("Updating rescue flow")}…
          </p>
        )}

        {status.error && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-[#b91c1c] dark:text-[#fca5a5]">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{status.error.message}</p>
          </div>
        )}

        {status.data && (
          <section className="mt-5 overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#18191d]">
            {/* Rich Card Header */}
            <div className="bg-gradient-to-br from-[#121316] via-[#1a1c22] to-[#0a0b0d] p-5 text-white dark:from-[#0a0b0d] dark:via-[#16181d] dark:to-[#0f1013]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#eab308] dark:text-[#facc15]">
                  <span>⚡</span> {t("Live rescue flow")}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/80">
                  {stages[activeIndex]?.emoji} {stages[activeIndex]?.label}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white">{stages[activeIndex]?.label}</h1>
              <p className="mt-1 text-xs text-white/70">{stages[activeIndex]?.copy}</p>
              
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p aria-label="SOS tracking number" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 font-mono text-xs font-black tracking-wide text-white ring-1 ring-white/20">
                  <span className="text-[#facc15]">{t("Tracking no.")}</span>
                  <span>{status.data.publicCode}</span>
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/90">
                  <MapPin className="h-3.5 w-3.5 text-[#eab308]" />
                  <span className="truncate max-w-[180px]">{status.data.locationLabel}</span>
                </div>
              </div>
            </div>

            {/* Stepper with Pulsating Indicator */}
            <div className="p-5">
              <ol className="relative ml-4 border-l-2 border-[#e7e5e4] pl-6 dark:border-[#292524]">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const reached = index <= activeIndex;
                  const isCurrent = index === activeIndex;
                  return (
                    <li key={stage.key} className="relative pb-7 last:pb-0">
                      <span className={`absolute -left-[2.45rem] grid h-8 w-8 place-items-center rounded-full border-2 transition ${
                        isCurrent
                          ? "border-[#eab308] bg-[#eab308] text-black shadow-[0_0_16px_rgba(234,179,8,0.5)] dark:bg-[#facc15]"
                          : reached
                          ? "border-[#881337] bg-[#881337] text-white dark:border-[#dc2626] dark:bg-[#dc2626]"
                          : "border-[#d6d3d1] bg-white text-[#a8a29e] dark:border-[#44403c] dark:bg-[#1c1917]"
                      }`}>
                        {isCurrent && (
                          <span className="absolute -inset-1 animate-ping rounded-full bg-[#eab308] opacity-50 dark:bg-[#facc15]" />
                        )}
                        <Icon className="relative h-4 w-4" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{stage.emoji}</span>
                        <p className={`text-sm font-black ${
                          isCurrent
                            ? "text-[#881337] dark:text-[#facc15]"
                            : reached
                            ? "text-[#1c1917] dark:text-[#f8fafc]"
                            : "text-[#a8a29e] dark:text-[#78716c]"
                        }`}>
                          {stage.label}
                        </p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#78716c] dark:text-[#a8a29e]">
                        {index === 1 && !status.data.assignedRescuer ? t("Searching for rescuer...") : stage.copy}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {(status.data as any).destinationHospitalName && (
                <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-[#881337]/30 bg-[#fff1f2] p-3.5 text-xs font-extrabold text-[#881337] dark:border-[#881337]/50 dark:bg-[#450a0a]/30 dark:text-[#fca5a5]">
                  <span>🏥</span>
                  <span>{t("En route to")} {(status.data as any).destinationHospitalName}</span>
                </div>
              )}

              {status.data.assignedRescuer && (
                <div className="mt-5 rounded-2xl border border-black/5 bg-[#fdfcf7] p-3 shadow-sm dark:border-white/5 dark:bg-[#121316]">
                  <AssignedRescuerCard rescuer={status.data.assignedRescuer} hospital={(status.data as any).destinationHospital} />
                </div>
              )}

              {status.data.status === "resolved" && (
                <PostRescueCheckInCard publicCode={status.data.publicCode} />
              )}

              <IncidentChat publicCode={status.data.publicCode} active={status.data.status !== "resolved"} />

              <div className="mt-4 rounded-xl border border-[#eab308]/40 bg-[#fefce8] p-3.5 text-xs font-semibold leading-5 text-[#854d0e] dark:border-[#eab308]/30 dark:bg-[#713f12]/20 dark:text-[#fef08a]">
                <ShieldCheck className="mr-2 inline h-4 w-4 text-[#ca8a04] dark:text-[#facc15]" />
                {user
                  ? t("Only your authorized account can add details or message the rescue team.")
                  : t("Sign in with the reporting account to add details or message the rescue team.")}
              </div>
            </div>
          </section>
        )}
      </main>
      <VictimNavigation current="track" />
    </div>
  );
}
