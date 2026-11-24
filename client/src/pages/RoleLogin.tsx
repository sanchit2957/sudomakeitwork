import { useAuth } from "@/_core/hooks/useAuth";
import { formatAuthError } from "./user/UserLogin";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Hospital,
  KeyRound,
  LifeBuoy,
  Lock,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Truck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type PortalRole = "rescuer" | "hospital";

const portalConfig = {
  rescuer: {
    title: "Rescuer Portal",
    badge: "Tactical Field Operations • NDRF / SDRF Gateway",
    heading: "Field Rescuer Access",
    description: "Restricted gateway for authorized field rescue personnel, NDRF, SDRF task forces, and quick response units.",
    prompt: "Enter your official credentials and active Government Authorization Code to establish secure dispatch link.",
    destination: "/responder",
    icon: Radio,
    callSignPlaceholder: "e.g. NDRF-Battalion-01",
    callSignLabel: "Field Call Sign",
    tone: "amber",
    tagline: "Assam Tactical Rescue & Incident Dispatch Network",
    telemetry: [
      { label: "Active Battalions", value: "32 Units", note: "Guwahati, Silchar & Dibrugarh", icon: LifeBuoy },
      { label: "GPS Dispatch Mesh", value: "Sub-Second", note: "Encrypted field frequencies", icon: Radio },
      { label: "Evacuation Boats", value: "114 Deployed", note: "Inundation zones surveyed", icon: Truck },
      { label: "Emergency Mesh", value: "Active", note: "Direct link to State SEOC", icon: Zap },
    ],
  },
  hospital: {
    title: "Hospital Portal",
    badge: "Clinical Emergency Operations • Critical Care & Resource Desk",
    heading: "Hospital Operations Desk",
    description: "Clinical gateway for authorized hospital operations staff, ICU triage teams, and trauma coordinators.",
    prompt: "Enter your hospital staff credentials and active Government Authorization Code to sync clinical telemetry.",
    destination: "/hospital",
    icon: Hospital,
    callSignPlaceholder: "e.g. GMCH Trauma Triage Desk 1",
    callSignLabel: "Facility / Ward Label",
    tone: "teal",
    tagline: "Assam Clinical Emergency Care & Bed Management Grid",
    telemetry: [
      { label: "Connected Facilities", value: "28 Hospitals", note: "Medical colleges & civil centers", icon: Building2 },
      { label: "ICU & Ventilators", value: "342 Beds", note: "Live occupancy allocation", icon: Activity },
      { label: "Trauma Teams", value: "On Standby", note: "Emergency surgical staff", icon: Stethoscope },
      { label: "Blood Reserves", value: "O+ / B+ Surplus", note: "District blood bank synced", icon: ShieldCheck },
    ],
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
    <div className="min-h-screen bg-slate-50/70 text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B0F17]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={() => setLocation("/login")}
            className="flex items-center gap-3 text-left transition hover:opacity-90 focus:outline-none"
            aria-label="Back to main portals"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-slate-800 font-black">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight leading-tight text-slate-950 dark:text-white">
                Sahay Emergency Network
              </span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {isRescuer ? "Tactical Disaster Response" : "Clinical Emergency Desk"}
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/login")}
              className="text-xs h-8 rounded-lg border-slate-300 dark:border-slate-700 font-semibold"
            >
              Citizen Portal
            </Button>
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      {/* Main Dual-Column Content */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-6 pb-10 sm:py-10 my-auto flex-1 flex items-center">
        <div className="grid w-full gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Form Card (lg:col-span-6 xl:col-span-5) */}
          <div className="mx-auto w-full max-w-md lg:col-span-6 xl:col-span-5">
            {/* Title & Badge */}
            <div className="text-left mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <Icon className={`h-3.5 w-3.5 ${isRescuer ? "text-amber-500" : "text-teal-500"}`} />
                {config.title}
              </div>
              <h1 className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {config.heading}
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {config.description}
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800/80 text-xs font-bold mb-4">
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

            {/* Form Container */}
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="border-b border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${isRescuer ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-teal-500/10 text-teal-600 dark:text-teal-400"}`}>
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
                        <Label htmlFor={`${role}-gov-code`} className={`text-xs font-bold ${isRescuer ? "text-amber-800 dark:text-amber-400" : "text-teal-800 dark:text-teal-400"}`}>
                          Government Access Code <span className="text-rose-500">*</span>
                        </Label>
                        <span className={`font-mono text-[10px] uppercase font-bold ${isRescuer ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}`}>
                          Gated
                        </span>
                      </div>
                      <Input
                        id={`${role}-gov-code`}
                        type="text"
                        value={governmentCode}
                        onChange={(e) => setGovernmentCode(e.target.value)}
                        placeholder="Enter active Government Access Code"
                        className={`mt-1 h-10 rounded-lg font-mono text-sm font-bold tracking-wider ${
                          isRescuer
                            ? "border-amber-500/40 bg-amber-50/40 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200"
                            : "border-teal-500/40 bg-teal-50/40 text-teal-950 dark:border-teal-500/30 dark:bg-teal-950/20 dark:text-teal-200"
                        }`}
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
                        className={`font-mono text-[11px] font-bold hover:underline ${isRescuer ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}`}
                      >
                        Fill Demo {role === "rescuer" ? "Rescuer" : "Hospital"}
                      </button>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting || !email.trim() || !password || !governmentCode.trim()}
                        className={`h-11 w-full rounded-xl text-xs font-bold text-white shadow-xs ${
                          isRescuer
                            ? "bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                            : "bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        }`}
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
                        <Label htmlFor={`${role}-reg-gov-code`} className={`text-xs font-bold ${isRescuer ? "text-amber-800 dark:text-amber-400" : "text-teal-800 dark:text-teal-400"}`}>
                          Government Access Code <span className="text-rose-500">*</span>
                        </Label>
                        <span className={`font-mono text-[10px] uppercase font-bold ${isRescuer ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}`}>
                          Required
                        </span>
                      </div>
                      <Input
                        id={`${role}-reg-gov-code`}
                        type="text"
                        value={regGovernmentCode}
                        onChange={(e) => setRegGovernmentCode(e.target.value)}
                        placeholder="Enter active Government Access Code"
                        className={`mt-1 h-10 rounded-lg font-mono text-sm font-bold tracking-wider ${
                          isRescuer
                            ? "border-amber-500/40 bg-amber-50/40 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200"
                            : "border-teal-500/40 bg-teal-50/40 text-teal-950 dark:border-teal-500/30 dark:bg-teal-950/20 dark:text-teal-200"
                        }`}
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
                        className={`h-11 w-full rounded-xl text-xs font-bold text-white shadow-xs ${
                          isRescuer
                            ? "bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                            : "bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        }`}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Registering…" : `Sign Up as ${role === "rescuer" ? "Rescuer" : "Hospital Staff"}`}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={() => setLocation("/login")}
                className="text-xs text-muted-foreground hover:text-foreground transition font-medium"
              >
                ← Back to Citizen / All Portals
              </button>
            </div>
          </div>

          {/* Right Column: Institutional Operational Telemetry Canvas (Desktop >=lg) */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center pl-4 xl:pl-8">
            <div className="rounded-3xl border border-slate-200/90 bg-white/70 p-8 shadow-sm backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/60">
              {/* Badge & Title */}
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${isRescuer ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-teal-500/10 text-teal-600 dark:text-teal-400"}`}>
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className={`font-mono text-xs font-bold uppercase tracking-wider ${isRescuer ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}`}>
                  {config.badge}
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {config.tagline}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {config.prompt}
              </p>

              {/* Telemetry Grid */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                {config.telemetry.map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={idx} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className={`flex items-center gap-2 ${isRescuer ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}`}>
                        <ItemIcon className="h-4 w-4" />
                        <span className="font-mono text-[10px] font-bold uppercase">{item.label}</span>
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{item.value}</div>
                      <p className="text-[10px] text-muted-foreground">{item.note}</p>
                    </div>
                  );
                })}
              </div>

              {/* Security Protocol Warning */}
              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 text-[11px] text-muted-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold text-foreground">Official Security Protocol:</span> Unauthorized access or credential sharing on emergency response channels is monitored and strictly prohibited under the Disaster Management Act, 2005.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="py-4 text-center text-[10px] font-mono text-muted-foreground border-t border-slate-200/60 dark:border-slate-800">
        Sahay Emergency Network &bull; Authorized Personnel Gateway &bull; Government of Assam
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
