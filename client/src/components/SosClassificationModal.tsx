import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  HeartPulse,
  HelpCircle,
  LifeBuoy,
  Radio,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type SOSCategoryOption = "medical" | "rescue" | "emergency" | "other";

interface SosClassificationModalProps {
  isOpen: boolean;
  publicCode: string;
  incidentId?: number;
  triageDeadlineAt?: Date | string | null;
  onComplete: (category: "medical" | "rescue" | "emergency") => void;
  onCancel?: () => void;
}

const SPECIAL_NEED_TAGS = [
  "Boat needed",
  "Elderly person",
  "Child",
  "Urgent medicine",
  "Injured person",
  "Pregnant person",
  "Mobility assistance",
  "Trapped on roof",
  "Evacuation needed",
];

export const TRIAGE_CANCEL_WINDOW_MS = 10_000;

export function SosClassificationModal({
  isOpen,
  publicCode,
  incidentId,
  triageDeadlineAt,
  onComplete,
  onCancel,
}: SosClassificationModalProps) {
  const { t } = useLanguage();
  const selectCategory = trpc.rescue.emergency.selectCategory.useMutation();
  const updateDetails = trpc.rescue.emergency.updateMyDetails.useMutation();
  const cancelSos = trpc.rescue.emergency.cancel.useMutation();

  const [currentStep, setCurrentStep] = useState<"categories" | "details">("categories");
  const [selectedCategory, setSelectedCategory] = useState<SOSCategoryOption | null>(null);
  const [timeLeft, setTimeLeft] = useState(() => {
    if (triageDeadlineAt) {
      const remainingMs = Math.max(0, new Date(triageDeadlineAt).getTime() - Date.now());
      return Math.ceil(remainingMs / 1000);
    }
    return 10;
  });
  const [isExpired, setIsExpired] = useState(false);
  const [isDispatchedOnServer, setIsDispatchedOnServer] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Details state
  const [peopleAffected, setPeopleAffected] = useState(1);
  const [helpNeeds, setHelpNeeds] = useState("");
  const [notes, setNotes] = useState("");

  // Refs to prevent stale closure bugs in setInterval and async callbacks
  const currentStepRef = useRef<"categories" | "details">("categories");
  const selectedCategoryRef = useRef<SOSCategoryOption | null>(null);
  const submittedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Authoritative server deadline for the initial cancellation / triage window (10s)
  const deadlineMs = useMemo(() => {
    return triageDeadlineAt ? new Date(triageDeadlineAt).getTime() : Date.now() + TRIAGE_CANCEL_WINDOW_MS;
  }, [triageDeadlineAt]);

  // Master 10-second timer for initial triage/cancellation window
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, deadlineMs - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      setTimeLeft(remainingSec);

      if (remainingMs <= 0) {
        clearInterval(interval);
        if (!submittedRef.current && !cancelledRef.current) {
          setIsExpired(true);
          handleAutoTimeout();
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isOpen, deadlineMs]);

  // Map category safely to backend supported enum ('medical' | 'rescue' | 'emergency')
  const resolveBackendCategory = (cat: SOSCategoryOption | null): "medical" | "rescue" | "emergency" => {
    if (cat === "medical") return "medical";
    if (cat === "rescue") return "rescue";
    return "emergency"; // 'emergency' or 'other' or null maps safely to 'emergency'
  };

  // Auto-timeout execution when 10 seconds elapse with NO category selected
  const handleAutoTimeout = async () => {
    // If user cancelled, or already explicitly submitted, do nothing
    if (cancelledRef.current || submittedRef.current) return;

    // CRITICAL: If user is on the Details screen OR has already chosen a category,
    // the 10-second deadline must NEVER force navigation away! User can stay in Details as long as needed.
    if (currentStepRef.current === "details" || selectedCategoryRef.current !== null) {
      return;
    }

    submittedRef.current = true;
    const finalCat = resolveBackendCategory(selectedCategoryRef.current);
    setIsDispatchedOnServer(true);

    try {
      // Submit fallback emergency category selection to server immediately
      await selectCategory.mutateAsync({
        publicCode,
        incidentId,
        category: finalCat,
      });
    } catch (err) {
      console.warn("[Triage] Auto-timeout selectCategory notice:", err);
    }

    // Only if user remained on categories screen with no selection, advance to tracking
    if (currentStepRef.current === "categories" && !cancelledRef.current) {
      setTimeout(() => {
        if (currentStepRef.current === "categories" && !cancelledRef.current) {
          onComplete(finalCat);
        }
      }, 800);
    }
  };

  // Citizen cancels SOS (accidental activation) during the initial cancellation window
  const handleCancelSos = async () => {
    if (isCancelling || isExpired || cancelledRef.current) return;
    setIsCancelling(true);
    setCancelError("");

    try {
      await cancelSos.mutateAsync({
        publicCode,
        incidentId,
      });
      cancelledRef.current = true;
      onCancel?.();
    } catch (err: any) {
      setIsCancelling(false);
      setCancelError(err?.message || t("Could not cancel SOS. Emergency dispatch may have already begun."));
    }
  };

  // User selects a category: starts dispatch IMMEDIATELY on server without waiting for 10s!
  const handleCategorySelect = (category: SOSCategoryOption) => {
    setSelectedCategory(category);
    selectedCategoryRef.current = category;
    const backendCategory = resolveBackendCategory(category);
    setIsDispatchedOnServer(true);

    // Fire category selection mutation immediately to start matching now
    selectCategory
      .mutateAsync({
        publicCode,
        incidentId,
        category: backendCategory,
      })
      .catch(err => console.warn("[Triage] selectCategory mutation warning:", err));

    // Transition to non-blocking details screen (no timer displayed on details screen!)
    setCurrentStep("details");
    currentStepRef.current = "details";
  };

  // User completes details / clicks "Continue to tracking"
  const handleContinueToTracking = async () => {
    const finalCat = resolveBackendCategory(selectedCategoryRef.current || selectedCategory);
    submittedRef.current = true;

    // Ensure category is sent if not already dispatched
    if (!isDispatchedOnServer) {
      await selectCategory
        .mutateAsync({
          publicCode,
          incidentId,
          category: finalCat,
        })
        .catch(err => console.warn("[Triage] selectCategory on continue warning:", err));
    }

    // Save details in background (never blocks tracking navigation)
    if (peopleAffected > 1 || helpNeeds.trim() || notes.trim()) {
      const emergencyType = finalCat === "medical" ? "medical" : finalCat === "rescue" ? "trapped" : "flood";
      updateDetails
        .mutateAsync({
          publicCode,
          peopleAffected,
          emergencyType,
          helpNeeds: helpNeeds.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        .catch(err => console.warn("[Triage] updateMyDetails on continue warning:", err));
    }

    onComplete(finalCat);
  };

  // Toggle quick need pill
  const handleToggleTag = (tag: string) => {
    const currentTags = helpNeeds
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (currentTags.includes(tag)) {
      const updated = currentTags.filter(t => t !== tag).join(", ");
      setHelpNeeds(updated);
    } else {
      const updated = currentTags.length > 0 ? `${helpNeeds.trim()}, ${tag}` : tag;
      setHelpNeeds(updated);
    }
  };

  // Context-sensitive heading based on selected category
  const getContextualDetailsHeading = () => {
    switch (selectedCategory) {
      case "medical":
        return t("How many people need medical help?");
      case "rescue":
        return t("How many people need rescue?");
      case "other":
        return t("How many people are involved?");
      case "emergency":
      default:
        return t("How many people are affected?");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="triage-modal-heading"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/70 p-3 sm:p-4 backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div className="relative flex w-full max-w-lg max-h-[92vh] flex-col overflow-hidden rounded-[2.5rem] border border-white/80 dark:border-white/15 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-2xl text-[#0F172A] shadow-[0_24px_70px_rgba(17,28,68,0.35)] ring-1 ring-black/[0.04] dark:text-[#F8FAFC] dark:shadow-black/80">
        
        {/* Top Header Bar */}
        <div className="border-b border-[#E2E8F0]/25 bg-white/60 px-5 sm:px-6 py-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-600 ring-1 ring-red-500/30 dark:bg-red-500/25 dark:text-red-400">
              <ShieldAlert className="h-4 w-4 animate-pulse text-red-600 dark:text-red-400" />
              <span>{currentStep === "categories" ? t("SOS ACTIVATED") : t("SOS IS ACTIVE")}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#F1F5F9]/70 px-2.5 py-1 font-mono text-xs font-black text-[#1D4ED8] dark:bg-[#1D4ED8]/25 dark:text-[#F1F5F9]">
                {publicCode}
              </span>
            </div>
          </div>

          {/* Countdown timer is ONLY visible on Step 1 (Cancellation / Initial Triage Window), NEVER on Details screen */}
          {currentStep === "categories" && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]/75 dark:text-[#F1F5F9]/75">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                  <span>{t("Automatic emergency dispatch if not cancelled")}</span>
                </span>
                <span className="font-mono text-sm font-black text-red-600 dark:text-red-400">
                  {`00:${String(Math.max(0, timeLeft)).padStart(2, "0")}`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E2E8F0]/25 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-[#1D4ED8] transition-all duration-200 ease-linear"
                  style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 15) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Main Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentStep === "categories" ? (
            /* ================= STEP 1: CATEGORY / CANCEL SCREEN ================= */
            <div className="space-y-4">
              <div className="text-center">
                <h2
                  id="triage-modal-heading"
                  className="text-xl font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC] sm:text-2xl"
                >
                  {t("Tell us what's happening")}
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                  {t("Tell us what kind of help you need. You can add details after choosing a category.")}
                </p>
              </div>

              {/* 4 Category Selection Cards */}
              <div className="mt-4 grid gap-3">
                {/* 1. Medical Help */}
                <button
                  type="button"
                  data-testid="triage-option-medical"
                  onClick={() => handleCategorySelect("medical")}
                  className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    selectedCategory === "medical"
                      ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/40 dark:border-red-500 dark:bg-red-500/20"
                      : "border-[#E2E8F0]/40 bg-white/90 hover:border-red-500/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1E293B]/70 dark:hover:border-red-400/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-600 transition-transform group-hover:scale-105 dark:bg-red-500/25 dark:text-red-400">
                    <HeartPulse className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#0F172A] dark:text-[#F8FAFC]">
                        {t("Medical Help")}
                      </span>
                      {selectedCategory === "medical" && (
                        <CheckCircle2 className="h-5 w-5 text-red-600 animate-in zoom-in-50 dark:text-red-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[#334155] dark:text-[#CBD5E1]">
                      {t("Injured, sick, ambulance, or urgent doctor required")}
                    </p>
                  </div>
                </button>

                {/* 2. Rescue / Trapped */}
                <button
                  type="button"
                  data-testid="triage-option-rescue"
                  onClick={() => handleCategorySelect("rescue")}
                  className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    selectedCategory === "rescue"
                      ? "border-[#1D4ED8] bg-[#1D4ED8]/10 ring-2 ring-[#1D4ED8]/40 dark:border-[#1D4ED8] dark:bg-[#1D4ED8]/20"
                      : "border-[#E2E8F0]/40 bg-white/90 hover:border-[#1D4ED8]/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1E293B]/70 dark:hover:border-[#1D4ED8]/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1D4ED8]/15 text-[#1D4ED8] transition-transform group-hover:scale-105 dark:bg-[#1D4ED8]/25 dark:text-[#F1F5F9]">
                    <LifeBuoy className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#0F172A] dark:text-[#F8FAFC]">
                        {t("Rescue / Trapped")}
                      </span>
                      {selectedCategory === "rescue" && (
                        <CheckCircle2 className="h-5 w-5 text-[#1D4ED8] animate-in zoom-in-50 dark:text-[#F1F5F9]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[#334155] dark:text-[#CBD5E1]">
                      {t("Trapped by floodwaters, roof rescue, boat or evacuation needed")}
                    </p>
                  </div>
                </button>

                {/* 3. Emergency / Immediate Danger */}
                <button
                  type="button"
                  data-testid="triage-option-emergency"
                  onClick={() => handleCategorySelect("emergency")}
                  className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    selectedCategory === "emergency"
                      ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 dark:border-amber-400 dark:bg-amber-950/40"
                      : "border-[#E2E8F0]/40 bg-white/90 hover:border-amber-500/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1E293B]/70 dark:hover:border-amber-500/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 transition-transform group-hover:scale-105 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#0F172A] dark:text-[#F8FAFC]">
                        {t("Emergency / Immediate Danger")}
                      </span>
                      {selectedCategory === "emergency" && (
                        <CheckCircle2 className="h-5 w-5 text-amber-600 animate-in zoom-in-50 dark:text-amber-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[#334155] dark:text-[#CBD5E1]">
                      {t("Immediate life threat, high danger, all-hazard assistance")}
                    </p>
                  </div>
                </button>

                {/* 4. Other / Not Listed */}
                <button
                  type="button"
                  data-testid="triage-option-other"
                  onClick={() => handleCategorySelect("other")}
                  className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    selectedCategory === "other"
                      ? "border-[#1D4ED8] bg-[#1D4ED8]/10 ring-2 ring-[#1D4ED8]/40 dark:border-[#F1F5F9] dark:bg-white/10"
                      : "border-[#E2E8F0]/40 bg-white/90 hover:border-[#1D4ED8]/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1E293B]/70 dark:hover:border-white/20"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F1F5F9]/50 text-[#1D4ED8] transition-transform group-hover:scale-105 dark:bg-white/10 dark:text-[#F1F5F9]">
                    <HelpCircle className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#0F172A] dark:text-[#F8FAFC]">
                        {t("Other / Not Listed")}
                      </span>
                      {selectedCategory === "other" && (
                        <CheckCircle2 className="h-5 w-5 text-[#1D4ED8] animate-in zoom-in-50 dark:text-[#F1F5F9]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[#334155] dark:text-[#CBD5E1]">
                      {t("Your situation doesn't match the options above")}
                    </p>
                  </div>
                </button>
              </div>

              {/* Cancel Error Feedback if any */}
              {cancelError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{cancelError}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ================= STEP 2: NON-BLOCKING DETAILS SCREEN (NO TIMER!) ================= */
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Emergency Status Banner */}
              <div className="rounded-2xl border border-[#1D4ED8]/30 bg-[#1D4ED8]/10 p-4 text-xs dark:bg-[#1D4ED8]/20">
                <div className="flex items-center gap-2 font-black text-[#1D4ED8] dark:text-[#F1F5F9]">
                  <Radio className="h-4 w-4 animate-pulse text-[#1D4ED8] dark:text-[#F1F5F9]" />
                  <span>{t("Your SOS is active")}</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#0F172A]/75 dark:text-[#F1F5F9]/80">
                  {t("We're finding the right responder now. Add details to help responders prepare. This is optional.")}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  data-testid="back-to-categories-btn"
                  onClick={() => {
                    setCurrentStep("categories");
                    currentStepRef.current = "categories";
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] hover:underline dark:text-[#F1F5F9]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t("Back to categories")}</span>
                </button>
                <h2
                  id="triage-modal-heading"
                  className="mt-2 text-xl font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC] sm:text-2xl"
                >
                  {getContextualDetailsHeading()}
                </h2>
              </div>

              {/* A. People Needing Help Counter */}
              <div className="rounded-2xl border border-[#E2E8F0]/40 bg-white/90 p-4 dark:border-white/10 dark:bg-[#1E293B]/70 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1E293B] dark:text-[#E2E8F0]">
                  {t("People needing help")}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPeopleAffected(v => Math.max(1, v - 1))}
                    className="h-9 w-9 rounded-xl text-base font-black p-0 border-[#E2E8F0] dark:border-white/10"
                  >
                    −
                  </Button>
                  <output className="grid h-9 min-w-12 place-items-center rounded-xl bg-white text-lg font-black text-[#1D4ED8] shadow-sm ring-1 ring-black/[0.04] dark:bg-[#0F172A] dark:text-[#F1F5F9]">
                    {peopleAffected}
                  </output>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPeopleAffected(v => Math.min(500, v + 1))}
                    className="h-9 w-9 rounded-xl text-base font-black p-0 border-[#E2E8F0] dark:border-white/10"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* B. Special Help Needed Quick Selection Tags */}
              <div className="rounded-2xl border border-[#E2E8F0]/40 bg-white/90 p-4 dark:border-white/10 dark:bg-[#1E293B]/70 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1E293B] dark:text-[#E2E8F0]">
                  {t("Special help needed")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SPECIAL_NEED_TAGS.map(tag => {
                    const isSelected = helpNeeds.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                          isSelected
                            ? "bg-[#1D4ED8] text-white shadow-xs"
                            : "bg-white text-[#0F172A] ring-1 ring-[#E2E8F0] hover:bg-[#F1F5F9]/60 dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:ring-white/15"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <Textarea
                  value={helpNeeds}
                  onChange={e => setHelpNeeds(e.target.value)}
                  maxLength={1000}
                  placeholder={t("E.g., boat needed, elderly person, urgent medicine, child")}
                  className="mt-2.5 min-h-[55px] bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:border-white/15 text-xs rounded-xl"
                />
              </div>

              {/* C. Additional Notes */}
              <div className="rounded-2xl border border-[#E2E8F0]/40 bg-white/90 p-4 dark:border-white/10 dark:bg-[#1E293B]/70 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1E293B] dark:text-[#E2E8F0]">
                  {t("Additional notes for responders")}
                </p>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={2000}
                  placeholder={t("Optional landmarks, floor level, or extra directions")}
                  className="mt-2 min-h-[60px] bg-white text-[#0F172A] border-[#E2E8F0] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:border-white/15 text-xs rounded-xl"
                />
              </div>

              {/* Step 2 Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="back-btn"
                  onClick={() => {
                    setCurrentStep("categories");
                    currentStepRef.current = "categories";
                  }}
                  className="h-11 rounded-xl text-xs font-extrabold"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  {t("Categories")}
                </Button>

                <Button
                  type="button"
                  data-testid="continue-to-tracking-btn"
                  onClick={handleContinueToTracking}
                  className="h-11 rounded-xl bg-[#1D4ED8] text-xs font-black text-white shadow-md shadow-[#1D4ED8]/25 hover:bg-[#1d47db]"
                >
                  <span>{t("Continue to Tracking")}</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Sticky Bottom Cancel Bar (The ONLY Cancel Button - 1 single prominent button) */}
        {currentStep === "categories" && !isExpired && (
          <div className="border-t border-[#E2E8F0]/30 bg-white/95 px-6 py-4 dark:border-white/10 dark:bg-[#0F172A]/95 backdrop-blur-md">
            <Button
              type="button"
              variant="outline"
              data-testid="cancel-sos-btn"
              disabled={isCancelling}
              onClick={handleCancelSos}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-red-400 bg-red-50/90 py-3.5 text-xs font-black text-red-700 shadow-sm transition hover:bg-red-100 hover:text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60 cursor-pointer"
            >
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span>{isCancelling ? t("Cancelling SOS…") : t("Cancel SOS (Accidental / False Alarm)")}</span>
            </Button>
          </div>
        )}

        {/* Bottom Feedback Banner */}
        {currentStep === "categories" && isExpired && !selectedCategory && (
          <div
            role="status"
            className="border-t border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-700 animate-in fade-in dark:text-amber-300"
          >
            <Clock className="mr-1.5 inline h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t("Time expired — Emergency response has been activated automatically.")}
          </div>
        )}
      </div>
    </div>
  );
}
