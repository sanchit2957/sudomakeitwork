import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { startLogin } from "@/const";
import { Building2, HeartPulse, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import { useLocation } from "wouter";
import React from "react";

export function RoleGate({ roles, children }: { roles: Array<"user" | "rescuer" | "medical" | "admin">; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();

  const portal = roles.includes("rescuer")
    ? { title: t("Rescuer secure access"), copy: t("Use the separately authorized field account assigned by Command."), label: t("Continue to Rescuer sign-in"), icon: Siren, tone: "bg-[#fff0ee] text-[#b44742]" }
    : roles.includes("medical") && !roles.includes("admin")
    ? { title: t("Medical Operations access"), copy: t("Use the medical-staff account authorized for hospital resources and medical requests."), label: t("Continue to Medical sign-in"), icon: HeartPulse, tone: "bg-[#eaf2fb] text-[#255c7d]" }
    : { title: t("Government Command access"), copy: t("Use the separately authorized administrator account for rescue coordination."), label: t("Continue to Command sign-in"), icon: Building2, tone: "bg-[#e7f6ef] text-[#197654]" };

  const PortalIcon = portal.icon;

  if (loading) {
    return (
      <div className="min-h-screen app-grid flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen app-grid p-6">
        <div className="absolute right-4 top-4">
          <LanguageSelector compact />
        </div>
        <section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl">
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${portal.tone}`}>
            <PortalIcon className="h-7 w-7" />
          </span>
          <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
            sudo MakeItWork Operations
          </p>
          <h1 className="mt-2 text-xl font-extrabold">{portal.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{portal.copy}</p>
          <div className="mt-5 rounded-xl bg-[#f4f8f6] p-3 text-left text-xs leading-5 text-[#53746a] dark:bg-[#242426] dark:text-[#d4d4d8]">
            <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
            {t("This workspace opens only after an authorized role completes secure sign-in.")}
          </div>
          <Button onClick={() => setLocation(`/login?redirect=${encodeURIComponent(location)}`)} className="mt-6 w-full">
            {portal.label}
          </Button>
          <button onClick={() => setLocation("/")} className="mt-4 text-xs font-bold text-primary">
            {t("Return to Public Safety Hub")}
          </button>
        </section>
      </div>
    );
  }

  // ADMIN IS SUPERADMIN — Main control with full access to every workspace
  if (user.role === "admin") {
    return <>{children}</>;
  }

  // Direct role match
  if (roles.includes(user.role)) {
    return <>{children}</>;
  }

  // STRICT ROLE ISOLATION: Rescuer vs Medical vs Citizen
  let roleWarningTitle = "Access Restricted";
  let roleWarningDesc = `Your active account is signed in as ${user.role.toUpperCase()}. You do not have permission to access this operational workspace.`;
  let authorizedDestination = "/";
  let authorizedLabel = "Go to Public Portal";

  if (user.role === "rescuer") {
    roleWarningTitle = "Field Rescuer Portal Only";
    roleWarningDesc = "Your account is authorized as a Field Rescuer. Rescuers cannot access Government Command or Hospital Management. Please navigate to your Rescuer dashboard or sign in with an Administrator account.";
    authorizedDestination = "/responder";
    authorizedLabel = "Go to Rescuer Portal";
  } else if (user.role === "medical") {
    roleWarningTitle = "Hospital Staff Portal Only";
    roleWarningDesc = "Your account is authorized as Hospital Medical Staff. Medical staff cannot access Government Command or Field Rescuer operations. Please navigate to your Medical dashboard or sign in with an Administrator account.";
    authorizedDestination = "/medical";
    authorizedLabel = "Go to Hospital Portal";
  } else if (user.role === "user") {
    roleWarningTitle = "Operational Access Restricted";
    roleWarningDesc = "This section is restricted to authorized Government Administrators, Field Responders, or Hospital Staff. Please sign in with an authorized role account.";
    authorizedDestination = "/login";
    authorizedLabel = "Sign in to Authorized Account";
  }

  return (
    <div className="min-h-screen app-grid p-6">
      <div className="absolute right-4 top-4">
        <LanguageSelector compact />
      </div>
      <section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <span className="mt-4 inline-block rounded-full bg-muted px-3 py-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          Current Role: {user.role}
        </span>
        <h1 className="mt-3 text-xl font-extrabold">{roleWarningTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{roleWarningDesc}</p>
        
        <div className="mt-6 flex flex-col gap-2.5">
          <Button onClick={() => setLocation(authorizedDestination)} className="w-full">
            {authorizedLabel}
          </Button>
          <Button variant="outline" onClick={() => setLocation(`/login?redirect=${encodeURIComponent(location)}`)} className="w-full">
            Switch Account / Sign In
          </Button>
          <Button variant="ghost" onClick={logout} className="w-full text-xs text-muted-foreground">
            Sign Out
          </Button>
        </div>
      </section>
    </div>
  );
}
