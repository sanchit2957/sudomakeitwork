import React from "react";
// Theme support classes: dark:bg-[#28282d] dark:text-[#f4f4f5]
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
      <div className="min-h-screen app-grid flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen app-grid flex items-center justify-center p-6">
        <section className="max-w-md rounded-[2rem] border bg-card p-8 text-center shadow-[0_24px_70px_-35px_rgb(22_86_75/0.45)]">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
            {t("dashboard.secureAccess")}
          </p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
            {t("dashboard.signIn")} {workspace}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your authorized account determines which operational tools you can access.
          </p>
          <Button
            onClick={() => startLogin()}
            className="mt-7 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("dashboard.continue")}
          </Button>
        </section>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar
        collapsible={desktopSidebar === "fixed" ? "none" : "icon"}
        className="border-r border-[#B7AD9E]/30 bg-[#F8F1E4]/90 backdrop-blur-md dark:border-[#D8E3FF]/15 dark:bg-[#111C44]/95"
      >
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-1">
            <div
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left select-none group-data-[collapsible=icon]:justify-center"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2457FF] text-white shadow-md shadow-[#2457FF]/25">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="group-data-[collapsible=icon]:hidden">
                <span className="block text-sm font-extrabold tracking-tight text-[#111C44] dark:text-[#F8F1E4]">
                  {workspace}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457FF] dark:text-[#D8E3FF]">
                  {t("brand.network")}
                </span>
              </span>
            </div>
            <SidebarTrigger
              className={cn(
                "hidden h-9 w-9 shrink-0 md:inline-flex group-data-[collapsible=icon]:hidden text-[#111C44] dark:text-[#F8F1E4]",
                desktopSidebar === "fixed" && "md:hidden"
              )}
            />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <div className="px-3 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#111C44]/60 dark:text-[#D8E3FF]/60 group-data-[collapsible=icon]:hidden">
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
                      "h-11 rounded-xl transition-all font-semibold",
                      active
                        ? "bg-[#2457FF] text-white shadow-md shadow-[#2457FF]/20 font-bold hover:bg-[#1d47db] hover:text-white"
                        : "text-[#111C44]/75 dark:text-[#D8E3FF]/75 hover:bg-[#2457FF]/10 hover:text-[#2457FF] dark:hover:text-[#D8E3FF]"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <div className="glass-card p-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <ProfileAvatar user={user} size="sm" />
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-bold text-[#111C44] dark:text-[#F8F1E4]">{user.name || "Authorized user"}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-[#111C44]/60 dark:text-[#D8E3FF]/60">
                  {roleLabel}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-col gap-1 border-t border-[#B7AD9E]/20 dark:border-[#D8E3FF]/10 pt-2 group-data-[collapsible=icon]:hidden">
              <button
                onClick={() => void logout().then(() => setLocation("/login"))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="relative min-h-screen bg-[#F8F1E4] text-[#111C44] dark:bg-[#111C44] dark:text-[#F8F1E4] transition-colors overflow-x-hidden">
        {/* iOS Liquid Glass Ambient Refraction Layer */}
        <div className="liquid-ambient-bg" />

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#B7AD9E]/30 bg-[#F8F1E4]/85 px-4 backdrop-blur-md dark:border-[#D8E3FF]/15 dark:bg-[#111C44]/85 md:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden text-[#111C44] dark:text-[#F8F1E4]">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
            {/* Unified Reusable Profile Component next to workspace title */}
            <UserProfileBadge
              user={user}
              size="md"
              clickable={user?.role === "user"}
              onClick={user?.role === "user" ? () => setLocation("/profile") : undefined}
            />
            <div className="hidden sm:block h-5 w-px bg-[#B7AD9E]/40 dark:bg-[#D8E3FF]/20" />
            <div className="hidden sm:block">
              <p className="text-xs font-bold tracking-tight text-[#111C44] dark:text-[#F8F1E4]">{workspace}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#2457FF] dark:text-[#D8E3FF]">
                {roleLabel || t("dashboard.liveWorkspace")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSelector compact />
            <div className="hidden items-center gap-2 rounded-full glass-pill bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 sm:flex border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {t("general.live")}
            </div>
            <Button
              onClick={() => void logout().then(() => setLocation("/login"))}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-rose-500/30 px-3 text-xs font-bold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="workspace-surface p-4 md:p-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
