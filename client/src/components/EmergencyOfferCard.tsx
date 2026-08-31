import React, { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Clock, HeartPulse, LifeBuoy, MapPin, Navigation, ShieldAlert, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActiveOfferData {
  offer: {
    id: number;
    distanceKm: number;
    matchScore: number;
    status: string;
    offeredAt: Date | string;
    expiresAt: Date | string;
  };
  incident: {
    id: number;
    publicCode: string;
    locationLabel: string;
    latitude: number;
    longitude: number;
    requestCategory: "medical" | "rescue" | "emergency";
    emergencyType: string;
    severity: "critical" | "high" | "medium" | "low";
    peopleAffected: number;
    notes?: string | null;
  };
}

interface EmergencyOfferCardProps {
  data: ActiveOfferData;
  onAccepted?: (missionId: number) => void;
  onDeclined?: () => void;
}

export function EmergencyOfferCard({ data, onAccepted, onDeclined }: EmergencyOfferCardProps) {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const acceptOffer = trpc.rescue.rescuer.acceptMissionOffer.useMutation();
  const declineOffer = trpc.rescue.rescuer.declineMissionOffer.useMutation();

  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const [isExpired, setIsExpired] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { offer, incident } = data;

  useEffect(() => {
    const expiresMs = new Date(offer.expiresAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diffMs = expiresMs - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setSecondsRemaining(sec);

      if (diffMs <= 0) {
        clearInterval(interval);
        setIsExpired(true);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [offer.expiresAt]);

  const handleAccept = async () => {
    if (isExpired || acceptOffer.isPending || declineOffer.isPending) return;
    setErrorMsg("");
    try {
      const result = await acceptOffer.mutateAsync({ offerId: offer.id });
      void utils.rescue.rescuer.activeOffer.invalidate();
      void utils.rescue.rescuer.missions.invalidate();
      void utils.rescue.rescuer.profile.invalidate();
      onAccepted?.(result.missionId);
    } catch (err: any) {
      setErrorMsg(err.message || t("Failed to accept mission offer."));
    }
  };

  const handleDecline = async () => {
    if (isExpired || acceptOffer.isPending || declineOffer.isPending) return;
    setErrorMsg("");
    try {
      await declineOffer.mutateAsync({ offerId: offer.id });
      void utils.rescue.rescuer.activeOffer.invalidate();
      onDeclined?.();
    } catch (err: any) {
      setErrorMsg(err.message || t("Failed to decline mission offer."));
    }
  };

  const formattedCountdown = `00:0${Math.min(9, secondsRemaining)}`;

  const CategoryIcon =
    incident.requestCategory === "medical"
      ? HeartPulse
      : incident.requestCategory === "rescue"
      ? LifeBuoy
      : ShieldAlert;

  const categoryLabel =
    incident.requestCategory === "medical"
      ? t("Medical")
      : incident.requestCategory === "rescue"
      ? t("Rescue / Trapped")
      : t("Emergency Response");

  const severityTone =
    incident.severity === "critical"
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : incident.severity === "high"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-blue-500/20 text-blue-300 border-blue-500/40";

  return (
    <article
      data-testid="emergency-offer-card"
      role="region"
      aria-label="New Emergency Request"
      className="relative overflow-hidden rounded-[1.8rem] border-2 border-red-500/60 bg-gradient-to-b from-[#181113] to-[#0f1715] p-5 text-white shadow-2xl shadow-red-950/70 ring-1 ring-red-500/30"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-3 border-b border-red-500/20 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <h2 className="text-sm font-black uppercase tracking-wider text-red-400">
            {t("NEW EMERGENCY REQUEST")}
          </h2>
        </div>
        <span className="font-mono text-xs font-bold text-zinc-400">
          {incident.publicCode}
        </span>
      </div>

      {/* Main Details Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Type */}
        <div className="rounded-xl bg-white/5 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t("Type")}
          </p>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-white text-xs">
            <CategoryIcon className="h-4 w-4 text-emerald-400" />
            <span className="truncate">{categoryLabel}</span>
          </div>
        </div>

        {/* Priority */}
        <div className="rounded-xl bg-white/5 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t("Priority")}
          </p>
          <span
            className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${severityTone}`}
          >
            {incident.severity}
          </span>
        </div>

        {/* Distance */}
        <div className="rounded-xl bg-white/5 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t("Distance")}
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs font-black text-emerald-300">
            <Navigation className="h-3.5 w-3.5" />
            {offer.distanceKm.toFixed(1)} km
          </p>
        </div>

        {/* People */}
        <div className="rounded-xl bg-white/5 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t("People")}
          </p>
          <p className="mt-1 flex items-center gap-1 font-bold text-white text-xs">
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            {incident.peopleAffected || 1}
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 p-3 text-xs">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <span className="font-semibold text-zinc-200">{incident.locationLabel}</span>
      </div>

      {/* Countdown Timer */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
          <Clock className="h-4 w-4 animate-spin" />
          <span>{t("Offer expires in:")}</span>
        </div>
        <span
          data-testid="offer-countdown"
          className="font-mono text-sm font-black tracking-widest text-amber-400"
        >
          {isExpired ? "00:00" : formattedCountdown}
        </span>
      </div>

      {/* Error Feedback */}
      {errorMsg && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/60 p-2.5 text-xs text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          data-testid="accept-offer-btn"
          disabled={isExpired || acceptOffer.isPending || declineOffer.isPending}
          onClick={handleAccept}
          className="h-11 rounded-xl bg-emerald-600 font-extrabold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
        >
          <Check className="mr-1.5 h-5 w-5" />
          {acceptOffer.isPending ? t("Accepting…") : t("ACCEPT")}
        </Button>

        <Button
          data-testid="decline-offer-btn"
          variant="outline"
          disabled={isExpired || acceptOffer.isPending || declineOffer.isPending}
          onClick={handleDecline}
          className="h-11 rounded-xl border-red-500/40 bg-transparent font-extrabold text-red-400 hover:bg-red-950/40 hover:text-red-300 active:scale-[0.98] disabled:opacity-50"
        >
          <X className="mr-1.5 h-5 w-5" />
          {declineOffer.isPending ? t("Declining…") : t("DECLINE")}
        </Button>
      </div>
    </article>
  );
}
