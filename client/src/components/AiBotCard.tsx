import { useLanguage } from "@/contexts/LanguageContext";
import { Bot } from "lucide-react";
import React from "react";

interface AiBotCardProps {
  onOpen?: () => void;
  onOpenModal?: () => void;
  embedded?: boolean;
}

export function AiBotCard({ onOpen, onOpenModal, embedded = false }: AiBotCardProps) {
  const { t } = useLanguage();
  const handleAction = onOpen || onOpenModal;

  return (
    <button
      type="button"
      onClick={handleAction}
      aria-label={t("Open AI Bot")}
      className={`group flex w-full flex-col items-center justify-center p-3.5 text-center transition active:scale-[0.98] ${
        embedded
          ? "rounded-l-[18px] hover:bg-[#2457FF]/[0.05] dark:hover:bg-white/[0.05]"
          : "glass-card p-4 hover:shadow-md"
      }`}
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2457FF] text-white shadow-md shadow-[#2457FF]/20 transition group-hover:scale-105 group-hover:bg-[#1d47db]">
        <Bot className="h-5 w-5" />
      </div>

      <p className="mt-2 text-sm font-extrabold text-[#111C44] dark:text-[#F8F1E4]">
        {t("AI Bot")}
      </p>

      <p className="mt-0.5 text-xs text-[#111C44]/70 dark:text-[#D8E3FF]/70">
        {t("Get Help")}
      </p>
    </button>
  );
}

export default AiBotCard;
