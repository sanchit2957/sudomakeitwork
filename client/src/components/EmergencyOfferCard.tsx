import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Clock, HeartPulse, LifeBuoy, MapPin, Navigation, ShieldAlert, Users, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/apiConfig";

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
    voiceNoteUrl?: string | null;
    voiceNoteDurationSeconds?: number | null;
  };
}

interface EmergencyOfferCardProps {
  data: ActiveOfferData;
  onAccepted?: (missionId: number) => void;
  onDeclined?: () => void;
}

type ActionState = "idle" | "accepting" | "declining" | "expired" | "success" | "error";

/**
 * Emergency Siren Synthesizer — Responder Alert.
 * Synthesizes a realistic wailing police/ambulance siren sweep:
 * 600 Hz → 1200 Hz → 600 Hz (0.9s per full cycle) using Web Audio API.
 * No network required; works even in background tabs.
 */
export class EmergencyAudioAlert {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;
  private isPlaying = false;
  private isMuted = false;

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    return this.ctx;
  }

  /** Play one full siren wail cycle: sweeps 600→1200→600 Hz over ~1 second */
  playBeepPulse() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const now = ctx.currentTime;

      // Create a compressor to keep it from clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.ratio.value = 4;
      compressor.connect(ctx.destination);

      // Master gain envelope — fast attack, sustained, fast release
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0, now);
      masterGain.gain.linearRampToValueAtTime(0.35, now + 0.04); // fast attack
      masterGain.gain.setValueAtTime(0.35, now + 0.82);           // sustain
      masterGain.gain.linearRampToValueAtTime(0.0, now + 0.90);  // fast release
      masterGain.connect(compressor);

      // Primary oscillator: sawtooth for bright siren timbre
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      // Sweep up 600 → 1200 Hz over 0.45s, then back down 1200 → 600 Hz over 0.45s
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.45);
      osc.frequency.linearRampToValueAtTime(600, now + 0.90);

      // Second oscillator slightly detuned for richer sound (+15 cents)
      const osc2 = ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(617, now);   // 600 * 2^(15/1200) ≈ 617
      osc2.frequency.linearRampToValueAtTime(1235, now + 0.45);
      osc2.frequency.linearRampToValueAtTime(617, now + 0.90);
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.4; // slightly quieter
      osc2.connect(osc2Gain);
      osc2Gain.connect(masterGain);

      osc.connect(masterGain);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.95);
      osc2.stop(now + 0.95);
    } catch {
      // Gracefully catch autoplay block or unsupported API
    }
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playBeepPulse();
    // Fire another sweep every 1 second (slightly longer than cycle to chain naturally)
    this.intervalId = setInterval(() => {
      if (this.isPlaying) {
        this.playBeepPulse();
      }
    }, 1000);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted && this.isPlaying) {
      this.playBeepPulse();
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }
}

