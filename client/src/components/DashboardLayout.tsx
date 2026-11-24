import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ProfileAvatar, UserProfileBadge } from "@/components/ProfileAvatar";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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

export default function DashboardLayout({
  children,
  navItems,
  workspace,
  roleLabel,
  desktopSidebar = "collapsible",
}: DashboardLayoutProps) {
  const { loading, user, logout } = useAuth();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <section className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-sky-400">
            {t("dashboard.secureAccess")}
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-100">
            {t("dashboard.signIn")} {workspace}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Your authorized account determines which operational tools and coordinates you can access.
          </p>
          <Button
            onClick={() => startLogin()}
            className="mt-6 w-full bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 shadow-md"
          >
            {t("dashboard.continue")}
          </Button>
        </section>
      </div>
    );
  }

  const isAdminWorkspace = location.startsWith("/command");
  const isHospitalWorkspace = location.startsWith("/hospital") || location.startsWith("/medical");

  return (
    <SidebarProvider className="dark:bg-[#28282d] dark:text-[#f4f4f5]">
      <Sidebar
        collapsible={desktopSidebar === "fixed" ? "none" : "icon"}
        className={cn(
          "border-r transition-colors",
          isAdminWorkspace
            ? "border-slate-800 bg-[#0B0F17] text-slate-200"
            : isHospitalWorkspace
            ? "border-slate-200 bg-slate-50/90 text-slate-800 dark:border-slate-800 dark:bg-slate-900"
            : "border-slate-800 bg-slate-950 text-slate-200"
        )}
      >
        <SidebarHeader className="p-4 border-b border-inherit">
          <div className="flex items-center gap-1">
            <div
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left select-none group-data-[collapsible=icon]:justify-center"
            >
              <span className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-xs",
                isAdminWorkspace
                  ? "bg-sky-500 text-slate-950 font-black shadow-sky-500/20"
                  : isHospitalWorkspace
                  ? "bg-teal-600 text-white font-black shadow-teal-600/20"
                  : "bg-blue-600 text-white font-black shadow-blue-600/20"
              )}>
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="group-data-[collapsible=icon]:hidden">
                <span className="block text-sm font-bold tracking-tight">
                  {workspace}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sahay Network
                </span>
              </span>
            </div>
            <SidebarTrigger
              className={cn(
                "hidden h-8 w-8 shrink-0 md:inline-flex group-data-[collapsible=icon]:hidden text-muted-foreground hover:text-foreground",
                desktopSidebar === "fixed" && "md:hidden"
              )}
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          <div className="px-3 pb-2 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
            {roleLabel}
          </div>
          <SidebarMenu>
            {navItems.map((item) => {
              const active = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={active}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={cn(
                      "h-10 rounded-lg transition-colors font-medium text-xs",
                      active
                        ? isAdminWorkspace
                          ? "bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 hover:bg-sky-500/20"
                          : isHospitalWorkspace
                          ? "bg-teal-600/10 text-teal-700 dark:text-teal-400 font-bold border border-teal-600/20 hover:bg-teal-600/15"
                          : "bg-blue-600 text-white font-bold hover:bg-blue-500"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-inherit">
          <div className="rounded-2xl bg-[#e9f2ee] p-2 group-data-[collapsible=icon]:bg-[#e9f2ee] dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ProfileAvatar user={user} size="sm" />
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{user.name || "Authorized user"}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  {roleLabel}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1 border-t border-slate-300/60 dark:border-slate-800 pt-1.5 group-data-[collapsible=icon]:hidden">
              <button
                type="button"
                onClick={() => void logout().then(() => setLocation("/login"))}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className={cn(
        "relative min-h-screen transition-colors overflow-x-hidden",
        isAdminWorkspace
          ? "bg-[#0A0E17] text-slate-100"
          : isHospitalWorkspace
          ? "bg-slate-50 text-slate-900 dark:bg-[#0A0E17] dark:text-slate-100"
          : "bg-slate-950 text-slate-100"
      )}>
        <header className={cn(
          "sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md md:px-6",
          isAdminWorkspace
            ? "border-slate-800 bg-[#0B0F17]/90 text-slate-100"
            : isHospitalWorkspace
            ? "border-slate-200 bg-white/90 text-slate-900 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100"
            : "border-slate-800 bg-slate-950/90 text-slate-100"
        )}>
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden text-foreground" />
            <UserProfileBadge
              user={user}
              size="md"
              clickable={user?.role === "user"}
              onClick={user?.role === "user" ? () => setLocation("/profile") : undefined}
            />
            <div className="hidden sm:block h-4 w-px bg-border" />
            <div className="hidden sm:block">
              <p className="text-xs font-bold tracking-tight">{workspace}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {roleLabel || t("dashboard.liveWorkspace")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSelector compact />
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t("general.live")}</span>
            </div>
            <Button
              onClick={() => void logout().then(() => setLocation("/login"))}
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-rose-500/30 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <LogOut className="mr-1 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
