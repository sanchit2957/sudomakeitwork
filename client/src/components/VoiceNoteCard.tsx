import { useLanguage } from "@/contexts/LanguageContext";
import {
  checkCurrentMicPermission,
  isMicSupported,
  type MicPermissionState,
  requestMicPermission,
  subscribeMicPermission,
} from "@/lib/micPermission";
import {
  blobToDataUrl,
  clearSosVoiceNote,
  readSosVoiceNote,
  saveSosVoiceNote,
  type SosVoiceNoteDraft,
} from "@/lib/sosVoiceNote";
import { Mic, Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

interface VoiceNoteCardProps {
  embedded?: boolean;
}

export function VoiceNoteCard({ embedded = false }: VoiceNoteCardProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<SosVoiceNoteDraft | null>(() => readSosVoiceNote());
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [micState, setMicState] = useState<MicPermissionState>("prompt");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronize microphone permission status and subscribe to changes
  useEffect(() => {
    if (!isMicSupported()) {
      setMicState("unsupported");
      return;
    }
    void checkCurrentMicPermission().then(status => setMicState(status));
    const unsubscribe = subscribeMicPermission(status => setMicState(status));
    return () => unsubscribe();
  }, []);

  // Cleanup media recording tracks and playback on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Handle audio playback for draft preview
  useEffect(() => {
    if (!draft?.dataUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setPlayProgress(0);
      return;
    }

    const audio = new Audio(draft.dataUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setPlayProgress(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlayProgress(0);
    };

    const handleError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      setIsPlaying(false);
      setPlayProgress(0);
    };
  }, [draft?.dataUrl]);

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const startRecording = async () => {
    if (!isMicSupported()) {
      setMessage(t("Voice recording is not supported in this browser."));
      setMicState("unsupported");
      return;
    }

    setMessage("");

    // If audio is currently playing, stop it
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPlayProgress(0);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicState("granted");

      const chunks: BlobPart[] = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4", "audio/aac"].find(type =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
      );

      const nextRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      nextRecorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      nextRecorder.onstop = async () => {
        if (recordIntervalRef.current) {
          clearInterval(recordIntervalRef.current);
          recordIntervalRef.current = null;
        }

        const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
        const durationSeconds = Math.max(1, Math.min(120, elapsedSeconds));

        // Release all audio tracks immediately after recording stops
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (elapsedSeconds < 1) {
          setMessage(t("Recording was too short. Please speak to record a voice note."));
          setRecording(false);
          setRecordSeconds(0);
          return;
        }

        const audioBlob = new Blob(chunks, { type: nextRecorder.mimeType || "audio/webm" });
        if (audioBlob.size > 3_000_000) {
          setMessage(t("Voice note is too large. Please keep it short."));
          setRecording(false);
          setRecordSeconds(0);
          return;
        }

        const dataUrl = await blobToDataUrl(audioBlob);
        const savedDraft: SosVoiceNoteDraft = {
          dataUrl,
          durationSeconds,
          createdAt: Date.now(),
        };

        saveSosVoiceNote(savedDraft);
        setDraft(savedDraft);
        setRecording(false);
        setRecordSeconds(0);
        setMessage(t("Voice note saved for your SOS."));
      };

      recorderRef.current = nextRecorder;
      startedAtRef.current = Date.now();
      setRecordSeconds(0);
      nextRecorder.start();
      setRecording(true);

      // Live duration timer + 120-second (2 minute) auto-stop limit
      recordIntervalRef.current = setInterval(() => {
        const currentSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        setRecordSeconds(currentSeconds);

        if (currentSeconds >= 120) {
          stopRecording();
        }
      }, 500);
    } catch (err: any) {
      console.error("[VoiceNote] getUserMedia error:", err?.name, err?.message, err);
      setMicState("denied");
      const errDetail = err?.name ? ` (${err.name}: ${err.message || "Microphone access denied"})` : "";
      setMessage(
        t("Microphone access is off. Enable it in your device settings to use voice notes.") + errDetail
      );
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    recorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);
    setPlayProgress(0);
    clearSosVoiceNote();
    setDraft(null);
    setMessage("");
  };

  const handleManualPermissionRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessage("");
    const result = await requestMicPermission(true);
    setMicState(result);
    if (result === "granted") {
      startRecording();
    } else if (result === "denied") {
      setMessage(t("Microphone access is off. Enable it in your device settings to use voice notes."));
    }
  };

  // 1. Idle state with permission denied banner
  if (micState === "denied" && !recording && !draft) {
    return (
      <section
        className={`flex w-full flex-col items-center justify-center p-3.5 text-center ${
          embedded
            ? "rounded-r-[18px]"
            : "rounded-[20px] bg-white p-4 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10"
        }`}
      >
        <button
          type="button"
          onClick={handleManualPermissionRetry}
          aria-label={t("Try enabling microphone")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-600 text-white shadow-sm transition active:scale-95 hover:bg-amber-700"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <p className="mt-2 text-sm font-extrabold text-amber-800 dark:text-amber-300">
          {t("Microphone access is off")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
          {t("Enable in settings")}
        </p>
        <button
          type="button"
          onClick={handleManualPermissionRetry}
          className="mt-1.5 rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 transition"
        >
          {t("Try again")}
        </button>
      </section>
    );
  }

  // 2. Main Voice Note Card (Idle / Recording / Recorded Preview)
  return (
    <section
      className={`group relative flex w-full flex-col items-center justify-center p-3.5 text-center ${
        embedded
          ? "rounded-r-[18px]"
          : "rounded-[20px] bg-white p-4 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10"
      }`}
    >
      {/* Delete Action when recorded draft exists */}
      {draft && !recording && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label={t("Delete voice note")}
          className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-[#fff0ef] text-[#b44742] transition hover:bg-[#ffe0de] active:scale-95 dark:bg-[#2d1b1b] dark:text-[#f87171]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* Main Action Button */}
      {draft && !recording ? (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? t("Pause voice note") : t("Play voice note")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#174e46] text-white shadow-sm transition active:scale-95 hover:bg-[#1f6359]"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? t("Stop recording") : t("Record voice note")}
          disabled={micState === "unsupported"}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm transition active:scale-95 disabled:opacity-50 ${
            recording ? "bg-[#df3e43] animate-pulse" : "bg-[#174e46] hover:bg-[#1f6359]"
          }`}
        >
          {recording ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>
      )}

      {/* Card Title */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {recording && (
          <span className="inline-block h-2 w-2 rounded-full bg-[#df3e43] animate-ping" />
        )}
        <p className="text-sm font-extrabold text-[#142c2b] dark:text-[#f4f4f5]">
          {recording
            ? t("Stop and save voice note")
            : draft
            ? t("Voice note ready")
            : t("Record voice note")}
        </p>
      </div>

      {/* Card Subtitle */}
      <p className="mt-0.5 text-xs text-[#708881] dark:text-[#b9b9c0]">
        {recording
          ? `${formatSeconds(recordSeconds)} / 02:00 · ${t("Tap to stop")}`
          : draft
          ? isPlaying
            ? `${formatSeconds(playProgress)} / ${formatSeconds(draft.durationSeconds)} · ${t("Playing")}`
            : `${draft.durationSeconds}s · ${t("Attached to your next SOS")}`
          : micState === "unsupported"
          ? t("Voice recording is not supported in this browser.")
          : t("Speak briefly if typing is difficult")}
      </p>

      {message && (
        <p role="status" className="mt-1 text-[10px] font-semibold text-[#54746b] dark:text-[#b9b9c0]">
          {message}
        </p>
      )}
    </section>
  );
}

export default VoiceNoteCard;
