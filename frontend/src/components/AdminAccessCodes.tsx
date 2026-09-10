import React, { FormEvent, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function AdminAccessCodes() {
  const utils = trpc.useUtils();
  const accessCodesQuery = trpc.auth.accessCodes.list.useQuery();

  const updateCodeMutation = trpc.auth.accessCodes.updateCode.useMutation({
    onSuccess: () => {
      void utils.auth.accessCodes.list.invalidate();
    },
  });

  const regenerateCodeMutation = trpc.auth.accessCodes.regenerateCode.useMutation({
    onSuccess: () => {
      void utils.auth.accessCodes.list.invalidate();
    },
  });

  // State per role for custom code inputs and recently generated codes
  const [rescuerCustomCode, setRescuerCustomCode] = useState("");
  const [hospitalCustomCode, setHospitalCustomCode] = useState("");

  const [activeRevealedCodes, setActiveRevealedCodes] = useState<{
    rescuer?: string;
    hospital?: string;
  }>({});

  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    role: string;
    text: string;
    isError?: boolean;
  } | null>(null);

  const rescuerRecord = accessCodesQuery.data?.find((c) => c.role === "rescuer");
  const hospitalRecord = accessCodesQuery.data?.find((c) => c.role === "hospital");

  const handleCopy = (role: string, textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedRole(role);
    setTimeout(() => setCopiedRole(null), 2500);
  };

  const handleSetCustomCode = async (role: "rescuer" | "hospital", e: FormEvent) => {
    e.preventDefault();
    const code = role === "rescuer" ? rescuerCustomCode.trim() : hospitalCustomCode.trim();
    if (!code || code.length < 4) {
      setStatusMessage({
        role,
        text: "Access code must be at least 4 characters long.",
        isError: true,
      });
      return;
    }

    try {
      setStatusMessage(null);
      const res = await updateCodeMutation.mutateAsync({ role, code });
      setActiveRevealedCodes((prev) => ({ ...prev, [role]: code }));
      if (role === "rescuer") setRescuerCustomCode("");
      else setHospitalCustomCode("");
      setStatusMessage({
        role,
        text: `Updated ${role} access code (v${res.codeVersion}). All active ${role} sessions have been invalidated.`,
      });
    } catch (err: any) {
      setStatusMessage({
        role,
        text: err?.message || "Failed to update access code.",
        isError: true,
      });
    }
  };

  const handleRegenerate = async (role: "rescuer" | "hospital") => {
    try {
      setStatusMessage(null);
      const res = await regenerateCodeMutation.mutateAsync({ role });
      setActiveRevealedCodes((prev) => ({ ...prev, [role]: res.code }));
      setStatusMessage({
        role,
        text: `Generated new secure ${role} access code (v${res.codeVersion}). All active ${role} sessions will be forced out.`,
      });
    } catch (err: any) {
      setStatusMessage({
        role,
        text: err?.message || "Failed to regenerate access code.",
        isError: true,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#881337] dark:text-[#facc15]">
          Security & Access Gating
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Role Access Codes
        </h1>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Rescuer and Hospital roles require an active Government Access Code to sign up and authenticate.
          When an access code is updated or regenerated, its version increments, immediately invalidating all
          active sessions for that role across web and mobile clients.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-50/50 p-4 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="leading-relaxed">
          <strong className="font-bold">Real-time Session Invalidation:</strong> Active responders and hospital staff poll session validity every 30 seconds. Changing a code forces all logged-in users to re-authenticate.
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* RESCUER ACCESS CODE CARD */}
        <div className="flex flex-col justify-between rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#881337]/10 text-[#881337] dark:bg-[#eab308]/15 dark:text-[#facc15]">
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-black">Rescuer Field Access</h2>
                  <p className="text-xs text-muted-foreground">For NDRF, SDRF, and frontline units</p>
                </div>
              </div>
              <span className="rounded-full bg-black/5 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase dark:bg-white/5">
                v{rescuerData?.codeVersion ?? 1}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-black/5 bg-[#fafcfb] p-4 dark:border-white/5 dark:bg-[#18191c]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Current Active Code
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {rescuerData?.updatedAt
                    ? new Date(rescuerData.updatedAt).toLocaleDateString()
                    : "Active"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="font-mono text-lg font-black tracking-widest text-foreground">
                  {showRescuerCode ? rescuerData?.code || "••••••••" : "••••••••••••"}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowRescuerCode((v) => !v)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                  >
                    {showRescuerCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {rescuerData?.code && (
                    <button
                      type="button"
                      onClick={() => handleCopy("rescuer", rescuerData.code!)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                    >
                      {copiedRole === "rescuer" ? (
                        <Check className="h-4 w-4 text-[#ca8a04]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {activeRevealedCodes.rescuer && (
              <div className="mt-4 rounded-2xl border border-[#ca8a04]/30 bg-[#fefce8] p-4 dark:border-[#ca8a04]/30 dark:bg-[#422006]/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#854d0e] dark:text-[#fef08a]">
                    Active Code (Share with Rescuers)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("rescuer", activeRevealedCodes.rescuer!)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#881337] shadow-sm hover:bg-[#fff1f2] dark:bg-[#1a1c20] dark:text-[#facc15]"
                  >
                    {copiedRole === "rescuer" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#ca8a04]" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Code
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 font-mono text-base font-black tracking-widest text-[#854d0e] dark:text-[#fef08a]">
                  {activeRevealedCodes.rescuer}
                </div>
              </div>
            )}

            {statusMessage && statusMessage.role === "rescuer" && (
              <div
                className={`mt-4 rounded-2xl p-3 text-xs font-semibold ${
                  statusMessage.isError
                    ? "border border-destructive/30 bg-destructive/10 text-destructive"
                    : "border border-[#ca8a04]/30 bg-[#fefce8] text-[#854d0e] dark:text-[#fef08a]"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={(e) => handleSetCustomCode("rescuer", e)} className="mt-5 space-y-3">
              <div>
                <Label htmlFor="rescuer-custom-code" className="text-xs font-bold">Set Custom Rescuer Code</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="rescuer-custom-code"
                    type="text"
                    value={rescuerCustomCode}
                    onChange={(e) => setRescuerCustomCode(e.target.value)}
                    placeholder="e.g. ASSAM-SDRF-2026"
                    className="h-10 rounded-xl font-mono text-xs font-bold"
                  />
                  <Button
                    type="submit"
                    disabled={updateCodeMutation.isPending || !rescuerCustomCode.trim()}
                    className="h-10 shrink-0 rounded-xl bg-[#881337] text-xs font-bold text-white shadow-sm hover:bg-[#9f1239] dark:bg-[#eab308] dark:text-[#0a0b0d] dark:hover:bg-[#facc15]"
                  >
                    Set Code
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Regenerate Action */}
          <div className="mt-6 border-t border-black/5 pt-4 dark:border-white/5">
            <Button
              type="button"
              variant="outline"
              disabled={regenerateCodeMutation.isPending}
              onClick={() => handleRegenerate("rescuer")}
              className="h-11 w-full rounded-xl border-dashed text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              <Sparkles className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
              {regenerateCodeMutation.isPending ? "Generating…" : "Generate New Random Rescuer Code"}
            </Button>
          </div>
        </div>

        {/* HOSPITAL ACCESS CODE CARD */}
        <div className="flex flex-col justify-between rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <Building2 className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-foreground sm:text-lg">
                    Hospital Access Code
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Required for hospital staff, doctors & triage desks
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-blue-500/15 px-3 py-1 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-400">
                v{hospitalRecord?.codeVersion ?? 1}
              </span>
            </div>

            {/* Version Metadata */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/5 bg-black/5 p-3 font-mono text-[11px] text-muted-foreground dark:border-white/5 dark:bg-white/5">
              <span>Code Version: <strong>v{hospitalRecord?.codeVersion ?? 1}</strong></span>
              <span>
                Updated:{" "}
                <strong>
                  {hospitalRecord?.updatedAt
                    ? new Date(hospitalRecord.updatedAt).toLocaleDateString()
                    : "Initial"}
                </strong>
              </span>
            </div>

            {/* Newly Generated / Saved Code Preview */}
            {activeRevealedCodes.hospital && (
              <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Active Code (Share with Hospital Staff)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("hospital", activeRevealedCodes.hospital!)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {copiedRole === "hospital" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-blue-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Code
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 font-mono text-base font-black tracking-widest text-blue-950 dark:text-blue-100">
                  {activeRevealedCodes.hospital}
                </div>
              </div>
            )}

            {/* Status Message */}
            {statusMessage && statusMessage.role === "hospital" && (
              <div
                className={`mt-4 rounded-2xl p-3 text-xs font-semibold ${
                  statusMessage.isError
                    ? "border border-destructive/30 bg-destructive/10 text-destructive"
                    : "border border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            {/* Set Custom Code Form */}
            <form
              onSubmit={(e) => handleSetCustomCode("hospital", e)}
              className="mt-5 space-y-3"
            >
              <div>
                <Label htmlFor="hospital-custom-code" className="text-xs font-bold">
                  Set Custom Hospital Code
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="hospital-custom-code"
                    type="text"
                    value={hospitalCustomCode}
                    onChange={(e) => setHospitalCustomCode(e.target.value)}
                    placeholder="e.g. ASSAM-MED-2026"
                    className="h-10 rounded-xl font-mono text-xs font-bold"
                  />
                  <Button
                    type="submit"
                    disabled={updateCodeMutation.isPending || !hospitalCustomCode.trim()}
                    className="h-10 shrink-0 rounded-xl bg-[#881337] text-xs font-bold text-white shadow-sm hover:bg-[#9f1239] dark:bg-[#eab308] dark:text-[#0a0b0d] dark:hover:bg-[#facc15]"
                  >
                    Set Code
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Regenerate Action */}
          <div className="mt-6 border-t border-black/5 pt-4 dark:border-white/5">
            <Button
              type="button"
              variant="outline"
              disabled={regenerateCodeMutation.isPending}
              onClick={() => handleRegenerate("hospital")}
              className="h-11 w-full rounded-xl border-dashed text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/20"
            >
              <Sparkles className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
              {regenerateCodeMutation.isPending ? "Generating…" : "Generate New Random Hospital Code"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAccessCodes;
