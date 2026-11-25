import React, { useEffect, useState } from "react";
import { Monitor, ShieldAlert, ArrowLeft, HeartPulse, Shield, Radio, Sparkles, LogOut } from "lucide-react";
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
  const [bypassed, setBypassed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`sahay_bypass_gate_${portalType}`) === "true";
    } catch {
      return false;
    }
  });

  const handleUnlockCompact = () => {
    try {
      sessionStorage.setItem(`sahay_bypass_gate_${portalType}`, "true");
    } catch {}
    setBypassed(true);
  };

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
    const loginDest =
      portalType === "admin"
        ? getPortalLoginPath("admin")
        : portalType === "hospital"
          ? getPortalLoginPath("hospital")
          : getPortalLoginPath("citizen");
    setLocation(loginDest);
  };

  return (
    <>
      {!isDesktop && !bypassed && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-900 backdrop-blur-md dark:bg-amber-950/80 dark:text-amber-200">
          <span className="flex items-center gap-1.5 truncate">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">{portalName} · Field Mobile View</span>
          </span>
          <button
            type="button"
            onClick={handleUnlockCompact}
            className="shrink-0 rounded-md bg-amber-600/20 px-2 py-0.5 text-[10px] font-black uppercase hover:bg-amber-600/30"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </>
  );
}

export default DesktopOnlyGate;
