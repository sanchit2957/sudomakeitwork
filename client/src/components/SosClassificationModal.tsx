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
  const [timeLeft, setTimeLeft] = useState(10);
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

  // Fixed authoritative server deadline for the initial cancellation / triage window
  const deadlineMs = useMemo(() => {
    return triageDeadlineAt ? new Date(triageDeadlineAt).getTime() : Date.now() + 10_000;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex w-full max-w-md max-h-[92vh] flex-col overflow-hidden rounded-[2.2rem] border border-[#b8ded4] bg-white text-[#122824] shadow-[0_24px_60px_rgba(23,78,70,0.22)] ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-[#15171a] dark:text-[#f3f4f6]">
        
        {/* Top Header Bar */}
        <div className="border-b border-[#e5f1ec] bg-[#f8fbf9] px-6 py-4 dark:border-white/10 dark:bg-[#191b1f]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-[#fff0ee] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#d23f43] ring-1 ring-[#f3c4c1] dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-500/40">
              <ShieldAlert className="h-4 w-4 animate-pulse text-[#d23f43] dark:text-rose-400" />
              <span>{currentStep === "categories" ? t("SOS ACTIVATED") : t("SOS IS ACTIVE")}</span>
            </div>
            <span className="rounded-lg bg-[#e7f6ef] px-2.5 py-1 font-mono text-xs font-extrabold text-[#174e46] dark:bg-emerald-950/50 dark:text-emerald-400">
              {publicCode}
            </span>
          </div>

          {/* Countdown timer is ONLY visible on Step 1 (Cancellation / Initial Triage Window), NEVER on Details screen */}
          {currentStep === "categories" && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#58746c] dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#174e46] dark:text-emerald-400" />
                  <span>{t("Automatic emergency dispatch if not cancelled")}</span>
                </span>
                <span className="font-mono text-sm font-black text-[#d23f43] dark:text-rose-400">
                  {`00:${String(Math.max(0, timeLeft)).padStart(2, "0")}`}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e3efe9] dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#d23f43] via-amber-500 to-[#174e46] transition-all duration-200 ease-linear dark:from-rose-500 dark:via-amber-500 dark:to-emerald-500"
                  style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 10) * 100))}%` }}
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
                  className="text-xl font-black tracking-tight text-[#173d37] dark:text-white sm:text-2xl"
                >
                  {t("Tell us what's happening")}
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#58746c] dark:text-zinc-400">
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
                      ? "border-[#d23f43] bg-[#fff5f4] ring-2 ring-[#d23f43]/40 dark:border-rose-500 dark:bg-rose-950/40"
                      : "border-[#d6ebe3] bg-[#fbfdfc] hover:border-[#174e46]/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1a1c20] dark:hover:border-emerald-500/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#fff0ee] text-[#d23f43] transition-transform group-hover:scale-105 dark:bg-rose-900/30 dark:text-rose-400">
                    <HeartPulse className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-[#173d37] dark:text-white">
                        {t("Medical Help")}
                      </span>
                      {selectedCategory === "medical" && (
                        <CheckCircle2 className="h-5 w-5 text-[#d23f43] animate-in zoom-in-50 dark:text-rose-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#5f776f] dark:text-zinc-400">
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
                      ? "border-[#174e46] bg-[#eef7f4] ring-2 ring-[#174e46]/40 dark:border-emerald-400 dark:bg-emerald-950/40"
                      : "border-[#d6ebe3] bg-[#fbfdfc] hover:border-[#174e46]/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1a1c20] dark:hover:border-emerald-500/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e6f6f0] text-[#174e46] transition-transform group-hover:scale-105 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <LifeBuoy className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-[#173d37] dark:text-white">
                        {t("Rescue / Trapped")}
                      </span>
                      {selectedCategory === "rescue" && (
                        <CheckCircle2 className="h-5 w-5 text-[#174e46] animate-in zoom-in-50 dark:text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#5f776f] dark:text-zinc-400">
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
                      ? "border-amber-500 bg-[#fff9eb] ring-2 ring-amber-500/40 dark:border-amber-400 dark:bg-amber-950/40"
                      : "border-[#d6ebe3] bg-[#fbfdfc] hover:border-amber-500/40 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1a1c20] dark:hover:border-amber-500/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#fef3c7] text-amber-600 transition-transform group-hover:scale-105 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-[#173d37] dark:text-white">
                        {t("Emergency / Immediate Danger")}
                      </span>
                      {selectedCategory === "emergency" && (
                        <CheckCircle2 className="h-5 w-5 text-amber-600 animate-in zoom-in-50 dark:text-amber-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#5f776f] dark:text-zinc-400">
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
                      ? "border-slate-500 bg-slate-50 ring-2 ring-slate-500/40 dark:border-zinc-400 dark:bg-zinc-800/50"
                      : "border-[#d6ebe3] bg-[#fbfdfc] hover:border-slate-400 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-[#1a1c20] dark:hover:border-zinc-500/40"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-transform group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-300">
                    <HelpCircle className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-[#173d37] dark:text-white">
                        {t("Other / Not Listed")}
                      </span>
                      {selectedCategory === "other" && (
                        <CheckCircle2 className="h-5 w-5 text-slate-600 animate-in zoom-in-50 dark:text-zinc-300" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#5f776f] dark:text-zinc-400">
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

              {/* Clear CANCEL SOS Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="cancel-sos-btn"
                  disabled={isCancelling}
                  onClick={handleCancelSos}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-rose-200 bg-rose-50/70 py-3 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
                >
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span>{isCancelling ? t("Cancelling SOS…") : t("CANCEL SOS (Accidental)")}</span>
                </Button>
              </div>
            </div>
          ) : (
            /* ================= STEP 2: NON-BLOCKING DETAILS SCREEN (NO TIMER!) ================= */
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Emergency Status Banner (Clear indication that SOS is active, NO timer countdown) */}
              <div className="rounded-2xl border border-emerald-500/30 bg-[#eef7f4] p-4 text-xs dark:bg-emerald-950/40">
                <div className="flex items-center gap-2 font-black text-[#174e46] dark:text-emerald-300">
                  <Radio className="h-4 w-4 animate-pulse text-emerald-600 dark:text-emerald-400" />
                  <span>{t("Your SOS is active")}</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#437267] dark:text-zinc-400">
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
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#174e46] hover:underline dark:text-emerald-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t("Back to categories")}</span>
                </button>
                <h2
                  id="triage-modal-heading"
                  className="mt-2 text-xl font-black tracking-tight text-[#173d37] dark:text-white sm:text-2xl"
                >
                  {getContextualDetailsHeading()}
                </h2>
              </div>

              {/* A. People Needing Help Counter */}
              <div className="rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] p-4 dark:border-white/10 dark:bg-[#16181b]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#58746c] dark:text-zinc-400">
                  {t("People needing help")}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPeopleAffected(v => Math.max(1, v - 1))}
                    className="h-9 w-9 rounded-xl text-base font-black p-0"
                  >
                    −
                  </Button>
                  <output className="grid h-9 min-w-12 place-items-center rounded-xl bg-white text-lg font-black text-[#174e46] shadow-sm ring-1 ring-black/[0.04] dark:bg-[#202328] dark:text-emerald-400">
                    {peopleAffected}
                  </output>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPeopleAffected(v => Math.min(500, v + 1))}
                    className="h-9 w-9 rounded-xl text-base font-black p-0"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* B. Special Help Needed Quick Selection Tags */}
              <div className="rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] p-4 dark:border-white/10 dark:bg-[#16181b]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#58746c] dark:text-zinc-400">
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
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                          isSelected
                            ? "bg-[#174e46] text-white dark:bg-emerald-600"
                            : "bg-white text-[#2a5b51] ring-1 ring-[#c5e4db] hover:bg-[#eef7f4] dark:bg-[#202328] dark:text-zinc-300 dark:ring-white/10"
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
                  className="mt-2.5 min-h-[55px] bg-white text-xs dark:bg-[#202328]"
                />
              </div>

              {/* C. Additional Notes */}
              <div className="rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] p-4 dark:border-white/10 dark:bg-[#16181b]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#58746c] dark:text-zinc-400">
                  {t("Additional notes for responders")}
                </p>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={2000}
                  placeholder={t("Optional landmarks, floor level, or extra directions")}
                  className="mt-2 min-h-[60px] bg-white text-xs dark:bg-[#202328]"
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
                  className="h-11 rounded-xl bg-[#174e46] text-xs font-extrabold text-white shadow-md hover:bg-[#123e37] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <span>{t("Continue to Tracking")}</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Feedback Banner (Only on Step 1 when auto-timed out) */}
        {currentStep === "categories" && isExpired && !selectedCategory && (
          <div
            role="status"
            className="border-t border-[#f4d58d] bg-[#fff9eb] p-3 text-center text-xs font-bold text-[#8a5b12] animate-in fade-in dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-300"
          >
            <Clock className="mr-1.5 inline h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t("Time expired — Emergency response has been activated automatically.")}
          </div>
        )}
      </div>
    </div>
  );
}
