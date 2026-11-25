import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ProfileAvatar, UserProfileBadge } from "@/components/ProfileAvatar";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { startLogin } from "@/const";
import { getPortalForPath, getPortalLoginPath } from "@/lib/portalAuth";
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
}: DashboardLayoutProps) {
  const { loading, user, logout } = useAuth();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const portalLoginPath = getPortalLoginPath(
    getPortalForPath(location || (typeof window !== "undefined" ? window.location.pathname : "/"))
  );

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

  const renderNavContent = (isMobileView = false) => (
    <div className="flex h-full w-full flex-col justify-between">
      <div>
        {/* Workspace Brand Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[#E2E8F0]/30 dark:border-[#F1F5F9]/15">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1D4ED8] text-white shadow-md shadow-[#1D4ED8]/25">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {workspace}
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#1D4ED8] dark:text-[#F1F5F9]">
              {t("brand.network")}
            </span>
          </div>
        </div>

        {/* Role Sub-label */}
        <div className="px-5 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0F172A]/60 dark:text-[#F1F5F9]/60">
          {roleLabel}
        </div>

        {/* Navigation Menu Items */}
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const active = location === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  setLocation(item.path);
                  if (isMobileView) setMobileOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all text-left",
                  active
                    ? "bg-[#1D4ED8] text-white shadow-md shadow-[#1D4ED8]/20 font-bold hover:bg-[#1d47db]"
                    : "text-[#0F172A]/80 dark:text-[#F1F5F9]/80 hover:bg-[#1D4ED8]/10 hover:text-[#1D4ED8] dark:hover:text-[#F1F5F9]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Actions */}
      <div className="p-4 border-t border-[#E2E8F0]/30 dark:border-[#F1F5F9]/15">
        <div className="glass-card p-3 shadow-xs rounded-2xl bg-white/60 dark:bg-black/20 border border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <ProfileAvatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {user.name || "Authorized user"}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#0F172A]/60 dark:text-[#F1F5F9]/60">
                {roleLabel}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-col gap-1 border-t border-[#E2E8F0]/20 dark:border-[#F1F5F9]/10 pt-2">
            <button
              type="button"
              onClick={() => {
                setLocation("/");
                if (isMobileView) setMobileOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#0F172A]/80 hover:bg-black/5 dark:text-[#F1F5F9]/80 dark:hover:bg-white/10 transition text-left cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> All Portals
            </button>
            <button
              type="button"
              onClick={() => void logout().then(() => setLocation(portalLoginPath))}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition text-left cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]">
      {/* Mobile Drawer (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-[#F8FAFC] dark:bg-[#0F172A]">
          <SheetHeader className="sr-only">
            <SheetTitle>{workspace}</SheetTitle>
            <SheetDescription>Navigation Drawer</SheetDescription>
          </SheetHeader>
          {renderNavContent(true)}
        </SheetContent>
      </Sheet>

      {/* Desktop Persistent Sidebar: Always visible on desktop */}
      <aside
        data-slot="sidebar"
        className="hidden md:flex w-64 min-w-[16rem] max-w-[16rem] shrink-0 flex-col sticky top-0 h-screen border-r border-[#E2E8F0]/30 bg-[#F8FAFC]/95 backdrop-blur-md dark:border-[#F1F5F9]/15 dark:bg-[#0F172A]/95 z-20 overflow-y-auto"
      >
        {renderNavContent(false)}
      </aside>

      {/* Main Workspace Inset Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden relative">
        <div className="liquid-ambient-bg" />

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E2E8F0]/30 bg-[#F8FAFC]/85 px-4 backdrop-blur-md dark:border-[#F1F5F9]/15 dark:bg-[#0F172A]/85 md:px-7">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5 text-[#0F172A] dark:text-[#F8FAFC] hover:bg-black/5 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <UserProfileBadge
              user={user}
              size="md"
              clickable={user?.role === "user"}
              onClick={user?.role === "user" ? () => setLocation("/profile") : undefined}
            />
            <div className="hidden sm:block h-5 w-px bg-[#E2E8F0]/40 dark:bg-[#F1F5F9]/20" />
            <div className="hidden sm:block">
              <p className="text-xs font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">{workspace}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#1D4ED8] dark:text-[#F1F5F9]">
                {roleLabel || t("dashboard.liveWorkspace")}
              </p>
            </div>
          </div>

          {/* Desktop Quick Nav Tabs for ultra-convenient navigation */}
          <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto py-1">
            {navItems.slice(0, 5).map((item) => {
              const active = location === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => setLocation(item.path)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer",
                    active
                      ? "bg-[#1D4ED8]/15 text-[#1D4ED8] dark:bg-[#1D4ED8]/25 dark:text-blue-300"
                      : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSelector compact />
            <div className="hidden items-center gap-2 rounded-full glass-pill bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 sm:flex border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {t("general.live")}
            </div>
            <Button
              onClick={() => void logout().then(() => setLocation(portalLoginPath))}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-rose-500/30 px-3 text-xs font-bold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <main className="workspace-surface flex-1 p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
