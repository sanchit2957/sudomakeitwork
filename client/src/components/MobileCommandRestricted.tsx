import { ShieldAlert, Monitor, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function MobileCommandRestricted() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d221e] px-6 py-12 text-white">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#1b5e52]/50 bg-gradient-to-b from-[#174e46]/90 to-[#0e302b]/95 p-7 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#277b6b]/20 blur-2xl" />
        
        <div className="mb-6 flex items-center justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[#34a08c]/40 bg-[#123832] shadow-inner">
            <Monitor className="h-10 w-10 text-[#5eead4]" />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0d221e] bg-amber-500 text-black">
              <ShieldAlert className="h-4 w-4 stroke-[2.5]" />
            </span>
          </div>
        </div>

        <div className="text-center">
          <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
            Terminal Access Policy
          </span>
          <h1 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
            Command Centre Restricted on Mobile
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-[#c2e2db]">
            The State Emergency Command Centre requires a high-resolution desktop workstation or web console for tactical mapping, multi-channel telemetry, and multi-team dispatching.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3.5 text-left text-[11px] text-[#a7d4cb]">
            <p className="font-semibold text-[#5eead4]">Authorized Access Instructions:</p>
            <p className="mt-1 leading-5">
              Please access the Command HQ portal directly using a desktop or laptop web browser at your designated command URL.
            </p>
          </div>
        </div>

        <div className="mt-7">
          <button
            onClick={() => setLocation("/")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#208b77] to-[#176a5b] py-3.5 text-xs font-bold text-white shadow-lg shadow-[#174e46]/50 transition hover:opacity-95 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Safety Portal
          </button>
        </div>
      </div>
    </div>
  );
}
