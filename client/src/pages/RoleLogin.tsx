import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Hospital,
  Lock,
  Mail,
  Radio,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

type PortalRole = "rescuer" | "hospital";

const portalConfig = {
  rescuer: {
    title: "Rescuer Portal",
    heading: "Rescuer Login",
    description: "Restricted access for authorized field rescue personnel & SDRF teams.",
    prompt: "Enter your verified rescuer credentials or Email OTP",
    destination: "/responder",
    icon: Radio,
  },
  hospital: {
    title: "Hospital Portal",
    heading: "Hospital Login",
    description: "Restricted access for authorized hospital operations staff & triage centers.",
    prompt: "Enter your verified hospital credentials or Email OTP",
    destination: "/hospital",
    icon: Hospital,
  },
} as const;

export function RoleLogin({ role }: { role: PortalRole }) {
  const config = portalConfig[role];
  const Icon = config.icon;
  const { login, sendEmailOtp, verifyEmailOtp, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [method, setMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpStep, setOtpStep] = useState<"input" | "verify">("input");
  const [otpCode, setOtpCode] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await login({ email: email.trim(), password });
      const userRole = result.user?.role;
      const isAuthorized = userRole === role || userRole === "admin" || (role === "hospital" && userRole === "medical");
      if (!isAuthorized) {
        await logout();
        throw new Error(
          `This account is not authorized for the ${role === "rescuer" ? "Rescuer" : "Hospital"} Portal.`
        );
      }
      setLocation(config.destination);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid official email address.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (sendEmailOtp) {
        await sendEmailOtp(email.trim());
      }
      setOtpStep("verify");
      setOtpCountdown(60);
      setSuccessMessage(`A 6-digit verification code was sent to ${email.trim()}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to dispatch verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string, e?: FormEvent) => {
    if (e) e.preventDefault();
    const code = (typeof codeToVerify === "string" ? codeToVerify : otpCode).trim();
    if (!code || code.length < 6) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (verifyEmailOtp) {
        const res = await verifyEmailOtp({
          email: email.trim(),
          token: code,
        });
        const userRole = res.user?.role;
        const isAuthorized = userRole === role || userRole === "admin" || (role === "hospital" && userRole === "medical");
        if (!isAuthorized) {
          await logout();
          throw new Error(
            `This account is not authorized for the ${role === "rescuer" ? "Rescuer" : "Hospital"} Portal.`
          );
        }
      }
      setLocation(config.destination);
    } catch (err: any) {
      setErrorMessage(err?.message || "Invalid or expired OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#122824] dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button onClick={() => setLocation("/login")} className="flex items-center gap-2.5 text-left transition hover:opacity-80">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm"><ArrowLeft className="h-4 w-4" /></span>
            <span>
              <span className="block text-base font-black tracking-tight">sudo <span className="text-[#da3e42]">MakeItWork</span></span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">Assam Emergency Network</span>
            </span>
          </button>
          <div className="flex items-center gap-3"><Button variant="outline" size="sm" onClick={() => setLocation("/login")}>Other Logins</Button><LanguageSelector compact /></div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10 md:py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400"><Icon className="h-4 w-4" /> {config.title}</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{config.heading}</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div className="border-b border-black/5 bg-[#fafcfb] p-4 dark:border-white/5 dark:bg-[#18191c]">
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0f766e]/10 text-[#0f766e] dark:text-emerald-400"><Lock className="h-4 w-4" /></span><div><h2 className="text-xs font-black uppercase tracking-wide">Official {config.title} Sign In</h2><p className="text-[11px] text-muted-foreground">{config.prompt}</p></div></div>
          </div>
          <div className="p-6">
            {errorMessage && <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div>{errorMessage}</div></div>}
            {successMessage && <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div>{successMessage}</div></div>}

            {otpStep === "verify" ? (
              <form onSubmit={(e) => handleVerifyOtp(otpCode, e)} className="space-y-5 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#0f766e]/10 text-[#0f766e] dark:text-emerald-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Enter Verification Code</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Sent to {email}</p>
                </div>

                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(val) => {
                      const clean = val.replace(/\D/g, "");
                      setOtpCode(clean);
                      setErrorMessage("");
                      if (clean.length === 6 && !isSubmitting) {
                        void handleVerifyOtp(clean);
                      }
                    }}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-11 w-9 text-sm font-bold sm:h-12 sm:w-11" />
                      <InputOTPSlot index={1} className="h-11 w-9 text-sm font-bold sm:h-12 sm:w-11" />
                      <InputOTPSlot index={2} className="h-11 w-9 text-sm font-bold sm:h-12 sm:w-11" />
                      <InputOTPSlot index={3} className="h-11 w-9 text-sm font-bold sm:h-12 sm:w-11" />
                      <InputOTPSlot index={4} className="h-11 w-9 text-sm font-bold sm:h-12 sm:w-11" />
                      <InputOTPSlot index={5} className="h-11 w-9 text-sm font-bold sm:h-12 sm:w-11" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <button type="button" onClick={() => setOtpStep("input")} className="text-muted-foreground hover:underline">Change Email</button>
                  <button type="button" disabled={otpCountdown > 0 || isSubmitting} onClick={handleSendOtp} className="font-bold text-[#0f766e] hover:underline dark:text-emerald-400">
                    <RefreshCw className={`inline mr-1 h-3 w-3 ${otpCountdown > 0 ? "animate-spin" : ""}`} />
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : "Resend"}
                  </button>
                </div>

                <Button type="submit" disabled={isSubmitting || otpCode.length < 6} className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Verifying…" : "Verify & Access Portal"}
                </Button>
              </form>
            ) : (
              <div>
                <div className="mb-4 flex rounded-xl bg-black/5 p-1 dark:bg-white/5">
                  <button type="button" onClick={() => setMethod("password")} className={`flex-1 rounded-lg py-1 text-xs font-bold transition-all ${method === "password" ? "bg-white text-foreground shadow-xs dark:bg-[#1f2126]" : "text-muted-foreground hover:text-foreground"}`}>Password</button>
                  <button type="button" onClick={() => setMethod("otp")} className={`flex-1 rounded-lg py-1 text-xs font-bold transition-all ${method === "otp" ? "bg-white text-foreground shadow-xs dark:bg-[#1f2126]" : "text-muted-foreground hover:text-foreground"}`}>Email OTP</button>
                </div>

                {method === "password" ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div><Label htmlFor={`${role}-email`} className="text-xs font-bold">Email or Username</Label><Input id={`${role}-email`} type="text" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 h-11 rounded-xl" required /></div>
                    <div><Label htmlFor={`${role}-password`} className="text-xs font-bold">Password</Label><div className="relative mt-1.5"><Input id={`${role}-password`} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} className="h-11 rounded-xl pr-11" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                    <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90"><Icon className="mr-2 h-4 w-4" />{isSubmitting ? "Authenticating…" : `Sign In to ${role === "rescuer" ? "Rescuer" : "Hospital"}`}</Button>
                  </form>
                ) : (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <Label htmlFor={`${role}-otp-email`} className="text-xs font-bold">Official Email Address</Label>
                      <Input id={`${role}-otp-email`} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="officer@assamrescue.gov.in" className="mt-1.5 h-11 rounded-xl" required />
                      <p className="mt-1 text-[11px] text-muted-foreground">A 6-digit emergency verification code will be dispatched to your email.</p>
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90"><Mail className="mr-2 h-4 w-4" />{isSubmitting ? "Dispatching OTP…" : "Send 6-Digit OTP"}</Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 text-center"><button onClick={() => setLocation("/login")} className="text-xs font-bold text-[#0f766e] hover:underline dark:text-emerald-400">← Back to User / Other Logins</button></div>
      </main>
    </div>
  );
}

export function RescuerLogin() {
  return <RoleLogin role="rescuer" />;
}

export function HospitalLogin() {
  return <RoleLogin role="hospital" />;
}

export const MedicalLogin = HospitalLogin;
