import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLatestSos, rememberLatestSos } from "@/lib/rapidSos";
import { stopBleSosBeacon } from "@/lib/bleBeacon";
import { trpc } from "@/lib/trpc";
import { VictimNavigation } from "@/components/VictimNavigation";
import { AssignedRescuerCard, IncidentChat, PostRescueCheckInCard } from "@/components/TrackIncidentComponents";
export { AssignedRescuerCard, IncidentChat, PostRescueCheckInCard } from "@/components/TrackIncidentComponents";
import { useLiveRescuerStream } from "@/hooks/useLiveRescuerStream";
import { usePortalStream } from "@/hooks/usePortalStream";
import { pendingSosCount, flushOfflineSos } from "@/lib/offlineSos";
import { clearSosVoiceNote } from "@/lib/sosVoiceNote";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, Radio, ShieldCheck, Siren } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function UserTrackFlow() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const codeFromPath = new URLSearchParams(window.location.search).get("code")?.toUpperCase() || "";
  const [trackedCode, setTrackedCode] = useState<string>(codeFromPath || getLatestSos());
  const publicCode = codeFromPath || trackedCode || getLatestSos();

  useEffect(() => {
    if (publicCode) rememberLatestSos(publicCode);
  }, [publicCode]);

  // Offline SOS outbox flush on reconnect
  const createSos = trpc.rescue.emergency.create.useMutation();
  useEffect(() => {
    let active = true;
    const flushOutbox = async () => {
      if (!navigator.onLine) return;
      try {
        const count = await pendingSosCount();
        if (count > 0 && active) {
          const result = await flushOfflineSos((payload: any) => createSos.mutateAsync(payload));
          if (result.delivered.length > 0 && active) {
            clearSosVoiceNote();
            const newCode = result.delivered[0];
            rememberLatestSos(newCode);
            setTrackedCode(newCode);
            if (typeof window !== "undefined" && window.history?.replaceState) {
              window.history.replaceState({}, "", `/track?code=${newCode}`);
            }
          }
        }
      } catch (err) {
        console.warn("[UserTrackFlow] Offline SOS outbox flush notice:", err);
      }
    };

    void flushOutbox();
    const onlineHandler = () => void flushOutbox();
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") void flushOutbox();
    };

    window.addEventListener("online", onlineHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      active = false;
      window.removeEventListener("online", onlineHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  const validPublicCode = /^SOS-[A-Z0-9]{8}$/.test(publicCode) ? publicCode : null;
  usePortalStream("citizen", { enabled: Boolean(validPublicCode), trackingCode: validPublicCode });
  const liveStream = useLiveRescuerStream(validPublicCode);
  const status = trpc.rescue.emergency.statusByCode.useQuery(
    { publicCode },
    {
      enabled: /^SOS-[A-Z0-9]{8}$/.test(publicCode),
      refetchInterval: (query) => {
        // If unassigned, poll aggressively at 3s so rescuer acceptance reflects immediately
        const hasRescuer = Boolean(query.state.data?.assignedRescuer);
        if (!hasRescuer) return 3_000;
        return liveStream.pollingIntervalMs ?? 10_000;
      },
      refetchIntervalInBackground: true,
      retry: false,
    }
  );
  useEffect(() => {
    if (status.data?.status === "resolved") {
      void stopBleSosBeacon({ clearId: true });
    }
  }, [status.data?.status]);

const stages = useMemo(
    () =>
      [
        { key: "pending", label: t("SOS received"), copy: t("Searching for rescuer..."), icon: Siren },
        { key: "dispatched", label: t("Rescuer assigned"), copy: t("Your responder’s profile and live updates appear here"), icon: Radio },
        { key: "resolved", label: t("Rescue completed"), copy: t("This rescue flow is recorded on this device"), icon: CheckCircle2 },
      ] as const,
    [t]
  );

  const activeIndex = status.data ? Math.max(0, stages.findIndex((stage) => stage.key === status.data!.status)) : 0;

  return (
    <div className="victim-page relative min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC] overflow-x-hidden">
      {/* iOS Liquid Glass Ambient Refraction Layer */}
      <div className="liquid-ambient-bg" />

      <main className="victim-main relative z-10 mx-auto min-h-screen w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-36 pt-6">
        {/* Top Header Card */}
        <header className="glass-card mb-5 flex items-center justify-between p-3.5 shadow-sm">
          <button
            onClick={() => setLocation("/citizen")}
            className="flex items-center gap-3 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1D4ED8] text-white shadow-md shadow-[#1D4ED8]/20">
              <ArrowLeft className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                {t("Your rescue flow")}
              </span>
              <span className="block text-xs font-semibold text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                {t("Saved on this device")}
              </span>
            </span>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Empty State when no SOS is recorded */}
        {!publicCode && (
          <section className="glass-panel mt-6 border-dashed border-[#E2E8F0]/40 p-8 text-center dark:border-[#F1F5F9]/20">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#1D4ED8]/25 dark:text-[#F1F5F9]">
              <Siren className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-black text-[#0F172A] dark:text-[#F8FAFC]">{t("No active SOS yet")}</h1>
            <p className="mt-2 text-sm leading-6 text-[#0F172A]/70 dark:text-[#F1F5F9]/70 max-w-md mx-auto">
              {t("When you activate SOS, your rescue flow will remain here—even after refresh.")}
            </p>
            <Button
              onClick={() => setLocation("/citizen")}
              className="mt-6 rounded-xl bg-[#1D4ED8] px-6 py-2.5 font-bold text-white shadow-md shadow-[#1D4ED8]/25 hover:bg-[#1d47db]"
            >
              {t("Go to SOS")}
            </Button>
          </section>
        )}

        {status.isFetching && (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
            <Clock3 className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" /> {t("Updating rescue flow")}
          </p>
        )}

        {status.error && (
          <div role="alert" className="mt-4 flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{status.error.message}</p>
          </div>
        )}

        {status.data && (
          <section className="glass-panel mt-6 overflow-hidden">
            {/* Dark Navy Header Showcase */}
            <div className="glass-panel-dark bg-[#0F172A] p-5 text-white dark:bg-[#0c1433]">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#F1F5F9]">
                {t("Live rescue flow")}
              </p>
              <h1 className="mt-2 text-2xl font-black text-[#F8FAFC]">{stages[activeIndex]?.label}</h1>
              <p className="mt-1 text-sm text-[#F1F5F9]/80">{stages[activeIndex]?.copy}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p
                  aria-label="SOS tracking number"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 font-mono text-xs font-bold text-[#F8FAFC] backdrop-blur-xs"
                >
                  <span className="text-[#F1F5F9]">{t("Tracking no.")}</span>
                  <span>{status.data.publicCode}</span>
                </p>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#F1F5F9]">
                  <MapPin className="h-3.5 w-3.5 text-[#1D4ED8]" />
                  <span>{status.data.locationLabel}</span>
                </div>
              </div>
            </div>

            {/* Stepper & Details */}
            <div className="p-5">
              <ol className="relative ml-3 border-l-2 border-[#F1F5F9]/40 pl-6 dark:border-[#1D4ED8]/30">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const reached = index <= activeIndex;
                  return (
                    <li key={stage.key} className="relative pb-7 last:pb-0">
                      <span
                        className={`absolute -left-[2.35rem] grid h-7 w-7 place-items-center rounded-full border-2 transition-all ${reached
                            ? "border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-sm"
                            : "border-[#94A3B8]/40 bg-slate-100 text-[#475569] dark:bg-[#0F172A] dark:border-[#64748B]/50 dark:text-[#94A3B8]"
                          }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className={`text-sm font-black ${reached ? "text-[#0F172A] dark:text-[#F8FAFC]" : "text-[#475569] dark:text-[#94A3B8]"}`}>
                        {stage.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                        {index === 1 && !status.data.assignedRescuer ? t("Searching for rescuer...") : stage.copy}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {(status.data as any).destinationHospitalName && (
                <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
                  <span>🏥</span>
                  <span>
                    {t("En route to")} {(status.data as any).destinationHospitalName}
                  </span>
                </div>
              )}

              {status.data.assignedRescuer && (
                <div className="mt-5">
                  <AssignedRescuerCard
                    rescuer={status.data.assignedRescuer}
                    hospital={(status.data as any).destinationHospital}
                    liveRescuer={liveStream.rescuer}
                    liveRoute={liveStream.route}
                    isStale={liveStream.isStale}
                    lastEventAt={liveStream.lastEventAt}
                  />
                </div>
              )}

              {status.data.status === "resolved" && (
                <div className="mt-5">
                  <PostRescueCheckInCard publicCode={status.data.publicCode} />
                </div>
              )}

              <div className="mt-5">
                <IncidentChat
                  publicCode={status.data.publicCode}
                  active={status.data.status !== "resolved"}
                  voiceNoteUrl={(status.data as any).voiceNoteUrl}
                  voiceNoteDurationSeconds={(status.data as any).voiceNoteDurationSeconds}
                />
              </div>

              <div className="mt-5 rounded-xl border border-[#1D4ED8]/20 bg-[#1D4ED8]/5 p-3.5 text-xs leading-5 text-[#0F172A] dark:text-[#F1F5F9]">
                <ShieldCheck className="mr-2 inline h-4 w-4 text-[#1D4ED8]" />
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
