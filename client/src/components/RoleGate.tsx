import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

export function RoleGate({ roles, children }: { roles: Array<"user" | "rescuer" | "admin">; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  if (loading) return <div className="min-h-screen app-grid flex items-center justify-center"><div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) return <div className="min-h-screen app-grid flex items-center justify-center p-6"><section className="max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-primary" /><h1 className="mt-4 text-xl font-extrabold">Secure workspace</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with an authorized account to access this operational view.</p><Button onClick={() => startLogin()} className="mt-6 w-full">Sign in</Button></section></div>;
  if (!roles.includes(user.role)) {
    const requestedRole = roles.includes("admin") ? "an administrator" : roles.includes("rescuer") ? "an authorized rescuer" : "a victim account";
    const nextStep = user.role === "admin" && roles.includes("rescuer")
      ? "Field responder workspaces require a separate account that an administrator has authorized from the Team roster."
      : user.role === "rescuer" && roles.includes("admin")
        ? "Administrator command workspaces require a separately authorized administrator account."
        : "Ask an administrator to authorize the appropriate account before returning to this workspace.";
    return <div className="min-h-screen app-grid flex items-center justify-center p-6"><section className="max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><h1 className="mt-4 text-xl font-extrabold">Use {requestedRole} account</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">This signed-in account is registered as <strong>{user.role}</strong>. {nextStep}</p><Button onClick={logout} className="mt-6 w-full">Sign out and switch account</Button><Button onClick={() => setLocation("/")} variant="outline" className="mt-3 w-full">Return to safety hub</Button></section></div>;
  }
  return <>{children}</>;
}
