import { useAuth } from "@/_core/hooks/useAuth";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  Lock,
  LogOut,
  ShieldCheck,
  User,
  ShieldAlert
} from "lucide-react";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { user, loginAsRole, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const redirectParam = searchParams.get("redirect") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCustomSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      // Cast loginAsRole to any because we changed the TRPC input signature on the server, 
      // but haven't updated the React Query wrapper types yet in useAuth.
      const res = await (loginAsRole as any)({
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
      setErrorMessage(err?.message || "Login failed. Please check your credentials.");
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
    <div className="min-h-screen bg-[#f4f7f6] text-[#122824] dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 px-5 py-3.5 backdrop-blur-md dark:border-white/10 dark:bg-[#111214]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
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
            <LanguageSelector compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8 md:py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3.5 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#0f766e] dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure Access
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">
            Sign In
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter your credentials to access the emergency network.
          </p>
        </div>

        {/* Active Session Card if logged in */}
        {user ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-[#0f766e]/30 bg-white p-6 shadow-md dark:border-emerald-500/20 dark:bg-[#151718]">
            <div className="flex flex-col gap-4 items-center text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#0f766e] text-white">
                <User className="h-8 w-8" />
              </span>
              <div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-extrabold text-lg">{user.name || user.email}</span>
                  <span className="rounded-md bg-[#0f766e]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0f766e] dark:text-emerald-400">
                    {user.role}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{user.email || "Active Session"}</p>
              </div>

              <div className="mt-4 flex w-full flex-col gap-3">
                <Button
                  onClick={() => setLocation(getDashboardDestinationForRole(user.role))}
                  className="w-full rounded-xl bg-[#0f766e] font-bold hover:bg-[#0f766e]/90 text-white"
                >
                  Enter Workspace
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  className="w-full rounded-xl font-semibold"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141517]">
            {errorMessage && (
              <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
                <ShieldAlert className="mr-2 inline h-4 w-4" />
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <Label className="text-sm font-bold">Email or Username</Label>
                <Input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin"
                  className="mt-1.5 h-11 rounded-xl"
                  required
                />
              </div>

              <div>
                <Label className="text-sm font-bold">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 h-11 rounded-xl"
                  required
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl font-bold shadow-md bg-[#0f766e] hover:bg-[#0f766e]/90 text-white"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Authenticating…" : "Sign in"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
