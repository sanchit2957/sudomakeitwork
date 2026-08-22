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
  const [, setLocation] = useLocation();
  const portal = roles.includes("rescuer") ? { title: t("Rescuer secure access"), copy: t("Use the separately authorized field account assigned by Command."), label: t("Continue to Rescuer sign-in"), icon: Siren, tone: "bg-[#fff0ee] text-[#b44742]" } : roles.includes("medical") && !roles.includes("admin") ? { title: t("Medical Operations access"), copy: t("Use the medical-staff account authorized for hospital resources and medical requests."), label: t("Continue to Medical sign-in"), icon: HeartPulse, tone: "bg-[#eaf2fb] text-[#255c7d]" } : { title: t("Government Command access"), copy: t("Use the separately authorized administrator account for rescue coordination."), label: t("Continue to Command sign-in"), icon: Building2, tone: "bg-[#e7f6ef] text-[#197654]" };
  const PortalIcon = portal.icon;
  if (loading) return <div className="min-h-screen app-grid flex items-center justify-center"><div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${portal.tone}`}><PortalIcon className="h-7 w-7" /></span><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">sudo MakeItWork Operations</p><h1 className="mt-2 text-xl font-extrabold">{portal.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{portal.copy}</p><div className="mt-5 rounded-xl bg-[#f4f8f6] p-3 text-left text-xs leading-5 text-[#53746a] dark:bg-[#242426] dark:text-[#d4d4d8]"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />{t("This workspace opens only after the authorized account completes secure sign-in.")}</div><Button onClick={() => startLogin()} className="mt-6 w-full">{portal.label}</Button><button onClick={() => setLocation("/")} className="mt-4 text-xs font-bold text-primary">{t("Return to Victim App")}</button></section></div>;
  if (!roles.includes(user.role)) {
    const requestedRole = roles.includes("admin") && roles.includes("medical") ? t("an authorized medical staff member or administrator") : roles.includes("admin") ? t("an administrator") : roles.includes("medical") ? t("an authorized medical staff member") : roles.includes("rescuer") ? t("an authorized rescuer") : t("a victim account");
    const nextStep = roles.includes("medical") && roles.includes("admin")
      ? t("Hospital and medical resource workspaces require separately authorized medical staff or administrator access.")
      : user.role === "admin" && roles.includes("rescuer")
      ? t("Field responder workspaces require a separate account that an administrator has authorized from the Team roster.")
      : user.role === "rescuer" && roles.includes("admin")
        ? t("Administrator command workspaces require a separately authorized administrator account.")
        : user.role === "medical" && roles.includes("rescuer")
          ? t("Field responder workspaces require a separately authorized rescuer account.")
        : t("Ask an administrator to authorize the appropriate account before returning to this workspace.");
    return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><h1 className="mt-4 text-xl font-extrabold">{t("Use {role} account", { role: requestedRole })}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("This signed-in account is registered as {role}.", { role: t(user.role) })} {nextStep}</p>{roles.includes("medical") && user.role === "user" && <Button onClick={() => setLocation("/hospital/register")} className="mt-6 w-full">Register a hospital</Button>}<Button onClick={logout} className={`${roles.includes("medical") && user.role === "user" ? "mt-3" : "mt-6"} w-full`} variant={roles.includes("medical") && user.role === "user" ? "outline" : "default"}>{t("dashboard.signOut")}</Button><Button onClick={() => setLocation("/")} variant="outline" className="mt-3 w-full">{t("general.safetyHub")}</Button></section></div>;
  }
  return <>{children}</>;
}
