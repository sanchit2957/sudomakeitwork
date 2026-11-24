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
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full border-t border-slate-200/90 bg-white/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-lg backdrop-blur-md transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/95 md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-auto md:flex md:items-center md:gap-1 md:p-1.5 md:rounded-full md:border md:shadow-xl md:shadow-slate-950/10"
    >
      {/* Mobile touch layout (<md) */}
      <div className="flex w-full items-center justify-around md:hidden">
        {items.map(({ id, icon: Icon, label, path }) => {
          const isActive = current === id;
          const isHome = id === "home";
          return (
            <button
              key={id}
              type="button"
              onClick={() => setLocation(path)}
              aria-current={isActive ? "page" : undefined}
              className={`grid min-w-16 place-items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                isActive
                  ? isHome
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-900 dark:text-white"
                  : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                  isActive
                    ? isHome
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                      : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop / Tablet centered capsule (>=md) */}
      <div className="hidden md:flex md:items-center md:gap-1">
        {items.map(({ id, icon: Icon, label, path }) => {
          const isActive = current === id;
          const isHome = id === "home";
          return (
            <button
              key={id}
              type="button"
              onClick={() => setLocation(path)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-150 active:scale-95 ${
                isActive
                  ? isHome
                    ? "bg-rose-500 text-white shadow-xs"
                    : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default VictimNavigation;
