import { useAuth } from "@/_core/hooks/useAuth";
import { formatAuthError } from "./user/UserLogin";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Hospital,
  KeyRound,
  Lock,
  Radio,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type PortalRole = "rescuer" | "hospital";

const portalConfig = {
  rescuer: {
    title: "Rescuer Portal",
    heading: "Rescuer Access",
    description: "Restricted access for authorized field rescue personnel & SDRF teams.",
    prompt: "Enter your rescuer credentials and the active Government Access Code.",
    destination: "/responder",
    icon: Radio,
    callSignPlaceholder: "e.g. NDRF-Boat-01",
    callSignLabel: "Field Call Sign",
  },
  hospital: {
    title: "Hospital Portal",
    heading: "Hospital Access",
    description: "Restricted access for authorized hospital operations staff & triage centers.",
    prompt: "Enter your hospital staff credentials and the active Government Access Code.",
    destination: "/hospital",
    icon: Hospital,
    callSignPlaceholder: "e.g. Guwahati Triage Desk",
    callSignLabel: "Facility / Ward Label",
  },
} as const;

export function RoleLogin({ role }: { role: PortalRole }) {
  const config = portalConfig[role];
  const Icon = config.icon;
  const { login, register, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Mode: "signin" vs "register"
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");

  // Sign In fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [governmentCode, setGovernmentCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regGovernmentCode, setRegGovernmentCode] = useState("");
  const [regCallSign, setRegCallSign] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your account password.");
      return;
    }
    if (!governmentCode.trim()) {
      setErrorMessage("Government Access Code is required to authenticate.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await login({
        email: email.trim(),
        password,
        role: role,
        governmentCode: governmentCode.trim(),
      });
      const userRole = result.user?.role;
      const isAuthorized =
        userRole === role ||
        userRole === "admin" ||
        (role === "hospital" && userRole === "medical");
      if (!isAuthorized) {
        await logout();
        throw new Error(
          `This account is not authorized for the ${role === "rescuer" ? "Rescuer" : "Hospital"} Portal.`
        );
      }
      setLocation(config.destination);
    } catch (error: any) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!regName.trim()) {
      setErrorMessage("Please enter your full name or unit title.");
      return;
    }
    if (!regEmail || !regEmail.includes("@")) {
      setErrorMessage("Please enter a valid official email address.");
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage("Please enter a secure password (at least 4 characters).");
      return;
    }
    if (!regGovernmentCode.trim()) {
      setErrorMessage("Government Access Code is required for registration.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        role: role,
        governmentCode: regGovernmentCode.trim(),
        callSign: regCallSign.trim() || undefined,
      });
      const userRole = result.user?.role;
      const isAuthorized =
        userRole === role ||
        userRole === "admin" ||
        (role === "hospital" && userRole === "medical");
      if (!isAuthorized) {
        await logout();
        throw new Error(
          `Registration succeeded, but account role is not authorized for the ${role === "rescuer" ? "Rescuer" : "Hospital"} Portal.`
        );
      }
      setLocation(config.destination);
    } catch (error: any) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#122824] transition-colors dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => setLocation("/login")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-80 focus:outline-none"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight leading-tight">Assam Emergency Network</span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">
                Disaster Management Authority
              </span>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setLocation("/login")} className="text-xs">
              Citizen Portal
            </Button>
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8 md:py-12">
        {/* Title Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400">
            <Icon className="h-4 w-4" /> {config.title}
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">{config.heading}</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
        </div>

        {/* Mode Switcher */}
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
            Sign Up
          </button>
        </div>

        {/* Form Card */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div className="border-b border-black/5 bg-[#fafcfb] p-4 dark:border-white/5 dark:bg-[#18191c]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0f766e]/10 text-[#0f766e] dark:text-emerald-400">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wide">
                  {authMode === "signin" ? `Authorized ${config.title} Login` : `Register ${config.title} Account`}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {authMode === "signin"
                    ? "Email/Password for identity + active Government Code."
                    : "Create role account gated by active Government Code."}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="leading-snug">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="leading-snug">{successMessage}</div>
              </div>
            )}

            {authMode === "signin" ? (
              /* SIGN IN FORM */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor={`${role}-email`} className="text-xs font-bold">
                    Email or Username
                  </Label>
                  <Input
                    id={`${role}-email`}
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. officer@assamrescue.gov.in"
                    className="mt-1.5 h-11 rounded-xl text-sm"
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor={`${role}-password`} className="text-xs font-bold">
                    Password
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id={`${role}-password`}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="h-11 rounded-xl pr-11 text-sm"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${role}-gov-code`} className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Government Code <span className="text-destructive">*</span>
                    </Label>
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500">
                      Required
                    </span>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id={`${role}-gov-code`}
                      type="text"
                      value={governmentCode}
                      onChange={(e) => setGovernmentCode(e.target.value)}
                      placeholder="Enter active Government Access Code"
                      className="h-11 rounded-xl border-amber-500/40 bg-amber-50/40 font-mono text-sm font-bold tracking-wider text-amber-950 focus:border-amber-600 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Access is gated on the active code set by the system administrator.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !email.trim() || !password || !governmentCode.trim()}
                    className="h-12 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md transition hover:bg-[#0f766e]/90"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Authenticating…" : `Sign In as ${role === "rescuer" ? "Rescuer" : "Hospital Staff"}`}
                  </Button>
                </div>
              </form>
            ) : (
              /* SIGN UP / REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <Label htmlFor={`${role}-reg-name`} className="text-xs font-bold">
                    Full Name / Designation
                  </Label>
                  <Input
                    id={`${role}-reg-name`}
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Commander Barua"
                    className="mt-1 h-10 rounded-xl text-sm"
                    autoComplete="name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor={`${role}-reg-email`} className="text-xs font-bold">
                    Official Email Address
                  </Label>
                  <Input
                    id={`${role}-reg-email`}
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="officer@assamrescue.gov.in"
                    className="mt-1 h-10 rounded-xl text-sm"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor={`${role}-reg-password`} className="text-xs font-bold">
                    Set Account Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id={`${role}-reg-password`}
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create a secure password (min. 4 chars)"
                      className="h-10 rounded-xl pr-10 text-sm"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showRegPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowRegPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${role}-reg-gov-code`} className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Government Code <span className="text-destructive">*</span>
                    </Label>
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500">
                      Required
                    </span>
                  </div>
                  <Input
                    id={`${role}-reg-gov-code`}
                    type="text"
                    value={regGovernmentCode}
                    onChange={(e) => setRegGovernmentCode(e.target.value)}
                    placeholder="Enter active Government Access Code"
                    className="mt-1 h-10 rounded-xl border-amber-500/40 bg-amber-50/40 font-mono text-sm font-bold tracking-wider text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200"
                    autoComplete="off"
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Required to authorize your account for operational response access.
                  </p>
                </div>

                <div>
                  <Label htmlFor={`${role}-reg-callsign`} className="text-xs font-bold">
                    {config.callSignLabel} (Optional)
                  </Label>
                  <Input
                    id={`${role}-reg-callsign`}
                    type="text"
                    value={regCallSign}
                    onChange={(e) => setRegCallSign(e.target.value)}
                    placeholder={config.callSignPlaceholder}
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !regName.trim() ||
                      !regEmail.trim() ||
                      !regPassword ||
                      !regGovernmentCode.trim()
                    }
                    className="h-12 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white shadow-md transition hover:bg-[#0f766e]/90"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Registering…" : `Sign Up as ${role === "rescuer" ? "Rescuer" : "Hospital Staff"}`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setLocation("/login")}
            className="text-xs font-bold text-[#0f766e] hover:underline dark:text-emerald-400"
          >
            ← Back to Citizen / All Portals
          </button>
        </div>
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
