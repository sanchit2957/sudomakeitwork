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
 * Responsive behavior:
 * - Mobile (<md): Anchored bottom bar with vertical touch layout and safe-area insets.
 * - Desktop / Large Screens (>=md): Compact Apple visionOS floating capsule island
 *   centered at the bottom with horizontal icon+label pills, preventing awkward stretching.
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
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full glass-panel border-t border-[#B7AD9E]/30 dark:border-[#D8E3FF]/15 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-lg liquid-glass transition-all duration-200 md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-auto md:max-w-none md:flex md:items-center md:gap-1.5 md:p-1.5 md:rounded-full md:border md:border-white/60 dark:md:border-white/15 md:shadow-2xl md:shadow-[#111C44]/20 dark:md:shadow-black/60"
    >
      {/* Mobile flex container (<md) */}
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
              className={`grid min-w-16 place-items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-extrabold transition-all active:scale-95 ${
                isActive
                  ? isHome
                    ? "text-[#DC2626]"
                    : "text-[#2457FF] dark:text-[#D8E3FF]"
                  : "text-[#111C44]/60 dark:text-[#D8E3FF]/50 hover:text-[#111C44] dark:hover:text-[#F8F1E4]"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                  isActive
                    ? isHome
                      ? "bg-red-500/15 text-[#DC2626]"
                      : "bg-[#2457FF]/15 text-[#2457FF] dark:bg-[#2457FF]/30 dark:text-[#D8E3FF]"
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

      {/* Desktop / Big Screen horizontal island (>=md) */}
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
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold transition-all duration-150 active:scale-95 ${
                isActive
                  ? isHome
                    ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 shadow-xs"
                    : "bg-[#2457FF]/15 text-[#2457FF] dark:bg-[#2457FF]/30 dark:text-[#D8E3FF] border border-[#2457FF]/25 shadow-xs"
                  : "text-[#111C44]/65 dark:text-[#D8E3FF]/60 hover:text-[#111C44] dark:hover:text-[#F8F1E4] hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-lg transition-colors ${
                  isActive
                    ? isHome
                      ? "text-red-600 dark:text-red-400"
                      : "text-[#2457FF] dark:text-[#D8E3FF]"
                    : "opacity-75"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default VictimNavigation;
