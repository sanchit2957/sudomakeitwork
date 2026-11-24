import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLatestSos, rememberLatestSos } from "@/lib/rapidSos";
import { trpc } from "@/lib/trpc";
import { VictimNavigation } from "@/pages/Home";
import { AssignedRescuerCard, IncidentChat, PostRescueCheckInCard } from "@/pages/Track";
import { useLiveRescuerStream } from "@/hooks/useLiveRescuerStream";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, MapPin, Radio, ShieldCheck, Siren } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

export default function UserTrackFlow() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const codeFromPath = new URLSearchParams(window.location.search).get("code")?.toUpperCase() || "";
  const publicCode = codeFromPath || getLatestSos();

  useEffect(() => {
    if (publicCode) rememberLatestSos(publicCode);
  }, [publicCode]);

  const liveStream = useLiveRescuerStream(/^SOS-[A-Z0-9]{8}$/.test(publicCode) ? publicCode : null);
  const status = trpc.rescue.emergency.statusByCode.useQuery(
    { publicCode },
    {
      enabled: /^SOS-[A-Z0-9]{8}$/.test(publicCode),
      refetchInterval: liveStream.pollingIntervalMs ?? 20_000,
      refetchIntervalInBackground: true,
      retry: false,
    }
  );

  const stages = useMemo(
    () =>
      [
        { key: "pending", label: t("SOS received"), copy: t("Searching for nearest field responder…"), icon: Siren },
        { key: "dispatched", label: t("Rescuer assigned"), copy: t("Live responder telemetry & route navigation active"), icon: Radio },
        { key: "resolved", label: t("Rescue completed"), copy: t("This rescue incident is archived on this device"), icon: CheckCircle2 },
      ] as const,
    [t]
  );

  const activeIndex = status.data ? Math.max(0, stages.findIndex((stage) => stage.key === status.data!.status)) : 0;

  return (
    <div className="victim-page relative min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-28 pt-4">
        {/* Top Header Card */}
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-sky-500 dark:text-slate-950 font-black">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {t("Your rescue flow")}
              </span>
              <span className="block text-[10px] font-bold text-muted-foreground">
                {t("Saved locally on this device")}
              </span>
            </span>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Empty State when no SOS is recorded */}
        {!publicCode && (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Siren className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{t("No active SOS yet")}</h1>
            <p className="mt-2 text-xs leading-5 text-muted-foreground max-w-md mx-auto">
              {t("When you activate SOS, your rescue flow and live responder position will remain here—even after refresh.")}
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="mt-6 rounded-xl bg-rose-600 px-6 py-2.5 font-bold text-white shadow-xs hover:bg-rose-700"
            >
              {t("Go to SOS Hub")}
            </Button>
          </section>
        )}

        {status.isFetching && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 animate-spin text-sky-500" /> {t("Updating rescue flow")}
          </p>
        )}

        {status.error && (
          <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{status.error.message}</p>
          </div>
        )}

        {status.data && (
          <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {/* Reassuring Crisis Status Header (Direction 3: Calm & Humane) */}
            <div className="border-b border-border bg-muted/40 p-5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("Live Rescue Status")}
              </span>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {stages[activeIndex]?.label}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {stages[activeIndex]?.copy}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  aria-label={t("SOS tracking number")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs font-bold text-foreground"
                >
                  <span className="text-muted-foreground">{t("Incident:")}</span>
                  <span>{status.data.publicCode}</span>
                </span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="font-medium text-foreground">{status.data.locationLabel}</span>
                </div>
              </div>
            </div>

            {/* Stepper & Details */}
            <div className="p-5 sm:p-6">
              <ol className="relative ml-3 border-l-2 border-border pl-6">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const reached = index <= activeIndex;
                  return (
                    <li key={stage.key} className="relative pb-6 last:pb-0">
                      <span
                        className={`absolute -left-[2.15rem] grid h-6 w-6 place-items-center rounded-full border-2 transition-all ${
                          reached
                            ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <p className={`text-sm font-semibold ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                        {stage.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        {index === 1 && !status.data.assignedRescuer ? t("Searching for nearby rescuer…") : stage.copy}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {(status.data as any).destinationHospitalName && (
                <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
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
                <IncidentChat publicCode={status.data.publicCode} active={status.data.status !== "resolved"} />
              </div>

              <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {user
                    ? t("Only your authorized account can add details or message the rescue team.")
                    : t("Sign in with the reporting account to add details or message the rescue team.")}
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
      <VictimNavigation current="track" />
    </div>
  );
}