export function EmergencyOfferCard({ data, onAccepted, onDeclined }: EmergencyOfferCardProps) {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const acceptOffer = trpc.rescue.rescuer.acceptMissionOffer.useMutation();
  const declineOffer = trpc.rescue.rescuer.declineMissionOffer.useMutation();

  const { offer, incident } = data;

  const initialSeconds = useMemo(() => {
    const expiresMs = new Date(offer.expiresAt).getTime();
    const offeredMs = offer.offeredAt ? new Date(offer.offeredAt).getTime() : expiresMs - 30_000;
    const diffMs = expiresMs - Date.now();
    const calculated = Math.ceil(diffMs / 1000);
    if (calculated > 0 && calculated <= 120) return calculated;
    const duration = Math.ceil((expiresMs - offeredMs) / 1000);
    return duration > 0 ? duration : 30;
  }, [offer.expiresAt, offer.offeredAt]);

  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const alertRef = useRef<EmergencyAudioAlert | null>(null);
  const actionLockRef = useRef<boolean>(false);

  useEffect(() => {
    const alert = new EmergencyAudioAlert();
    alertRef.current = alert;
    alert.start();

    const startLocal = Date.now();
    const totalRemaining = initialSeconds;

    const checkTimer = () => {
      // Prevent timer action if a user action is already in progress
      if (actionLockRef.current) return;

      const elapsedMs = Date.now() - startLocal;
      const sec = Math.max(0, Math.ceil(totalRemaining - elapsedMs / 1000));
      setSecondsRemaining(sec);

      if (sec <= 0 && !actionLockRef.current) {
        actionLockRef.current = true;
        setActionState("expired");
        alert.stop();
        // Auto-trigger decline & reassignment when timer expires
        declineOffer
          .mutateAsync({ offerId: offer.id })
          .catch(() => {})
          .finally(() => {
            void utils.rescue.rescuer.activeOffer.invalidate();
            onDeclined?.();
          });
      }
    };

    const interval = setInterval(checkTimer, 250);

    return () => {
      clearInterval(interval);
      alert.stop();
    };
  }, [offer.id, initialSeconds]);

  const handleAccept = async () => {
    if (actionLockRef.current || actionState === "expired") return;
    actionLockRef.current = true;
    setActionState("accepting");
    setErrorMsg("");
    alertRef.current?.stop();
    try {
      const result = await acceptOffer.mutateAsync({ offerId: offer.id });
      setActionState("success");
      void utils.rescue.rescuer.activeOffer.invalidate();
      void utils.rescue.rescuer.missions.invalidate();
      void utils.rescue.rescuer.profile.invalidate();
      onAccepted?.(result.missionId);
    } catch (err: any) {
      setErrorMsg(err.message || t("Failed to accept mission offer."));
      setActionState("error");
      actionLockRef.current = false; // Allow retry if not expired
      // Do not silently fail. If it was already assigned, we still show the error and wait for the parent to close if it wants, or user clicks away. But the parent handles activeOffer change.
      // Wait, if it failed, activeOffer might still be valid or not.
      if (err.message?.includes("already assigned") || err.message?.includes("expired")) {
        // If it's permanently invalid, wait for polling to clean it up or decline it
      }
    }
  };

  const handleDecline = async () => {
    if (actionLockRef.current || actionState === "expired") return;
    actionLockRef.current = true;
    setActionState("declining");
    setErrorMsg("");
    alertRef.current?.stop();
    try {
      await declineOffer.mutateAsync({ offerId: offer.id });
      setActionState("success");
      void utils.rescue.rescuer.activeOffer.invalidate();
      onDeclined?.();
    } catch (err: any) {
      setErrorMsg(err.message || t("Failed to decline mission offer."));
      setActionState("error");
      actionLockRef.current = false; // Allow retry
    }
  };

  const toggleSound = () => {
    if (alertRef.current) {
      const muted = alertRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const formattedCountdown = `00:${String(Math.max(0, secondsRemaining)).padStart(2, "0")}`;

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
      ? "bg-red-100 text-red-700 border-red-300"
      : incident.severity === "high"
      ? "bg-amber-100 text-amber-700 border-amber-300"
      : "bg-blue-100 text-blue-700 border-blue-300";

  return (
    <article
      data-testid="emergency-offer-card"
      role="region"
      aria-label="New Emergency Request"
      className="relative overflow-hidden rounded-[1.8rem] border-2 border-red-500 bg-white p-5 text-gray-900 shadow-2xl shadow-red-200 ring-4 ring-red-100 ring-offset-2"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-3 border-b border-red-200 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
          </span>
          <h2 className="text-sm font-black uppercase tracking-wider text-red-600">
            {t("NEW EMERGENCY REQUEST")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={isMuted ? "Unmute alert chime" : "Mute alert chime"}
            className="rounded-lg bg-red-50 p-1.5 text-gray-500 hover:bg-red-100 hover:text-gray-800 transition border border-red-200"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-red-500 animate-pulse" />}
          </button>
          <span className="font-mono text-xs font-bold text-gray-400">
            {incident.publicCode}
          </span>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Type */}
        <div className="rounded-xl bg-red-50 border border-red-100 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {t("Type")}
          </p>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-gray-800 text-xs">
            <CategoryIcon className="h-4 w-4 text-red-600" />
            <span className="truncate">{categoryLabel}</span>
          </div>
        </div>

        {/* Priority */}
        <div className="rounded-xl bg-red-50 border border-red-100 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {t("Priority")}
          </p>
          <span
            className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${severityTone}`}
          >
            {incident.severity}
          </span>
        </div>

        {/* Distance */}
        <div className="rounded-xl bg-red-50 border border-red-100 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {t("Distance")}
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs font-black text-red-600">
            <Navigation className="h-3.5 w-3.5" />
            {offer.distanceKm.toFixed(1)} km
          </p>
        </div>

        {/* People */}
        <div className="rounded-xl bg-red-50 border border-red-100 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {t("People")}
          </p>
          <p className="mt-1 flex items-center gap-1 font-bold text-gray-800 text-xs">
            <Users className="h-3.5 w-3.5 text-gray-500" />
            {incident.peopleAffected || 1}
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <span className="font-semibold text-gray-800">{incident.locationLabel}</span>
      </div>

      {incident.notes && (
        <p className="mt-2 text-xs italic text-gray-500 line-clamp-2 px-1">
          "{incident.notes}"
        </p>
      )}

      {incident.voiceNoteUrl && (
        <div
          data-testid="offer-voice-note"
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 font-bold text-amber-900">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {t("Voice message attached")}
              {incident.voiceNoteDurationSeconds ? ` (${incident.voiceNoteDurationSeconds}s)` : ""}
            </span>
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
              {t("Citizen audio")}
            </span>
          </div>
          <audio
            controls
            preload="metadata"
            src={getApiUrl(incident.voiceNoteUrl)}
            className="h-9 w-full rounded-lg"
          />
        </div>
      )}

      {/* 30-Second Countdown Timer & Progress Bar */}
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
            <Clock className="h-4 w-4 animate-spin text-amber-500" />
            <span>{t("Offer expires in:")}</span>
          </div>
          <span
            data-testid="offer-countdown"
            className="font-mono text-sm font-black tracking-widest text-amber-700"
          >
            {actionState === "expired" ? "00:00" : formattedCountdown}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all duration-300 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, (secondsRemaining / 30) * 100))}%` }}
          />
        </div>
      </div>

      {/* Error Feedback */}
      {errorMsg && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          data-testid="accept-offer-btn"
          disabled={actionState !== "idle" && actionState !== "error"}
          onClick={handleAccept}
          className="h-11 rounded-xl bg-emerald-600 font-extrabold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
        >
          <Check className="mr-1.5 h-5 w-5" />
          {actionState === "accepting" ? t("Accepting…") : t("ACCEPT")}
        </Button>

        <Button
          data-testid="decline-offer-btn"
          variant="outline"
          disabled={actionState !== "idle" && actionState !== "error"}
          onClick={handleDecline}
          className="h-11 rounded-xl border-red-300 bg-white font-extrabold text-red-600 hover:bg-red-50 hover:text-red-700 active:scale-[0.98] disabled:opacity-50"
        >
          <X className="mr-1.5 h-5 w-5" />
          {actionState === "declining" ? t("Declining…") : t("DECLINE")}
        </Button>
      </div>
    </article>
  );
}
