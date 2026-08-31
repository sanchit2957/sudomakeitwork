import React, { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, CheckCircle2, Clock, HeartPulse, LifeBuoy, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SosClassificationModalProps {
  isOpen: boolean;
  publicCode: string;
  incidentId?: number;
  triageDeadlineAt?: Date | string | null;
  onComplete: (category: "medical" | "rescue" | "emergency") => void;
}

export function SosClassificationModal({
  isOpen,
  publicCode,
  incidentId,
  triageDeadlineAt,
  onComplete,
}: SosClassificationModalProps) {
  const { t } = useLanguage();
  const selectCategory = trpc.rescue.emergency.selectCategory.useMutation();

  const [timeLeft, setTimeLeft] = useState(10);
  const [selected, setSelected] = useState<"medical" | "rescue" | "emergency" | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Calculate deadline from server timestamp if provided
    const deadlineMs = triageDeadlineAt ? new Date(triageDeadlineAt).getTime() : Date.now() + 10_000;

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, deadlineMs - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      setTimeLeft(remainingSec);

      if (remainingMs <= 0) {
        clearInterval(interval);
        if (!selected) {
          setIsExpired(true);
          // Wait 1.2s to show timeout message then finalize with default emergency category
          setTimeout(() => {
            onComplete("emergency");
          }, 1200);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, triageDeadlineAt, selected]);

  const handleSelect = async (category: "medical" | "rescue" | "emergency") => {
    if (selected || isExpired) return;
    setSelected(category);

    try {
      await selectCategory.mutateAsync({
        publicCode,
        incidentId,
        category,
      });
    } catch (err) {
      console.warn("[Triage] selectCategory mutation warning:", err);
    }

    setTimeout(() => {
      onComplete(category);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="triage-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border-2 border-red-500/30 bg-[#0f1715] p-6 text-white shadow-2xl shadow-red-950/60 ring-1 ring-white/10 sm:p-7">
        {/* Emergency Pulse Glow */}
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-emerald-600/15 blur-3xl" />

        {/* Top Status & Public Code */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-300 ring-1 ring-red-500/40">
            <ShieldAlert className="h-4 w-4 animate-pulse text-red-400" />
            <span>{t("SOS Registered")}</span>
          </div>
          <span className="font-mono text-xs font-extrabold text-emerald-400">
            {publicCode}
          </span>
        </div>

        {/* Header */}
        <div className="mt-4 text-center">
          <h1
            id="triage-heading"
            className="text-xl font-black tracking-tight text-white sm:text-2xl"
          >
            {t("WHAT KIND OF HELP DO YOU NEED?")}
          </h1>
          <p className="mt-1 text-xs font-semibold text-zinc-400">
            {t("Tap below or auto-dispatch starts in")} <span className="font-mono text-base font-black text-amber-400">{timeLeft}s</span>
          </p>
        </div>

        {/* Visual Countdown Progress Bar */}
        <div className="mt-3 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all duration-300 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 10) * 100))}%` }}
          />
        </div>

        {/* Category Cards */}
        <div className="mt-5 grid gap-3">
          {/* 1. Medical */}
          <button
            type="button"
            data-testid="triage-option-medical"
            onClick={() => handleSelect("medical")}
            disabled={Boolean(selected) || isExpired}
            className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === "medical"
                ? "border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400"
                : "border-red-900/40 bg-zinc-900/80 hover:border-red-500 hover:bg-zinc-800/90 hover:shadow-lg hover:shadow-red-950/30"
            }`}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-500/20 text-red-400 group-hover:scale-105 transition-transform">
              <HeartPulse className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-white">
                  {t("Medical Help")}
                </span>
                {selected === "medical" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-in zoom-in-50" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                {t("Injured, sick, ambulance, or urgent doctor required")}
              </p>
            </div>
          </button>

          {/* 2. Rescue / Trapped */}
          <button
            type="button"
            data-testid="triage-option-rescue"
            onClick={() => handleSelect("rescue")}
            disabled={Boolean(selected) || isExpired}
            className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === "rescue"
                ? "border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400"
                : "border-blue-900/40 bg-zinc-900/80 hover:border-blue-500 hover:bg-zinc-800/90 hover:shadow-lg hover:shadow-blue-950/30"
            }`}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-105 transition-transform">
              <LifeBuoy className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-white">
                  {t("Rescue / Trapped")}
                </span>
                {selected === "rescue" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-in zoom-in-50" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                {t("Trapped by floodwaters, roof rescue, boat or evacuation needed")}
              </p>
            </div>
          </button>

          {/* 3. Emergency / Immediate Danger */}
          <button
            type="button"
            data-testid="triage-option-emergency"
            onClick={() => handleSelect("emergency")}
            disabled={Boolean(selected) || isExpired}
            className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === "emergency"
                ? "border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400"
                : "border-amber-900/40 bg-zinc-900/80 hover:border-amber-500 hover:bg-zinc-800/90 hover:shadow-lg hover:shadow-amber-950/30"
            }`}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-white">
                  {t("Emergency / Immediate Danger")}
                </span>
                {selected === "emergency" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-in zoom-in-50" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                {t("Immediate life threat, high danger, all-hazard assistance")}
              </p>
            </div>
          </button>
        </div>

        {/* Timeout / Feedback Banner */}
        {isExpired && !selected && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/60 p-3 text-center text-xs font-bold text-amber-300 animate-in fade-in"
          >
            <Clock className="mr-1.5 inline h-4 w-4" />
            {t("Time expired — Emergency response has been activated automatically.")}
          </div>
        )}

        {selected && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-3 text-center text-xs font-bold text-emerald-300 animate-in fade-in"
          >
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
            {t("Dispatching nearest qualified team…")}
          </div>
        )}
      </div>
    </div>
  );
}
