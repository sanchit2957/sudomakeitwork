import { useLanguage } from "@/contexts/LanguageContext";
import { Bot } from "lucide-react";
import React from "react";

interface AiBotCardProps {
  onOpen: () => void;
  embedded?: boolean;
}

export function AiBotCard({ onOpen, embedded = false }: AiBotCardProps) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("Open AI Bot")}
      className={`group flex w-full flex-col items-center justify-center p-3.5 text-center transition active:scale-[0.98] ${
        embedded
          ? "rounded-l-[18px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          : "rounded-[20px] bg-white p-4 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] hover:shadow-md dark:bg-[#1a1a1c] dark:ring-white/10"
      }`}
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#174e46] text-white shadow-sm transition group-hover:bg-[#1f6359]">
        <Bot className="h-5 w-5" />
      </div>

      <p className="mt-2 text-sm font-extrabold text-[#142c2b] dark:text-[#f4f4f5]">
        {t("AI Bot")}
      </p>

      <p className="mt-0.5 text-xs text-[#708881] dark:text-[#b9b9c0]">
        {t("Get Help")}
      </p>
    </button>
  );
}

export default AiBotCard;
