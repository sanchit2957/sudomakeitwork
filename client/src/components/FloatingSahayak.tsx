import React, { useState } from "react";
import { Sparkles, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SahayakAiModal } from "./SahayakAiModal";

export function FloatingSahayak() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      {/* Floating Sahayak Trigger: subtle glassmorphic pill/circle positioned safely above bottom nav on mobile */}
      <aside
        aria-label="Sahayak AI Assistant"
        className="fixed bottom-[4.25rem] right-3 sm:bottom-6 sm:right-6 z-40 print:hidden"
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={t("Ask Sahayak")}
          className="group flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-2 text-slate-800 shadow-md backdrop-blur-md transition-all hover:bg-white hover:border-slate-300 hover:shadow-lg active:scale-95 dark:border-slate-700/80 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline text-xs font-bold tracking-tight">
            {t("Ask Sahayak")}
          </span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            AI
          </span>
        </button>
      </aside>

      {/* Existing authoritative Sahayak AI Modal */}
      <SahayakAiModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default FloatingSahayak;

