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
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type PortalRole = "rescuer" | "hospital";

const portalConfig = {
  rescuer: {
    title: "Rescuer Portal",
    heading: "Field Rescuer Access",
    description: "Restricted gateway for authorized field rescue personnel, NDRF, and SDRF task forces.",
    prompt: "Enter your rescuer credentials and the active Government Access Code.",
    destination: "/responder",
    icon: Radio,
    callSignPlaceholder: "e.g. NDRF-Boat-01",
    callSignLabel: "Field Call Sign",
    toneColor: "amber",
  },
  hospital: {
    title: "Hospital Portal",
    heading: "Hospital Operations Desk",
    description: "Clinical gateway for authorized hospital operations staff, ICU coordinators, and triage centers.",
    prompt: "Enter your hospital staff credentials and the active Government Access Code.",
    destination: "/hospital",
    icon: Hospital,
    callSignPlaceholder: "e.g. Trauma Triage Desk 1",
    callSignLabel: "Facility / Ward Label",
    toneColor: "teal",
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

  const isRescuer = role === "rescuer";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B0F17]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => setLocation("/login")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-85 focus:outline-none"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-slate-800 font-black">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight leading-tight">Sahay Network</span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Disaster Response Platform
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/login")}
              className="text-xs h-8 rounded-lg border-slate-300 dark:border-slate-700"
            >
              Citizen Portal
            </Button>
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-8 md:py-12 my-auto">
        {/* Title Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <Icon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            {config.title}
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {config.heading}
          </h1>
          <p className="mx-auto mt-2 text-xs leading-relaxed text-muted-foreground max-w-sm">
            {config.description}
          </p>
        </div>

        {/* Mode Switcher */}
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
            Sign Up
          </button>
        </div>

        {/* Form Card */}
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <KeyRound className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  {authMode === "signin" ? `Authorized ${config.title}` : `Register ${config.title} Account`}
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  Gated on active Government Authorization Code.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400"
              >
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

            {authMode === "signin" ? (
              /* SIGN IN FORM */
              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div>
                  <Label htmlFor={`${role}-email`} className="text-xs font-bold">
                    Email or Username
                  </Label>
                  <Input
                    id={`${role}-email`}
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. officer@dispatch.gov.in"
                    className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor={`${role}-password`} className="text-xs font-bold">
                    Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id={`${role}-password`}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="h-10 rounded-lg pr-10 text-sm border-slate-200 dark:border-slate-800"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${role}-gov-code`} className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Government Access Code <span className="text-rose-500">*</span>
                    </Label>
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                      Gated
                    </span>
                  </div>
                  <Input
                    id={`${role}-gov-code`}
                    type="text"
                    value={governmentCode}
                    onChange={(e) => setGovernmentCode(e.target.value)}
                    placeholder="Enter active Government Access Code"
                    className="mt-1 h-10 rounded-lg border-amber-500/40 bg-amber-50/40 font-mono text-sm font-bold tracking-wider text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-muted-foreground">Demo Credentials</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (role === "rescuer") {
                        setEmail("rescuer@assamrescue.gov.in");
                        setPassword("rescuer");
                        setGovernmentCode("RESCUER-2026");
                      } else {
                        setEmail("hospital@assamrescue.gov.in");
                        setPassword("hospital");
                        setGovernmentCode("HOSPITAL-2026");
                      }
                      setErrorMessage("");
                    }}
                    className="font-mono text-[11px] font-bold text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Fill Demo {role === "rescuer" ? "Rescuer" : "Hospital"}
                  </button>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !email.trim() || !password || !governmentCode.trim()}
                    className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Authenticating…" : `Sign In as ${role === "rescuer" ? "Rescuer" : "Hospital Staff"}`}
                  </Button>
                </div>
              </form>
            ) : (
              /* SIGN UP / REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <Label htmlFor={`${role}-reg-name`} className="text-xs font-bold">
                    Full Name / Designation
                  </Label>
                  <Input
                    id={`${role}-reg-name`}
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Duty Commander"
                    className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
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
                    placeholder="officer@dispatch.gov.in"
                    className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
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
                      placeholder="At least 4 characters"
                      className="h-10 rounded-lg pr-10 text-sm border-slate-200 dark:border-slate-800"
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
                      Government Access Code <span className="text-rose-500">*</span>
                    </Label>
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                      Required
                    </span>
                  </div>
                  <Input
                    id={`${role}-reg-gov-code`}
                    type="text"
                    value={regGovernmentCode}
                    onChange={(e) => setRegGovernmentCode(e.target.value)}
                    placeholder="Enter active Government Access Code"
                    className="mt-1 h-10 rounded-lg border-amber-500/40 bg-amber-50/40 font-mono text-sm font-bold tracking-wider text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200"
                    autoComplete="off"
                    required
                  />
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
                    className="mt-1 h-10 rounded-lg text-sm border-slate-200 dark:border-slate-800"
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
                    className="h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
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
            className="text-xs text-muted-foreground hover:text-foreground transition font-medium"
          >
            ← Back to Citizen / All Portals
          </button>
        </div>
      </main>

      <footer className="py-4 text-center text-[10px] font-mono text-muted-foreground border-t border-slate-200/60 dark:border-slate-800">
        Sahay Emergency Network &bull; Authorized Personnel Gateway
      </footer>
    </div>
  );
}

export function RescuerLogin() {
  return <RoleLogin role="rescuer" />;
}

export function HospitalLogin() {
  return (
    <DesktopOnlyGate portalName="Hospital Operations Desk" portalType="hospital">
      <RoleLogin role="hospital" />
    </DesktopOnlyGate>
  );
}

export const MedicalLogin = HospitalLogin;
