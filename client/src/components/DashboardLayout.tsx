import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { LogOut, Menu, ShieldCheck, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

export type WorkspaceNavItem = { label: string; path: string; icon: LucideIcon };

type DashboardLayoutProps = {
  children: React.ReactNode;
  navItems: WorkspaceNavItem[];
  workspace: string;
  roleLabel: string;
  desktopSidebar?: "collapsible" | "fixed";
};

export default function DashboardLayout({ children, navItems, workspace, roleLabel, desktopSidebar = "collapsible" }: DashboardLayoutProps) {
  const { loading, user, logout } = useAuth();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();

  if (loading) return <div className="min-h-screen app-grid flex items-center justify-center"><div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen app-grid flex items-center justify-center p-6">
      <section className="max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-[0_24px_70px_-35px_rgb(22_86_75/0.45)]">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="h-7 w-7" /></div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">{t("dashboard.secureAccess")}</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{t("dashboard.signIn")} {workspace}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Your authorized account determines which operational tools you can access.</p>
        <Button onClick={() => startLogin()} className="mt-7 w-full bg-primary text-primary-foreground hover:bg-primary/90">{t("dashboard.continue")}</Button>
      </section>
    </div>
  );

  return (
    <SidebarProvider>
      <Sidebar collapsible={desktopSidebar === "fixed" ? "none" : "icon"} className="border-r border-r-border bg-[#f7fbf9]">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-1">
            <button onClick={() => setLocation("/")} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-secondary/70 group-data-[collapsible=icon]:justify-center">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><span className="font-mono text-sm font-bold">S</span></span>
              <span className="group-data-[collapsible=icon]:hidden"><span className="block text-sm font-extrabold tracking-tight">sudo MakeItWork</span><span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("brand.network")}</span></span>
            </button>
            <SidebarTrigger className={cn("hidden h-9 w-9 shrink-0 md:inline-flex group-data-[collapsible=icon]:hidden", desktopSidebar === "fixed" && "md:hidden")} />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <div className="px-3 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-data-[collapsible=icon]:hidden">{roleLabel}</div>
          <SidebarMenu>
            {navItems.map(item => {
              const active = location === item.path;
              return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={active} onClick={() => setLocation(item.path)} tooltip={item.label} className={cn("h-11 rounded-xl", active && "bg-[#d8f1e8] text-[#155c50]")}><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <div className="rounded-2xl bg-[#e9f2ee] p-2 group-data-[collapsible=icon]:bg-[#e9f2ee]">
            <div className="flex items-center gap-2.5"><Avatar className="h-9 w-9 border border-border"><AvatarFallback className="bg-white text-xs font-bold text-primary">{user.name?.slice(0, 1).toUpperCase() || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-bold">{user.name || "Authorized user"}</p><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{roleLabel}</p></div></div>
            <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white hover:text-destructive group-data-[collapsible=icon]:hidden"><LogOut className="h-3.5 w-3.5" /> {t("dashboard.signOut")}</button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3"><SidebarTrigger className="md:hidden"><Menu className="h-4 w-4" /></SidebarTrigger><div><p className="text-sm font-extrabold tracking-tight">{workspace}</p><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Live operations workspace</p></div></div>
          <div className="flex items-center gap-2"><LanguageSelector compact /><div className="flex items-center gap-2 rounded-full bg-[#d9f1e7] px-3 py-1.5 text-xs font-bold text-[#176154]"><span className="h-2 w-2 rounded-full bg-[#1c9b75]" /> {t("general.live")}</div></div>
        </header>
        <main className="p-4 md:p-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
