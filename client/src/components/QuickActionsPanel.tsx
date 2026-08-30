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
      className="mt-3.5 overflow-hidden rounded-[20px] border border-white/40 bg-white/20 shadow-[0_8px_32px_rgba(20,44,43,0.06)] backdrop-blur-lg ring-1 ring-black/[0.03] dark:border-white/10 dark:bg-white/[0.08] dark:shadow-black/20"
    >
      <div className="grid grid-cols-2 items-stretch divide-x divide-black/[0.06] dark:divide-white/10">
        <AiBotCard onOpen={onOpenAi} embedded />
        <VoiceNoteCard embedded />
      </div>
    </section>
  );
}

export default QuickActionsPanel;
