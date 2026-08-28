import { ShieldAlert, Monitor, ArrowLeft, LogIn, Lock, MapPin, Cpu, Radio } from "lucide-react";
import { useLocation } from "wouter";

export default function MobileCommandRestricted() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#071311] px-4 py-8 text-white sm:px-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#1b5e52]/50 bg-gradient-to-b from-[#133d36]/95 to-[#0b221e]/98 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#277b6b]/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-[#0f766e]/20 blur-3xl" />

        {/* Icon */}
        <div className="mb-5 flex items-center justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[#34a08c]/40 bg-[#0e2c27] shadow-inner">
            <Monitor className="h-10 w-10 text-[#5eead4]" />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#071311] bg-amber-500 text-black">
              <ShieldAlert className="h-4 w-4 stroke-[2.5]" />
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
            Access Policy Notice
          </span>
          <h1 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
            Admin Panel Restricted on Mobile Devices
          </h1>
          <p className="mt-2.5 text-xs leading-relaxed text-[#c2e2db] sm:text-sm">
            The State Emergency Command Centre administrator console is restricted to secure, large-screen desktop workstations.
          </p>
        </div>

        {/* Clear Reasons Section */}
        <div className="mt-6 space-y-2.5 rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#5eead4]">
            Why is Admin access restricted on phones?
          </p>
          
          <div className="space-y-2 text-xs text-[#d1ece6]">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#208b77]/20 text-[#5eead4]">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <p className="leading-snug">
                <strong>High-Density GIS & Radar:</strong> Live multi-district tactical maps, radar overlays, and sensor feeds require a high-resolution display (&ge; 1280px).
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#208b77]/20 text-[#5eead4]">
                <Radio className="h-3.5 w-3.5" />
              </span>
              <p className="leading-snug">
                <strong>Multi-Team Tactical Dispatch:</strong> Simultaneous coordination across NDRF, SDRF, and medical units requires multi-window command controls.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#208b77]/20 text-[#5eead4]">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <p className="leading-snug">
                <strong>Terminal Security Policy:</strong> State administrator operations require verified fixed-workstation credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Action Note */}
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3 text-[11px] text-emerald-300">
          💡 <strong>Need operational access on mobile?</strong> Use the dedicated <strong>Field Rescuer</strong> or <strong>Hospital</strong> portal on this device.
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#208b77] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#208b77]/90 active:scale-[0.98]"
          >
            <LogIn className="h-4 w-4" />
            Return to Login
          </button>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/20 py-3 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Home / SOS Hub
          </button>
        </div>
      </div>
    </div>
  );
}
