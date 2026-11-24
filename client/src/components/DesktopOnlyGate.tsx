import React, { useEffect, useState } from "react";
import { Monitor, ShieldAlert, ArrowLeft, HeartPulse, Shield, Radio, Sparkles, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
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
 * it completely blocks access to the portal and displays the mandatory restriction notice.
 */
export function DesktopOnlyGate({
  children,
  portalName = "Restricted Operations Desk",
  portalType = "default",
}: DesktopOnlyGateProps) {
  const isDesktop = useIsDesktop();
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

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
    } catch { }
    setLocation("/login");
  };

  if (isDesktop && children) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#111C44] text-[#F8F1E4] overflow-hidden liquid-ambient-bg select-none">
      {/* Ambient background light orbs */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full blur-3xl opacity-35"
        style={{ background: "radial-gradient(circle, #2457FF 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, #D8E3FF 0%, transparent 70%)" }}
      />

      {/* Main Glass Shield Panel */}
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-white/20 bg-[#111C44]/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl glass-panel-dark">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2457FF]/20 border border-[#2457FF]/40 text-[#D8E3FF]">
              {portalType === "hospital" ? (
                <HeartPulse className="h-5 w-5 text-[#2457FF]" />
              ) : (
                <Shield className="h-5 w-5 text-[#2457FF]" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D8E3FF]/80">
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

        {/* Central Graphic */}
        <div className="my-6 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#2457FF]/40 bg-gradient-to-b from-[#2457FF]/20 to-[#111C44]/80 shadow-lg shadow-[#2457FF]/10">
            <Monitor className="h-10 w-10 text-[#D8E3FF]" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[#111C44] font-bold shadow-md">
              !
            </span>
          </div>

          {/* Mandatory User Requirement Notice */}
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
            Access Restricted: This portal is available only on desktop or larger-screen devices. Please use a desktop computer or laptop to continue.
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-[#D8E3FF]/80 leading-relaxed max-w-md">
            The {portalName} requires a high-resolution display (minimum 1024px width) for multi-channel GIS tactical overlays, real-time telemetry tables, and mission-critical controls.
          </p>
        </div>

        {/* Feature Grid Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-[#2457FF]/25 text-[#D8E3FF]">
              <Radio className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-bold text-white">Multi-Pane GIS Radar</p>
              <p className="text-[11px] text-[#D8E3FF]/70">Dense district feeds require expanded screen geometry.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-[#2457FF]/25 text-[#D8E3FF]">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-bold text-white">Station Security</p>
              <p className="text-[11px] text-[#D8E3FF]/70">Admin &amp; Hospital consoles are secured for verified workstations.</p>
            </div>
          </div>
        </div>

        {/* Compatible Mobile Alternatives */}
        <div className="mt-4 rounded-xl border border-[#2457FF]/25 bg-[#2457FF]/10 p-3 text-xs text-[#D8E3FF]">
          <p className="font-semibold">
            📱 <strong>Multi-screen &amp; mobile access</strong> is fully enabled for <strong>Citizen SOS</strong> and <strong>Field Rescuer</strong> interfaces.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleGoToCitizen}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2457FF] px-4 py-3.5 text-xs font-black text-white shadow-lg shadow-[#2457FF]/25 transition hover:bg-[#1d47db] active:scale-[0.98] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Citizen SOS Hub
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-xs font-bold text-[#F8F1E4] transition hover:bg-white/15 active:scale-[0.98] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-[#D8E3FF]" />
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
