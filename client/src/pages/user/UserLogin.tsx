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
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function UserLogin() {
  const { user, login, register, sendEmailOtp, verifyEmailOtp, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const isMobileApp = isNativeApp();

  const portalRole = typeof window !== "undefined"
    ? window.location.pathname === "/responder/login" ? "rescuer"
      : window.location.pathname === "/medical/login" ? "medical"
        : null
    : null;

  // Top level auth mode: "signin" or "register"
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  
  // Sign in method: "password" or "otp"
  const [signInMethod, setSignInMethod] = useState<"password" | "otp">("password");

  // OTP Verification flow state
  const [otpStep, setOtpStep] = useState<"input" | "verify">("input");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Sign In fields - empty by default (no demo accounts)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);

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
      setRegPassword("");
      setRegPhone("");
      setOtpStep("input");
      setOtpCode("");
      setSuccessMessage("Signed out successfully.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to sign out.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await login({
        email: email.trim(),
        password: password,
      });

      const role = res.user?.role;
      if (portalRole && role !== portalRole && role !== "admin") {
        await logout();
        throw new Error(`This account is not authorized for the ${portalRole === "rescuer" ? "Rescuer" : "Medical"} Portal.`);
      }
      let defaultDestination = "/";
      if (role === "admin") defaultDestination = "/command";
      else if (role === "rescuer") defaultDestination = "/responder";
      else if (role === "medical") defaultDestination = "/medical";

      setLocation(defaultDestination);
    } catch (err: any) {
      setErrorMessage(err?.message || "Authentication failed. Please check your credentials.");
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
      setErrorMessage(err?.message || "Failed to send verification code. Please verify your Supabase settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (verifyEmailOtp) {
        await verifyEmailOtp({
          email: otpEmail,
          token: otpCode,
          name: regName.trim() || undefined,
          phone: regPhone.trim() || undefined,
        });
      }
      setSuccessMessage("Email verified successfully!");
      setLocation("/");
    } catch (err: any) {
      setErrorMessage(err?.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (register) {
        await register({
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword.trim(),
          phone: regPhone.trim() || undefined,
        });
      } else {
        await login({
          email: regEmail.trim(),
          password: regPassword.trim(),
        });
      }

      setRegistrationSubmitted(true);
      setSuccessMessage("Account created successfully!");
    } catch (err: any) {
      // If error indicates email confirmation required, offer OTP flow
      if (err?.message?.toLowerCase().includes("email") || err?.message?.toLowerCase().includes("confirm") || err?.message?.toLowerCase().includes("otp")) {
        setOtpEmail(regEmail.trim());
        setOtpStep("verify");
        setOtpCountdown(60);
        setSuccessMessage(`Verification code sent to ${regEmail.trim()}! Enter it below.`);
      } else {
        setErrorMessage(err?.message || "Registration failed. Please try again.");
      }
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
      case "medical":
        return "/medical";
      default:
        return "/";
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#122824] transition-colors dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-85 focus:outline-none"
            aria-label="Back to home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm transition hover:bg-[#0f766e]/90">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight leading-tight">
                sudo <span className="text-[#da3e42]">MakeItWork</span>
              </span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">
                Assam Emergency Network
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2.5">
            {/* Admin Portal Button - Hidden on Mobile App */}
            {!isMobileApp && (
              <button
                onClick={() => setLocation("/admin/login")}
                className="hidden items-center gap-1.5 rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1.5 text-xs font-bold text-[#0f766e] transition hover:bg-[#0f766e]/20 dark:text-emerald-400 sm:flex"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Portal
              </button>
            )}
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 sm:py-10">
        {/* Active Session Card if already logged in */}
        {user ? (
          <div className="mt-8 overflow-hidden rounded-3xl border border-[#0f766e]/30 bg-white p-6 shadow-md dark:border-emerald-500/20 dark:bg-[#151718] sm:p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#0f766e] text-white shadow-lg">
                <User className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h2 className="text-xl font-black sm:text-2xl">
                    Hi, {user.name ? user.name.trim().split(/\s+/)[0] : (user.email ? user.email.split("@")[0] : "Citizen")}
                  </h2>
                  <span className="rounded-md bg-[#0f766e]/15 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-[#0f766e] dark:text-emerald-400">
                    {user.role}
                  </span>
                </div>
                {user.name && <p className="mt-0.5 text-xs font-semibold text-foreground">{user.name}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{user.email || "Active User Session"}</p>
              </div>

              <div className="mt-4 flex w-full max-w-sm flex-col gap-3">
                <Button
                  onClick={() => setLocation(getDashboardDestinationForRole(user.role))}
                  className="h-12 rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md hover:bg-[#0f766e]/90"
                >
                  {user.role === "user" ? "Enter Citizen SOS Hub" : `Enter ${user.role.toUpperCase()} Workspace`}
                </Button>
                <Button
                  onClick={handleLogout}
                  disabled={isSubmitting}
                  variant="outline"
                  className="h-11 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Signing Out…" : "Sign Out"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Title Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3.5 py-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Citizen Emergency Portal
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
                {authMode === "signin" ? "Sign In" : "Create Account"}
              </h1>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {authMode === "signin"
                  ? "Access your citizen safety profile, live disaster tracking, and instant SOS alerts."
                  : "Register a citizen account for rapid SOS dispatch and emergency contacts management."}
              </p>
            </div>

            {/* Top Sign In / Register Switcher */}
            <div className="mt-6 grid grid-cols-2 rounded-2xl bg-black/5 p-1.5 dark:bg-white/5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all ${
                  authMode === "signin"
                    ? "bg-white text-foreground shadow-sm dark:bg-[#1a1c20]"
                    : "text-muted-foreground hover:text-foreground"
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
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all ${
                  authMode === "register"
                    ? "bg-white text-foreground shadow-sm dark:bg-[#1a1c20]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Register
              </button>
            </div>

        {/* Main Auth Container */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div className="p-5 sm:p-6">
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="leading-snug">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="leading-snug">{successMessage}</div>
              </div>
            )}

            {/* STEP: OTP VERIFICATION VIEW */}
            {otpStep === "verify" ? (
              <div className="py-2 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#0f766e]/10 text-[#0f766e] dark:text-emerald-400">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-lg font-black tracking-tight">Enter Verification Code</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-xs text-muted-foreground">
                  We sent a 6-digit verification OTP to <span className="font-bold text-foreground">{otpEmail}</span>
                </p>

                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(val) => setOtpCode(val)}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-10 text-base font-bold sm:h-14 sm:w-12" />
                        <InputOTPSlot index={1} className="h-12 w-10 text-base font-bold sm:h-14 sm:w-12" />
                        <InputOTPSlot index={2} className="h-12 w-10 text-base font-bold sm:h-14 sm:w-12" />
                        <InputOTPSlot index={3} className="h-12 w-10 text-base font-bold sm:h-14 sm:w-12" />
                        <InputOTPSlot index={4} className="h-12 w-10 text-base font-bold sm:h-14 sm:w-12" />
                        <InputOTPSlot index={5} className="h-12 w-10 text-base font-bold sm:h-14 sm:w-12" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="flex items-center justify-between text-xs px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("input");
                        setOtpCode("");
                        setErrorMessage("");
                      }}
                      className="font-medium text-muted-foreground hover:text-foreground hover:underline"
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
                          : "text-[#0f766e] hover:underline dark:text-emerald-400"
                      }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${otpCountdown > 0 ? "animate-spin" : ""}`} />
                      {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : "Resend OTP"}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || otpCode.length < 6}
                    className="h-12 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md transition hover:bg-[#0f766e]/90"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Verifying…" : "Verify & Sign In"}
                  </Button>
                </form>
              </div>
            ) : authMode === "signin" ? (
              /* CITIZEN SIGN IN FORM */
              <div className="space-y-4">
                {/* Method Toggle: Password vs OTP */}
                <div className="flex rounded-xl bg-black/5 p-1 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setSignInMethod("password")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      signInMethod === "password"
                        ? "bg-white text-foreground shadow-xs dark:bg-[#1f2126]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignInMethod("otp")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      signInMethod === "otp"
                        ? "bg-white text-foreground shadow-xs dark:bg-[#1f2126]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Email OTP
                  </button>
                </div>

                {signInMethod === "password" ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <Label htmlFor="email" className="text-xs font-bold text-foreground">Email or Username</Label>
                      <Input
                        id="email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email or username"
                        className="mt-1.5 h-11 rounded-xl text-sm"
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-bold text-foreground">Password</Label>
                      </div>
                      <div className="relative mt-1.5">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-11 rounded-xl pr-10 text-sm"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-12 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md transition hover:bg-[#0f766e]/90"
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Authenticating…" : "Sign In with Password"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendOtp(email);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="otp-email" className="text-xs font-bold text-foreground">Email Address</Label>
                      <Input
                        id="otp-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="mt-1.5 h-11 rounded-xl text-sm"
                        autoComplete="email"
                        required
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        We will send a 6-digit temporary one-time password to your email.
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-12 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md transition hover:bg-[#0f766e]/90"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Sending OTP…" : "Send 6-Digit OTP"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : registrationSubmitted ? (
              /* REGISTRATION SUCCESS NOTICE */
              <div className="py-2 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-[#19755f]" />
                <h3 className="mt-3 text-base font-black sm:text-lg">Account Created Successfully!</h3>
                <p className="mx-auto mt-2 text-xs leading-relaxed text-muted-foreground">
                  Your citizen account is now active. You can sign in and register emergency contacts or broadcast instant SOS alerts.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => setLocation("/")}
                    className="flex-1 h-11 rounded-xl bg-[#0f766e] text-xs font-bold text-white hover:bg-[#0f766e]/90"
                  >
                    Go to Home & SOS Hub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRegistrationSubmitted(false);
                      setAuthMode("signin");
                    }}
                    className="h-11 rounded-xl text-xs font-semibold"
                  >
                    Return to Sign In
                  </Button>
                </div>
              </div>
            ) : (
              /* CITIZEN REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <Label htmlFor="reg-name" className="text-xs font-bold">Full Name</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="mt-1 h-10 rounded-xl text-sm"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="reg-email" className="text-xs font-bold">Email Address</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="mt-1 h-10 rounded-xl text-sm"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-password" className="text-xs font-bold">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="reg-password"
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-10 rounded-xl pr-10 text-sm"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                      >
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                    className="mt-1 h-10 rounded-xl text-sm"
                    autoComplete="tel"
                  />
                </div>

                <p className="rounded-xl bg-[#f0faf6] p-3 text-[11px] font-semibold leading-relaxed text-[#285f55] dark:bg-emerald-950/30 dark:text-emerald-300">
                  🛡️ Public accounts are registered as Citizen profiles. Operational access for Rescuers & Medical facilities is assigned by State Command.
                </p>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md transition hover:bg-[#0f766e]/90"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating Account…" : "Register Citizen Account"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Operational Personnel Section (Rescuer & Medical) */}
        <div className="mt-8">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/10 dark:border-white/10" />
            </div>
            <span className="relative bg-[#f4f7f6] px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:bg-[#090a0a]">
              Emergency Personnel Portals
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Field Rescuer Card */}
            <button
              type="button"
              onClick={() => setLocation("/responder/login")}
              className="group flex items-center justify-between rounded-2xl border border-black/10 bg-white p-3.5 text-left shadow-sm transition hover:border-[#0f766e]/40 hover:shadow-md dark:border-white/10 dark:bg-[#141517] dark:hover:border-emerald-500/40"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-foreground">Field Rescuer</h4>
                  <p className="text-[11px] text-muted-foreground">NDRF, SDRF & Quick Response</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0f766e] group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Hospital & Medical Card */}
            <button
              type="button"
              onClick={() => setLocation("/medical/login")}
              className="group flex items-center justify-between rounded-2xl border border-black/10 bg-white p-3.5 text-left shadow-sm transition hover:border-[#0f766e]/40 hover:shadow-md dark:border-white/10 dark:bg-[#141517] dark:hover:border-emerald-500/40"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-foreground">Hospital & Medical</h4>
                  <p className="text-[11px] text-muted-foreground">Duty Doctors & Bed Coordinators</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0f766e] group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* Extreme Bottom Admin Link */}
        <div className="mt-8 mb-6 text-center">
          <button
            type="button"
            onClick={() => setLocation("/admin/login")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <span>Admin?</span>
            <span className="font-bold text-[#0f766e] underline underline-offset-2 hover:text-[#0f766e]/80 dark:text-emerald-400">
              Click here
            </span>
          </button>
        </div>
          </>
        )}
      </main>
    </div>
  );
}
