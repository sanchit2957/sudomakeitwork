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
      className={`group flex w-full flex-col items-center justify-center p-4 text-center transition active:scale-[0.98] ${
        embedded
          ? "hover:bg-slate-50 dark:hover:bg-slate-800/60"
          : "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 transition group-hover:scale-105">
        <Bot className="h-5 w-5" />
      </div>

      <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
        {t("AI Bot")}
      </p>

      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {t("Get Help")}
      </p>
    </button>
  );
}

export default AiBotCard;
