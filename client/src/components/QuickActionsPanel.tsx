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
      className="glass-card mt-3.5 overflow-hidden border border-[#B7AD9E]/30 bg-white/70 shadow-sm backdrop-blur-md dark:border-[#D8E3FF]/15 dark:bg-[#111C44]/60"
    >
      <div className="grid grid-cols-2 items-stretch divide-x divide-[#B7AD9E]/25 dark:divide-[#D8E3FF]/15">
        <AiBotCard onOpen={onOpenAi} embedded />
        <VoiceNoteCard embedded />
      </div>
    </section>
  );
}

export default QuickActionsPanel;
