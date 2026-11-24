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
      className="glass-card mt-3.5 overflow-hidden border border-[#E2E8F0]/30 bg-white/70 shadow-sm backdrop-blur-md dark:border-[#F1F5F9]/15 dark:bg-[#0F172A]/60"
    >
      <div className="grid grid-cols-2 items-stretch divide-x divide-[#E2E8F0]/25 dark:divide-[#F1F5F9]/15">
        <AiBotCard onOpen={onOpenAi} embedded />
        <VoiceNoteCard embedded />
      </div>
    </section>
  );
}

export default QuickActionsPanel;
