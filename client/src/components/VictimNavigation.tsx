import React from "react";
import { Siren, Navigation, ShieldCheck, MoreHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export interface VictimNavigationProps {
  current: "home" | "track" | "safety" | "more";
}

/**
 * VictimNavigation — Citizen Emergency Navigation Bar.
 *
 * Matching Reference 3:
 * - Mobile (<md): Anchored clean bottom bar with high-contrast icons, tactile feedback, safe-area inset.
 * - Desktop (>=md): Refined centered capsule dock with subtle elevation and clear active indicator.
 */
export function VictimNavigation({ current }: VictimNavigationProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const items = [
    { id: "home" as const, icon: Siren, label: t("SOS"), path: "/" },
    { id: "track" as const, icon: Navigation, label: t("Track"), path: "/track" },
    { id: "safety" as const, icon: ShieldCheck, label: t("Safety"), path: "/safety" },
    { id: "more" as const, icon: MoreHorizontal, label: t("More"), path: "/more" },
  ];

  return (
    <nav
      aria-label="Victim App navigation"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1.5rem)] rounded-full border border-slate-200/90 bg-white/95 p-1 sm:p-1.5 shadow-xl shadow-slate-950/10 backdrop-blur-md transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/95 flex items-center gap-1 sm:gap-1.5"
    >
      {items.map(({ id, icon: Icon, label, path }) => {
        const isActive = current === id;
        const isHome = id === "home";
        return (
          <button
            key={id}
            type="button"
            onClick={() => setLocation(path)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold transition-all duration-150 active:scale-95 whitespace-nowrap ${
              isActive
                ? isHome
                  ? "bg-rose-500 text-white shadow-xs"
                  : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default VictimNavigation;
