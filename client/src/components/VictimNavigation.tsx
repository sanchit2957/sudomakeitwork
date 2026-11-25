import React from "react";
import { Siren, Navigation, ShieldCheck, MoreHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export interface VictimNavigationProps {
  current: "home" | "track" | "safety" | "more";
  hide?: boolean;
}

/**
 * VictimNavigation — Citizen Emergency Navigation Bar.
 *
 * Responsive behavior:
 * - Mobile (<md): Anchored bottom bar with vertical touch layout and safe-area insets.
 * - Desktop / Large Screens (>=md): Compact Apple visionOS floating capsule island
 *   centered at the bottom with horizontal icon+label pills, preventing awkward stretching.
 */
export function VictimNavigation({ current, hide = false }: VictimNavigationProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [hasOpenDialog, setHasOpenDialog] = React.useState(false);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const checkDialog = () => {
      setHasOpenDialog(Boolean(document.querySelector('[role="dialog"], [aria-modal="true"]')));
    };
    checkDialog();
    const observer = new MutationObserver(checkDialog);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal", "role"] });
    return () => observer.disconnect();
  }, []);

  if (hide || hasOpenDialog) return null;

  const items = [
    { id: "home" as const, icon: Siren, label: t("SOS"), path: "/citizen" },
    { id: "track" as const, icon: Navigation, label: t("Track"), path: "/track" },
    { id: "safety" as const, icon: ShieldCheck, label: t("Safety"), path: "/safety" },
    { id: "more" as const, icon: MoreHorizontal, label: t("More"), path: "/more" },
  ];

  return (
    <nav
      aria-label="Victim App navigation"
      className="fixed bottom-3 inset-x-3 z-40 mx-auto max-w-lg rounded-[28px] border border-white/85 dark:border-white/18 px-3 py-2 shadow-2xl liquid-glass transition-all duration-200 md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-auto md:max-w-none md:flex md:items-center md:gap-1.5 md:p-1.5 md:rounded-full md:border md:border-white/70 dark:md:border-white/20 md:shadow-2xl md:shadow-[#0F172A]/20 dark:md:shadow-black/70"
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
              className={`group flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5 transition-all duration-150 active:scale-90 ${
                isActive
                  ? isHome
                    ? "text-[#DC2626]"
                    : "text-[#1D4ED8] dark:text-[#F1F5F9]"
                  : "text-[#0F172A]/65 dark:text-[#F1F5F9]/55 hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
              }`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-2xl transition-all duration-200 ${
                  isActive
                    ? isHome
                      ? "bg-gradient-to-b from-red-500/20 to-red-600/12 text-[#DC2626] border border-red-500/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_2px_8px_rgba(220,38,38,0.2)]"
                      : "bg-gradient-to-b from-[#1D4ED8]/20 to-[#1D4ED8]/10 text-[#1D4ED8] dark:text-[#F1F5F9] border border-[#1D4ED8]/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_2px_8px_rgba(36,87,255,0.2)]"
                    : "group-hover:bg-black/5 dark:group-hover:bg-white/5"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-150 ${isActive ? "scale-105" : "group-hover:scale-105"}`} />
              </span>
              <span className={`text-[11px] font-semibold tracking-tight transition-all ${isActive ? "font-bold scale-102" : "opacity-85"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop / Big Screen horizontal island (>=md) */}
      <div className="hidden md:flex md:items-center md:gap-1.5">
        {items.map(({ id, icon: Icon, label, path }) => {
          const isActive = current === id;
          const isHome = id === "home";
          return (
            <button
              key={id}
              type="button"
              onClick={() => setLocation(path)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-95 ${
                isActive
                  ? isHome
                    ? "bg-gradient-to-r from-red-500/20 to-red-600/12 text-red-600 dark:text-red-400 border border-red-500/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_2px_8px_rgba(220,38,38,0.18)]"
                    : "bg-gradient-to-r from-[#1D4ED8]/20 to-[#1D4ED8]/10 text-[#1D4ED8] dark:text-[#F1F5F9] border border-[#1D4ED8]/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_2px_8px_rgba(36,87,255,0.18)]"
                  : "text-[#0F172A]/70 dark:text-[#F1F5F9]/60 hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-lg transition-colors ${
                  isActive
                    ? isHome
                      ? "text-red-600 dark:text-red-400"
                      : "text-[#1D4ED8] dark:text-[#F1F5F9]"
                    : "opacity-75"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="tracking-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default VictimNavigation;
