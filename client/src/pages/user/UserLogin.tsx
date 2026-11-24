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
import { useLanguage } from "@/contexts/LanguageContext";
import { isNativeApp } from "@/lib/apiConfig";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

export function formatAuthError(err: any): string {
  if (!err) return "An unexpected error occurred. Please try again.";
  const raw = typeof err === "string" ? err : err?.message || String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("networkrequestfailed") ||
    lower.includes("load failed") ||
    lower.includes("err_connection")
  ) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("magic link") ||
    lower.includes("error sending magic link email")
  ) {
    return "Supabase email service limit reached (default free tier allows ~3 emails/hour). If you have a password, switch to the 'Password Login' tab above, or configure custom SMTP in Supabase Settings > Auth > SMTP.";
  }
  return raw;
}

export default function UserLogin() {
  const { user, login, register, sendEmailOtp, verifyEmailOtp, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const isMobileApp = isNativeApp();

  // Top level auth mode: "signin" or "register"
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [signinMethod, setSigninMethod] = useState<"otp" | "password">(() =>
    isSupabaseConfigured() ? "otp" : "password"
  );

  // OTP Verification flow state
  const [otpStep, setOtpStep] = useState<"input" | "verify">("input");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Citizen Sign In & Register fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);

  // Handle ?panel= query parameter for panel-specific login entry
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const panel = params.get("panel");
    if (panel === "admin") {
      setLocation("/admin/login");
    } else if (panel === "rescuer" || panel === "responder") {
      setLocation("/responder/login");
    } else if (panel === "medical" || panel === "hospital") {
      setLocation("/hospital/login");
    }
  }, [setLocation]);

  // Countdown timer effect
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const handleLogout = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await logout();
      setEmail("");
      setPassword("");
      setRegName("");
      setRegEmail("");
      setRegPhone("");
      setOtpStep("input");
      setOtpCode("");
      setSuccessMessage("Signed out successfully.");
    } catch (err: any) {
      setErrorMessage(formatAuthError(err) || "Failed to sign out.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your account password.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await login({
        email: email.trim(),
        password: password.trim(),
        role: "user",
      });
      setSuccessMessage("Signed in successfully! Redirecting…");
      const targetRole = res?.user?.role || "user";
      setLocation(getDashboardDestinationForRole(targetRole));
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (targetEmail: string) => {
    if (!targetEmail || !targetEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (sendEmailOtp) {
        await sendEmailOtp(targetEmail.trim());
      }
      setOtpEmail(targetEmail.trim());
      setOtpStep("verify");
      setOtpCountdown(60);
      setSuccessMessage(`A 6-digit verification code was sent to ${targetEmail.trim()}. Check your inbox.`);
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string, e?: FormEvent) => {
    if (e) e.preventDefault();
    const code = (typeof codeToVerify === "string" ? codeToVerify : otpCode).trim();
    if (!code || code.length < 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (verifyEmailOtp) {
        const res = await verifyEmailOtp({
          email: otpEmail,
          token: code,
          name: regName.trim() || undefined,
          phone: regPhone.trim() || undefined,
        });
        setSuccessMessage("Email verified successfully! Establishing session…");
        const targetRole = res?.user?.role || "user";
        const destination = getDashboardDestinationForRole(targetRole);
        setLocation(destination);
      }
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!regEmail || !regEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage("Please enter a secure password (at least 4 characters).");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        phone: regPhone.trim() || undefined,
        role: "user",
      });
      setSuccessMessage("Account created successfully! Redirecting…");
      const targetRole = res?.user?.role || "user";
      setLocation(getDashboardDestinationForRole(targetRole));
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDashboardDestinationForRole = (role: string) => {
    switch (role) {
      case "admin":
        return "/command";
      case "rescuer":
        return "/responder";
      case "hospital":
      case "medical":
        return "/medical";
      default:
        return "/";
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B0F17]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-85 focus:outline-none"
            aria-label="Back to home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-sky-500 dark:text-slate-950 font-black">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight leading-tight">
                Sahay Emergency Network
              </span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Disaster Response Platform
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2.5">
            {!isMobileApp && (
              <button
                onClick={() => setLocation("/admin/login")}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:flex"
              >
                <Shield className="h-3.5 w-3.5 text-sky-500" />
                Admin Console
              </button>
            )}
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12 my-auto">
        {/* Active Session Card if already logged in */}
        {user ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white mb-4">
              <User className="h-7 w-7" />
            </span>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-black">
                {user.name ? user.name.trim().split(/\s+/)[0] : (user.email ? user.email.split("@")[0] : "Citizen")}
              </h2>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                {user.role}
              </span>
            </div>
            {user.name && <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{user.name}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">{user.email || "Active User Session"}</p>

            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                onClick={() => setLocation(getDashboardDestinationForRole(user.role))}
                className="h-11 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                {user.role === "user" ? "Enter Citizen SOS Hub" : `Enter ${user.role.toUpperCase()} Workspace`}
              </Button>
              <Button
                onClick={handleLogout}
                disabled={isSubmitting}
                variant="outline"
                className="h-10 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900 dark:text-rose-400"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                {isSubmitting ? "Signing Out…" : "Sign Out"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Title Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Citizen Emergency Access
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {authMode === "signin" ? "Sign In to Sahay" : "Create Citizen Account"}
              </h1>
              <p className="mx-auto mt-2 text-xs text-muted-foreground leading-relaxed max-w-sm">
                {authMode === "signin"
                  ? "Access verified safety resources, personal SOS telemetry, and emergency assistance."
                  : "Register with Sahay for rapid SOS response and verified emergency family alerts."}
              </p>
            </div>

            {/* Segmented Auth Switcher */}
            <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                  authMode === "signin"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white font-extrabold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                  authMode === "register"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white font-extrabold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Register
              </button>
            </div>

            {/* Main Auth Form Container */}
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {errorMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="leading-snug">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="leading-snug">{successMessage}</div>
                </div>
              )}

              {/* STEP: OTP VERIFICATION VIEW */}
              {otpStep === "verify" ? (
                <div className="py-1 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-base font-bold">Enter Verification Code</h3>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                    A 6-digit verification code was transmitted to <span className="font-bold text-foreground">{otpEmail}</span>
                  </p>

                  <form onSubmit={(e) => handleVerifyOtp(otpCode, e)} className="mt-5 space-y-4">
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
                          <InputOTPSlot index={0} className="h-11 w-10 text-base font-bold sm:h-12 sm:w-11" />
                          <InputOTPSlot index={1} className="h-11 w-10 text-base font-bold sm:h-12 sm:w-11" />
                          <InputOTPSlot index={2} className="h-11 w-10 text-base font-bold sm:h-12 sm:w-11" />
                          <InputOTPSlot index={3} className="h-11 w-10 text-base font-bold sm:h-12 sm:w-11" />
                          <InputOTPSlot index={4} className="h-11 w-10 text-base font-bold sm:h-12 sm:w-11" />
                          <InputOTPSlot index={5} className="h-11 w-10 text-base font-bold sm:h-12 sm:w-11" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="flex items-center justify-between text-xs px-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep("input");
                          setOtpCode("");
                          setErrorMessage("");
                        }}
                        className="text-muted-foreground hover:text-foreground font-medium"
                      >
                        Change Email
                      </button>

                      <button
                        type="button"
                        disabled={otpCountdown > 0 || isSubmitting}
                        onClick={() => handleSendOtp(otpEmail)}
                        className={`flex items-center gap-1 font-bold ${
                          otpCountdown > 0
                            ? "cursor-not-allowed text-muted-foreground"
                            : "text-sky-600 hover:underline dark:text-sky-400"
                        }`}
                      >
                        <RefreshCw className={`h-3 w-3 ${otpCountdown > 0 ? "animate-spin" : ""}`} />
                        {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : "Resend Code"}
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting || otpCode.length < 6}
                      className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      {isSubmitting ? "Verifying…" : "Verify & Sign In"}
                    </Button>
                  </form>
                </div>
              ) : authMode === "signin" ? (
                /* CITIZEN SIGN IN FORM - OTP OR PASSWORD */
                <div className="space-y-4">
                  {/* Method Toggle */}
                  <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setSigninMethod("otp");
                        setErrorMessage("");
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                        signinMethod === "otp"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white font-bold"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSigninMethod("password");
                        setErrorMessage("");
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                        signinMethod === "password"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white font-bold"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Password
                    </button>
                  </div>

                  {signinMethod === "otp" ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendOtp(email);
                      }}
                      className="space-y-3.5"
                    >
                      <div>
                        <Label htmlFor="email" className="text-xs font-bold">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="mt-1.5 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                          autoComplete="email"
                          required
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          We will send a 6-digit code for instant passwordless sign-in.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting || !email.trim()}
                        className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                      >
                        <Mail className="mr-1.5 h-4 w-4" />
                        {isSubmitting ? "Sending Code…" : "Send Verification Code"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                      <div>
                        <Label htmlFor="pwd-email" className="text-xs font-bold">Email Address</Label>
                        <Input
                          id="pwd-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. citizen@assamrescue.gov.in"
                          className="mt-1.5 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                          autoComplete="email"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="pwd-password" className="text-xs font-bold">Password</Label>
                        <div className="relative mt-1.5">
                          <Input
                            id="pwd-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Account password"
                            className="h-10 rounded-lg pr-10 text-sm border-slate-200 dark:border-slate-800"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] text-muted-foreground">Local development?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail("citizen@assamrescue.gov.in");
                            setPassword("citizen");
                            setErrorMessage("");
                          }}
                          className="font-mono text-[11px] font-bold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Demo Citizen
                        </button>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting || !email.trim() || !password.trim()}
                        className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                      >
                        <Lock className="mr-1.5 h-4 w-4" />
                        {isSubmitting ? "Signing In…" : "Sign In with Password"}
                      </Button>
                    </form>
                  )}
                </div>
              ) : registrationSubmitted ? (
                <div className="py-2 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h3 className="mt-3 text-base font-bold">Account Created Successfully!</h3>
                  <p className="mx-auto mt-1.5 text-xs text-muted-foreground">
                    Your citizen account is ready for instant disaster alerts and rapid SOS dispatch.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => setLocation("/")}
                      className="flex-1 h-10 rounded-xl bg-slate-900 text-xs font-bold text-white dark:bg-sky-500 dark:text-slate-950"
                    >
                      Go to Home
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRegistrationSubmitted(false);
                        setAuthMode("signin");
                      }}
                      className="h-10 rounded-xl text-xs font-semibold"
                    >
                      Return to Sign In
                    </Button>
                  </div>
                </div>
              ) : (
                /* CITIZEN REGISTRATION FORM */
                <form onSubmit={handleRegister} className="space-y-3">
                  <h3 className="text-base font-bold text-foreground">Create Account</h3>
                  <div>
                    <Label htmlFor="reg-name" className="text-xs font-bold">Full Name</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="reg-email" className="text-xs font-bold">Email Address</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="reg-pwd" className="text-xs font-bold">Create Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="reg-pwd"
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="At least 4 characters"
                        className="h-10 rounded-lg pr-10 text-sm border-slate-200 dark:border-slate-800"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                      >
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reg-phone" className="text-xs font-bold">Phone Number (Optional)</Label>
                    <Input
                      id="reg-phone"
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98640 XXXXX"
                      className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !regName.trim() || !regEmail.trim() || !regPassword.trim()}
                      className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" />
                      {isSubmitting ? "Creating Account…" : "Create Citizen Account"}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Operational Personnel Section */}
            <div className="mt-8">
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <span className="relative bg-slate-50 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:bg-[#0A0E17]">
                  Emergency Personnel Portals
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setLocation("/responder/login")}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs transition hover:border-slate-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <LifeBuoy className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Field Rescuer</h4>
                      <p className="text-[10px] text-muted-foreground">NDRF, SDRF & Field Response</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  type="button"
                  onClick={() => setLocation("/hospital/login")}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs transition hover:border-slate-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Hospital Portal</h4>
                      <p className="text-[10px] text-muted-foreground">ICU, Beds & Resource Desk</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>

            {/* Bottom Admin Link */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLocation("/admin/login")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <span>State Administrator?</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 underline underline-offset-2">
                  Click here for Command Login
                </span>
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="py-4 text-center text-[10px] font-mono text-muted-foreground border-t border-slate-200/60 dark:border-slate-800">
        Sahay Emergency Network &bull; Avishkar 2026 Emergency Technology Platform
      </footer>
    </div>
  );
}
