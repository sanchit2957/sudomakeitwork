import React, { useEffect, useState } from "react";
import { Monitor, ShieldAlert, ArrowLeft, Shield, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { isNativeApp } from "@/lib/apiConfig";
import { getPortalLoginPath } from "@/lib/portalAuth";

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
 * DesktopOnlyGate enforces strict desktop/laptop screen restriction for the Admin Command Centre.
 * The Admin panel must work ONLY on desktop and laptop screens (>= 1024px).
 * It is completely restricted on mobile or tablet screens.
 * The remaining three roles (Citizen, Hospital, Rescuer) work on all screen sizes.
 */
export function DesktopOnlyGate({
  children,
  portalName = "State Disaster Command Centre",
  portalType = "admin",
}: DesktopOnlyGateProps) {
  const isDesktop = useIsDesktop();
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  // If this is not an admin portal, or if already on desktop/laptop, permit normal access
  if (portalType !== "admin" || isDesktop) {
    return <>{children}</>;
  }

  const handleGoToCitizen = () => {
    try {
      sessionStorage.setItem("sahay_allow_citizen_home", "true");
    } catch { }
    setLocation("/");
  };

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      handleGoToCitizen();
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    try {
      sessionStorage.removeItem("sahay_allow_citizen_home");
      sessionStorage.removeItem(`sahay_bypass_gate_${portalType}`);
    } catch { }
    setLocation(getPortalLoginPath("admin"));
  };

  // STRICT FULL-SCREEN LOCK FOR MOBILE / TABLET VIEWPORTS
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#0F172A] text-[#F8FAFC] overflow-hidden select-none">
      {/* Ambient background light orbs */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, #DC2626 0%, transparent 70%)" }}
      />

      {/* Main Glass Shield Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/15 bg-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl dark:bg-[#1E293B]/90">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-300/80">
                SAHAY Security &amp; Operations Policy
              </p>
              <h2 className="text-sm font-extrabold text-white">
                {portalName}
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
            <ShieldAlert className="h-3 w-3" />
            Desktop Only
          </span>
        </div>

        {/* Central Graphic & Restriction Notice */}
        <div className="my-6 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-500/40 bg-gradient-to-b from-blue-500/20 to-slate-900/80 shadow-lg shadow-blue-500/10">
            <Monitor className="h-10 w-10 text-blue-200" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black shadow-md text-xs">
              !
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
            Access Restricted: This portal is available only on desktop or laptop screens.
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
            The {portalName} requires a desktop or laptop display (minimum 1024px width) for real-time tactical dispatch tables, multi-channel GIS overlays, and command telemetry.
          </p>
        </div>

        {/* Compatible Mobile Alternatives Notice */}
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-200">
          <p className="font-semibold">
            📱 <strong>Multi-screen &amp; mobile access</strong> is fully enabled for <strong>Citizen SOS</strong>, <strong>Hospital Operations</strong>, and <strong>Field Rescuer</strong> portals.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleGoToCitizen}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-xs font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Citizen SOS Portal
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-xs font-bold text-slate-200 transition hover:bg-white/15 active:scale-[0.98] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-300" />
              Go Back
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-3 text-xs font-bold text-red-200 transition hover:bg-red-500/25 active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-red-300" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesktopOnlyGate;
