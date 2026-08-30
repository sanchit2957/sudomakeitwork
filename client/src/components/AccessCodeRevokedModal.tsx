import React from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, PhoneCall, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

interface AccessCodeRevokedModalProps {
  isOpen: boolean;
  adminContactNumber: string;
  role?: string | null;
  onClose?: () => void;
}

export function AccessCodeRevokedModal({
  isOpen,
  adminContactNumber,
  role,
  onClose,
}: AccessCodeRevokedModalProps) {
  const [, setLocation] = useLocation();

  if (!isOpen) return null;

  const handleGoToLogin = () => {
    if (onClose) onClose();
    if (role === "rescuer") {
      setLocation("/responder/login");
    } else if (role === "hospital" || role === "medical") {
      setLocation("/hospital/login");
    } else {
      setLocation("/login");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoked-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-destructive/30 bg-white p-6 shadow-2xl dark:border-destructive/40 dark:bg-[#141517] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-destructive/10 text-destructive shadow-sm dark:bg-destructive/20">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-destructive">
            <KeyRound className="h-3.5 w-3.5" />
            Security Notice
          </div>

          <h2
            id="revoked-modal-title"
            className="mt-4 text-xl font-black tracking-tight text-foreground sm:text-2xl"
          >
            Access Code Revoked
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your access code has been updated. Please contact the admin at{" "}
            <span className="font-extrabold text-foreground underline decoration-destructive underline-offset-2">
              {adminContactNumber}
            </span>{" "}
            to get the new code.
          </p>

          <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-black/5 bg-black/5 p-3.5 font-mono text-sm font-bold text-foreground dark:border-white/5 dark:bg-white/5">
            <PhoneCall className="h-4 w-4 text-[#0f766e] dark:text-emerald-400 shrink-0" />
            <span>Admin Desk: {adminContactNumber}</span>
          </div>

          <div className="mt-6 w-full">
            <Button
              onClick={handleGoToLogin}
              className="h-12 w-full rounded-xl bg-destructive text-sm font-bold text-white shadow-md hover:bg-destructive/90"
            >
              Sign In with New Code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccessCodeRevokedModal;
