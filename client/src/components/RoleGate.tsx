import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { startLogin } from "@/const";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

export function RoleGate({ roles, children }: { roles: Array<"user" | "rescuer" | "admin">; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  if (loading) return <div className="min-h-screen app-grid flex items-center justify-center"><div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-primary" /><h1 className="mt-4 text-xl font-extrabold">{t("dashboard.secureAccess")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Sign in with an authorized account to access this operational view.")}</p><Button onClick={() => startLogin()} className="mt-6 w-full">{t("dashboard.continue")}</Button></section></div>;
  if (!roles.includes(user.role)) {
    const requestedRole = roles.includes("admin") ? t("an administrator") : roles.includes("rescuer") ? t("an authorized rescuer") : t("a victim account");
    const nextStep = user.role === "admin" && roles.includes("rescuer")
      ? t("Field responder workspaces require a separate account that an administrator has authorized from the Team roster.")
      : user.role === "rescuer" && roles.includes("admin")
        ? t("Administrator command workspaces require a separately authorized administrator account.")
        : t("Ask an administrator to authorize the appropriate account before returning to this workspace.");
    return <div className="min-h-screen app-grid p-6"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="m-auto max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><h1 className="mt-4 text-xl font-extrabold">{t("Use {role} account", { role: requestedRole })}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("This signed-in account is registered as {role}.", { role: t(user.role) })} {nextStep}</p><Button onClick={logout} className="mt-6 w-full">{t("dashboard.signOut")}</Button><Button onClick={() => setLocation("/")} variant="outline" className="mt-3 w-full">{t("general.safetyHub")}</Button></section></div>;
  }
  return <>{children}</>;
}
