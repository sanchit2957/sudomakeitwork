import { useLanguage } from "@/contexts/LanguageContext";
import { AiBotCard } from "./AiBotCard";
import { VoiceNoteCard } from "./VoiceNoteCard";
import React from "react";

interface QuickActionsPanelProps {
  onOpenAi: () => void;
}

export function QuickActionsPanel({ onOpenAi }: QuickActionsPanelProps) {
  return (
    <section
      aria-label="Quick Actions"
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-2 items-stretch divide-x divide-slate-200/80 dark:divide-slate-800">
        <AiBotCard onOpen={onOpenAi} embedded />
        <VoiceNoteCard embedded />
      </div>
    </section>
  );
}

export default QuickActionsPanel;
