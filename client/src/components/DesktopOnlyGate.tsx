import React, { useEffect, useState } from "react";
import { Monitor, ArrowLeft, HeartPulse, Shield, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { isNativeApp } from "@/lib/apiConfig";

// Desktop threshold: 1024px (standard desktop/laptop viewport)
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * Hook to reactively determine if the current viewport is a desktop/laptop display
 * and not running inside a native mobile wrapper.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= DESKTOP_MIN_WIDTH && !isNativeApp();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const desktop = window.innerWidth >= DESKTOP_MIN_WIDTH && !isNativeApp();
      setIsDesktop(desktop);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return isDesktop;
}

interface DesktopOnlyGateProps {
  children?: React.ReactNode;
  portalName?: string;
  portalType?: "admin" | "hospital" | "default";
}

/**
 * DesktopOnlyGate enforces desktop-only access for Hospital and Admin roles.
 * If accessed on mobile phones or small screens (<1024px or native app),
 * it displays an institutional operational notice directing operators to widescreen displays.
 */
export function DesktopOnlyGate({
  children,
  portalName = "Restricted Operations Desk",
  portalType = "default",
}: DesktopOnlyGateProps) {
  const isDesktop = useIsDesktop();
  const [, setLocation] = useLocation();

  if (isDesktop && children) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-foreground">
      {/* Main Operational Notice Panel */}
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-muted/60 text-foreground">
              {portalType === "hospital" ? (
                <HeartPulse className="h-5 w-5" />
              ) : (
                <Shield className="h-5 w-5" />
              )}
            </span>
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                National Disaster Dispatch Platform
              </span>
              <h2 className="text-sm font-bold text-foreground">
                {portalName}
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Desktop Required
          </span>
        </div>

        {/* Central Graphic & Message */}
        <div className="my-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <Monitor className="h-7 w-7 text-muted-foreground" />
          </div>

          <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            Workstation Display Required (1024px+)
          </h1>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            The {portalName} contains dense multi-channel GIS tactical maps, live clinical telemetry tables, and command registers configured strictly for workstation screens.
          </p>
        </div>

        {/* Compatible Mobile Notice */}
        <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            Mobile-optimized operational access is active for the <strong>Citizen SOS Hub</strong> and <strong>Field Rescuer Mobile App</strong>.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Citizen SOS Hub
          </button>
          <button
            type="button"
            onClick={() => setLocation("/responder")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            Field Rescuer
          </button>
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition hover:bg-muted"
          >
            Role Selector
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesktopOnlyGate;
