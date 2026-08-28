import { useLanguage } from "@/contexts/LanguageContext";
import { Bot, Sparkles } from "lucide-react";
import React from "react";

interface AiBotCardProps {
  onOpen: () => void;
}

export function AiBotCard({ onOpen }: AiBotCardProps) {
  const { t } = useLanguage();

  return (
    <section className="rounded-[1.55rem] bg-white p-3 shadow-[0_12px_28px_rgba(22,60,53,.09)] ring-1 ring-black/[.035] dark:bg-[#1a1a1c] dark:ring-white/10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("Open AI Bot")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#174e46] text-white transition active:scale-95 hover:bg-[#1f6359]"
        >
          <Bot className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base" role="img" aria-label="robot">🤖</span>
            <p className="text-sm font-extrabold truncate text-[#142c2b] dark:text-[#f4f4f5]">
              {t("AI Bot")}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-[#708881] dark:text-[#b9b9c0] truncate">
            {t("Get Help")}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1 rounded-xl bg-[#eaf4f1] px-3 py-2 text-[11px] font-extrabold text-[#174e46] transition hover:bg-[#d8ece7] active:scale-95 dark:bg-[#1f3632] dark:text-[#5eead4]"
        >
          <Sparkles className="h-3 w-3" />
          <span>{t("Ask")}</span>
        </button>
      </div>
    </section>
  );
}

export default AiBotCard;
