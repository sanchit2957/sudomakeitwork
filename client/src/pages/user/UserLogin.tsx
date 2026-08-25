import { useAuth } from "@/_core/hooks/useAuth";
import { getApiUrl } from "@/lib/apiConfig";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Lock,
  LogOut,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
  LifeBuoy,
} from "lucide-react";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type UserRoleOption = "user" | "rescuer" | "medical";

export default function UserLogin() {
  const { user, login, register, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const redirectParam = searchParams.get("redirect") || "";

  // Top level auth mode: "signin" or "register"
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");

  // Sign In fields
  const [email, setEmail] = useState("citizen@assamrescue.gov.in");
  const [password, setPassword] = useState("citizen");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<UserRoleOption>("user");
  const [regPhone, setRegPhone] = useState("");
  const [regUnit, setRegUnit] = useState("");
  const [regSkills, setRegSkills] = useState("");
  const [regHospitalName, setRegHospitalName] = useState("");
  const [regHospitalAddress, setRegHospitalAddress] = useState("");
  const [regDesignation, setRegDesignation] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);

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
      let defaultDestination = "/";
      if (role === "admin") defaultDestination = "/command";
      else if (role === "rescuer") defaultDestination = "/responder";
      else if (role === "medical") defaultDestination = "/medical";

      const dest = redirectParam || defaultDestination;
      setLocation(dest);
    } catch (err: any) {
      setErrorMessage(err?.message || "Authentication failed. Please check your credentials.");
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
          role: regRole,
          phone: regPhone.trim() || undefined,
          callSign: regUnit.trim() || undefined,
        });
      } else {
        await login({
          email: regEmail.trim(),
          password: regPassword.trim(),
        });
      }

      if (regRole === "rescuer") {
        const combinedNote = [
          regUnit ? `Unit: ${regUnit}` : "",
          regSkills ? `Skills: ${regSkills}` : "",
        ].filter(Boolean).join(" | ");

        await fetch(getApiUrl("/api/trpc/rescue.rescuer.requestRegistration"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: regPhone.trim() || undefined,
            note: combinedNote || undefined,
          }),
        }).catch(() => null);

        setRegistrationSubmitted(true);
        setSuccessMessage("Account created! Your Rescuer application has been forwarded to State Operations Command for review.");
      } else if (regRole === "medical") {
        await fetch(getApiUrl("/api/trpc/rescue.hospital.requestRegistration"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hospitalName: regHospitalName.trim() || `${regName.trim()}'s Facility`,
            address: regHospitalAddress.trim() || "Assam District Facility",
            contactPhone: regPhone.trim() || "+91 94350 00000",
            latitude: 26.1445,
            longitude: 91.7362,
            note: regDesignation ? `Designation: ${regDesignation}` : undefined,
          }),
        }).catch(() => null);

        setRegistrationSubmitted(true);
        setSuccessMessage("Account created! Your Hospital facility registration has been forwarded to Command for verification.");
      } else {
        setLocation("/");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Registration failed. Please try again.");
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
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 text-left transition hover:opacity-80"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight">
                sudo <span className="text-[#da3e42]">MakeItWork</span>
              </span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#5d7c74] dark:text-[#94a3b8]">
                Assam Emergency Network
              </span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/admin/login")}
              className="flex items-center gap-1.5 rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1.5 text-xs font-bold text-[#0f766e] hover:bg-[#0f766e]/20 dark:text-emerald-400"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin Portal
            </button>
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 md:py-12">
        {/* Title & Introduction */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            User & Field Access Gate
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
            {authMode === "signin" ? "Sign In" : "Create Account"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {authMode === "signin"
              ? "Sign in to access your citizen dashboard, field rescuer mission board, or hospital medical updates."
              : "Register a new citizen account or submit an application for Field Rescuer (NDRF/SDRF) or Hospital Staff access."}
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="mt-8 grid grid-cols-2 rounded-2xl bg-black/5 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => {
              setAuthMode("signin");
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className={`rounded-xl py-2.5 text-xs font-black transition ${
              authMode === "signin"
                ? "bg-white text-foreground shadow-sm dark:bg-[#1a1c20]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Access Existing Account
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("register");
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className={`rounded-xl py-2.5 text-xs font-black transition ${
              authMode === "register"
                ? "bg-white text-foreground shadow-sm dark:bg-[#1a1c20]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="mr-1.5 inline h-3.5 w-3.5" />
            Register / New Account
          </button>
        </div>

        {/* Active Session Card if already logged in */}
        {user && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-[#0f766e]/30 bg-white p-5 shadow-sm dark:border-emerald-500/20 dark:bg-[#151718]">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0f766e] text-white shadow-md">
                <User className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="text-base font-black">{user.name || user.email}</span>
                  <span className="rounded-md bg-[#0f766e]/15 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase text-[#0f766e] dark:text-emerald-400">
                    Role: {user.role}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{user.email || "Active Session"}</p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  onClick={() => setLocation(getDashboardDestinationForRole(user.role))}
                  className="rounded-xl bg-[#0f766e] font-bold text-white hover:bg-[#0f766e]/90"
                >
                  Enter {user.role.toUpperCase()} Workspace
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  className="rounded-xl font-semibold"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Auth Container */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#141517]">
          <div className="p-6">
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>{successMessage}</div>
              </div>
            )}

            {authMode === "signin" ? (
              /* SIGN IN FORM */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-xs font-bold">Email or Username</Label>
                  <Input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@assamrescue.gov.in"
                    className="mt-1.5 h-11 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-xs font-bold">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 h-11 rounded-xl"
                    required
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Authenticating…" : "Sign in"}
                  </Button>
                </div>
              </form>
            ) : registrationSubmitted ? (
              /* REGISTRATION SUCCESS / PENDING APPROVAL NOTICE */
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-[#19755f]" />
                <h3 className="mt-3 text-lg font-black">Registration Successfully Submitted!</h3>
                <p className="mx-auto mt-2 text-xs leading-relaxed text-muted-foreground">
                  Your account has been created. If you registered for <strong>Rescue Operations</strong> or <strong>Hospital Facility Staff</strong>, your application is currently queued for State Admin review.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => setLocation("/")}
                    className="flex-1 rounded-xl bg-[#0f766e] text-white"
                  >
                    Go to Home & SOS Hub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRegistrationSubmitted(false);
                      setAuthMode("signin");
                    }}
                    className="rounded-xl"
                  >
                    Return to Sign In
                  </Button>
                </div>
              </div>
            ) : (
              /* REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="reg-name" className="text-xs font-bold">Full Name</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Sanchit Sharma"
                    className="mt-1 h-10 rounded-xl"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="reg-email" className="text-xs font-bold">Email Address</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="mt-1 h-10 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-password" className="text-xs font-bold">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1 h-10 rounded-xl"
                      required
                    />
                  </div>
                </div>

                {/* Role selection for registration */}
                <div className="pt-2">
                  <Label className="text-xs font-bold">Select Account / Operational Type</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole("user")}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                        regRole === "user"
                          ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0f766e] ring-2 ring-[#0f766e]/30 dark:text-emerald-400"
                          : "border-black/5 bg-black/5 text-muted-foreground hover:text-foreground dark:border-white/5 dark:bg-white/5"
                      }`}
                    >
                      <User className="h-5 w-5" />
                      <span className="text-[11px] font-extrabold">1. Citizen</span>
                      <span className="text-[9px] text-muted-foreground">Instant Access</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegRole("rescuer")}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                        regRole === "rescuer"
                          ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0f766e] ring-2 ring-[#0f766e]/30 dark:text-emerald-400"
                          : "border-black/5 bg-black/5 text-muted-foreground hover:text-foreground dark:border-white/5 dark:bg-white/5"
                      }`}
                    >
                      <Radio className="h-5 w-5" />
                      <span className="text-[11px] font-extrabold">2. Rescuer</span>
                      <span className="text-[9px] text-amber-600 dark:text-amber-400">Needs Approval</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegRole("medical")}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                        regRole === "medical"
                          ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0f766e] ring-2 ring-[#0f766e]/30 dark:text-emerald-400"
                          : "border-black/5 bg-black/5 text-muted-foreground hover:text-foreground dark:border-white/5 dark:bg-white/5"
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                      <span className="text-[11px] font-extrabold">3. Hospital</span>
                      <span className="text-[9px] text-blue-600 dark:text-blue-400">Needs Approval</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic fields based on role */}
                {regRole === "rescuer" && (
                  <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
                    <p className="font-bold text-amber-800 dark:text-amber-300">
                      ⚠️ Rescuer details will be sent to the State Command Centre for Call Sign assignment:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="reg-phone" className="text-xs font-bold">Phone Number</Label>
                        <Input
                          id="reg-phone"
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+91 94350 XXXXX"
                          className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-unit" className="text-xs font-bold">Unit / District</Label>
                        <Input
                          id="reg-unit"
                          type="text"
                          value={regUnit}
                          onChange={(e) => setRegUnit(e.target.value)}
                          placeholder="e.g. NDRF 1st Bn / Kamrup"
                          className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="reg-skills" className="text-xs font-bold">Certifications & Skills</Label>
                      <Input
                        id="reg-skills"
                        type="text"
                        value={regSkills}
                        onChange={(e) => setRegSkills(e.target.value)}
                        placeholder="e.g. Motor boat operator, scuba diver, medical first responder"
                        className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                      />
                    </div>
                  </div>
                )}

                {regRole === "medical" && (
                  <div className="space-y-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs">
                    <p className="font-bold text-blue-800 dark:text-blue-300">
                      ⚠️ Facility details will be sent to State Medical Command for verification:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="reg-hosp-name" className="text-xs font-bold">Hospital Name</Label>
                        <Input
                          id="reg-hosp-name"
                          type="text"
                          value={regHospitalName}
                          onChange={(e) => setRegHospitalName(e.target.value)}
                          placeholder="e.g. Silchar Civil Hospital"
                          className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-hosp-addr" className="text-xs font-bold">District / Address</Label>
                        <Input
                          id="reg-hosp-addr"
                          type="text"
                          value={regHospitalAddress}
                          onChange={(e) => setRegHospitalAddress(e.target.value)}
                          placeholder="e.g. Cachar District, Assam"
                          className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="reg-hosp-phone" className="text-xs font-bold">Emergency Phone</Label>
                        <Input
                          id="reg-hosp-phone"
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+91 3842 XXXXXX"
                          className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-desig" className="text-xs font-bold">Your Designation</Label>
                        <Input
                          id="reg-desig"
                          type="text"
                          value={regDesignation}
                          onChange={(e) => setRegDesignation(e.target.value)}
                          placeholder="e.g. Duty Officer / Superintendent"
                          className="mt-1 h-9 rounded-xl bg-white dark:bg-[#1a1c20]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl bg-[#0f766e] font-bold text-white shadow-md hover:bg-[#0f766e]/90"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating Account…" : "Register New Account"}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Quick Prefill Bar for Local Testing */}
          {authMode === "signin" && (
            <div className="border-t border-black/5 bg-[#f8faf9] p-4 text-center dark:border-white/5 dark:bg-[#16181b]">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                ⚡ Instant Quick-Fill Test Accounts
              </p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("citizen@assamrescue.gov.in");
                    setPassword("citizen");
                  }}
                  className="rounded-lg border border-black/5 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:border-white/5 dark:bg-[#1e2024]"
                >
                  👤 Citizen (`citizen` / `citizen`)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("rescuer@assamrescue.gov.in");
                    setPassword("rescuer");
                  }}
                  className="rounded-lg border border-black/5 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:border-white/5 dark:bg-[#1e2024]"
                >
                  🚤 Rescuer (`rescuer` / `rescuer`)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("medical@assamrescue.gov.in");
                    setPassword("medical");
                  }}
                  className="rounded-lg border border-black/5 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:border-white/5 dark:bg-[#1e2024]"
                >
                  🏥 Medical (`medical` / `medical`)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Link to Admin Portal */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setLocation("/admin/login")}
            className="text-xs font-bold text-[#0f766e] hover:underline dark:text-emerald-400"
          >
            🛡️ Are you a State Disaster Management Administrator? Go to Admin Portal →
          </button>
        </div>
      </main>
    </div>
  );
}
