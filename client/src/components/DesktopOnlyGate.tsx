import React, { useEffect, useState } from "react";
import { Monitor, ShieldAlert, ArrowLeft, HeartPulse, Shield, Radio, Sparkles } from "lucide-react";
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
 * it completely blocks access to the portal and displays the mandatory restriction notice.
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
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Tactical ambient glow */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-20 bg-teal-500/30"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl opacity-15 bg-slate-700/40"
      />

      {/* Main Command Shield Panel */}
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-400">
              {portalType === "hospital" ? (
                <HeartPulse className="h-5 w-5 text-teal-400" />
              ) : (
                <Shield className="h-5 w-5 text-teal-400" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                SAHAY Security &amp; Operations Policy
              </p>
              <h2 className="text-sm font-bold text-white">
                {portalName}
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-mono font-bold text-amber-300">
            <ShieldAlert className="h-3 w-3" />
            Desktop Only
          </span>
        </div>

        {/* Central Graphic */}
        <div className="my-6 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 shadow-inner">
            <Monitor className="h-8 w-8 text-slate-300" />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-md">
              !
            </span>
          </div>

          {/* Mandatory User Requirement Notice */}
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
            Access Restricted: This portal is available only on desktop or larger-screen devices. Please use a desktop computer or laptop to continue.
          </h1>

          <p className="mt-2.5 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md">
            The {portalName} requires a high-resolution display (minimum 1024px width) for multi-channel GIS tactical overlays, real-time telemetry tables, and mission-critical controls.
          </p>
        </div>

        {/* Feature Grid Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Radio className="h-3 w-3" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Multi-Pane GIS Radar</p>
              <p className="text-[11px] text-slate-400">Dense district feeds require expanded screen geometry.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Sparkles className="h-3 w-3" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Station Security</p>
              <p className="text-[11px] text-slate-400">Admin &amp; Hospital consoles are secured for verified workstations.</p>
            </div>
          </div>
        </div>

        {/* Compatible Mobile Alternatives */}
        <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-950/20 p-3 text-xs text-teal-200">
          <p className="font-medium">
            📱 <strong>Multi-screen &amp; mobile access</strong> is fully enabled for <strong>Citizen SOS</strong> and <strong>Field Rescuer</strong> interfaces.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0f766e] hover:bg-[#0d655e] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Citizen SOS Hub
          </button>
          <button
            type="button"
            onClick={() => setLocation("/responder")}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition active:scale-[0.98]"
          >
            <Shield className="h-4 w-4 text-teal-400" />
            Field Rescuer
          </button>
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 px-3 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition active:scale-[0.98]"
          >
            Role Selector
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesktopOnlyGate;
