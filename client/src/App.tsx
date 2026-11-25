import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

import { useAuth } from "./_core/hooks/useAuth";
import { usePortalStream } from "./hooks/usePortalStream";
import { getPortalForPath } from "./lib/portalAuth";
import { isRoleAllowedInPortal } from "@shared/const";
import { RoleGate } from "./components/RoleGate";
import AccessCodeRevokedModal from "./components/AccessCodeRevokedModal";

// Critical synchronous core auth & landing routes
import LandingHub from "./pages/LandingHub";
import { AdminLogin } from "./pages/admin";
import { UserHome, UserLogin } from "./pages/user";
import { HospitalLogin, RescuerLogin } from "./pages/RoleLogin";
import { isNativeApp } from "./lib/apiConfig";
import MobileCommandRestricted from "./components/MobileCommandRestricted";
import { DesktopOnlyGate } from "./components/DesktopOnlyGate";
import { useMobileLifecycle } from "./hooks/useMobileLifecycle";

// Code-split heavy operational workspaces
const AdminCommand = lazy(() => import("./pages/admin/AdminCommand"));
const HospitalPortal = lazy(() => import("./pages/hospital/HospitalPortal"));
const UserResponder = lazy(() => import("./pages/user/UserResponder"));
const Emergency = lazy(() => import("./pages/Emergency"));
const UserSafety = lazy(() => import("./pages/user/UserSafety"));
const UserTrackFlow = lazy(() => import("./pages/user/UserTrackFlow"));
const UserHospitalRegister = lazy(() => import("./pages/user/UserHospitalRegister"));
const UserMore = lazy(() => import("./pages/user/UserMore"));
const UserProfile = lazy(() => import("./pages/user/UserProfile"));
const UserDonations = lazy(() => import("./pages/user/UserDonations"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#0f766e] border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
      <p className="mt-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Loading module…
      </p>
    </div>
  );
}

function Router() {
  useMobileLifecycle();
  const [location] = useLocation();
  const { user, revokedModalState, closeRevokedModal, refresh } = useAuth();
  const activePortal = getPortalForPath(location || (typeof window !== "undefined" ? window.location.pathname : "/"));
  const canStream =
    activePortal === "citizen" ||
    Boolean(user && isRoleAllowedInPortal(user.role, activePortal));

  usePortalStream(activePortal, {
    enabled: canStream,
    onAccessCodeRevoked: () => {
      void refresh();
    },
  });

  const native = isNativeApp();

  function CitizenDashboardGate() {
    const { user: activeUser, loading: authLoading } = useAuth();
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (authLoading) return <RouteLoadingFallback />;
    if (!activeUser && !isOffline) {
      return <RoleGate roles={["user", "admin", "rescuer", "hospital", "medical"]}><UserHome /></RoleGate>;
    }
    return <UserHome />;
  }

  return (
    <>
      <AccessCodeRevokedModal
        isOpen={revokedModalState.isOpen}
        adminContactNumber={revokedModalState.adminContactNumber}
        role={revokedModalState.role}
        onClose={closeRevokedModal}
      />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Switch>
          {/* Auth Routes */}
          <Route path={"/login"} component={UserLogin} />
          <Route path={"/user/login"} component={UserLogin} />
          <Route path={"/admin/login"}>
            <DesktopOnlyGate portalName="State Command Centre" portalType="admin">
              <AdminLogin />
            </DesktopOnlyGate>
          </Route>
          <Route path={"/admin"}>
            <DesktopOnlyGate portalName="State Command Centre" portalType="admin">
              <AdminLogin />
            </DesktopOnlyGate>
          </Route>
          <Route path={"/responder/login"} component={RescuerLogin} />
          <Route path={"/hospital/login"} component={HospitalLogin} />
          <Route path={"/medical/login"} component={HospitalLogin} />

          {/* Main Homepage: 4-Panel Unified Portal Hub */}
          <Route path={"/"} component={LandingHub} />

          {/* Dedicated Citizen SOS Dashboard */}
          <Route path={"/citizen"}>
            <CitizenDashboardGate />
          </Route>

        {/* User Section Routes */}
        <Route path={"/emergency"}>
          <Emergency />
        </Route>
        <Route path={"/track"}>
          <UserTrackFlow />
        </Route>
        <Route path={"/safety"}>
          <UserSafety />
        </Route>
        <Route path={"/profile"}>
          <RoleGate><UserProfile /></RoleGate>
        </Route>
        <Route path={"/user/profile"}>
          <RoleGate><UserProfile /></RoleGate>
        </Route>
        <Route path={"/more"}>
          <UserMore />
        </Route>
        <Route path={"/donations"}>
          <UserDonations />
        </Route>
        <Route path={"/donations/:rest*"}>
          <UserDonations />
        </Route>
        <Route path={"/donate"}>
          <UserDonations />
        </Route>
        <Route path={"/hospital/register"}>
          <RoleGate><UserHospitalRegister /></RoleGate>
        </Route>

        {/* Hospital Operations Portal - Flexible Across All Screens */}
        <Route path={"/hospital/:rest*"}>
          <HospitalPortal />
        </Route>
        <Route path={"/hospital"}>
          <HospitalPortal />
        </Route>
        <Route path={"/medical/:rest*"}>
          <HospitalPortal />
        </Route>
        <Route path={"/medical"}>
          <HospitalPortal />
        </Route>

        {/* Rescuer Portal - Fully Responsive Across All Devices */}
        <Route path={"/responder/:rest*"}>
          <UserResponder />
        </Route>
        <Route path={"/responder"}>
          <UserResponder />
        </Route>

        {/* Admin Section Routes - Desktop Only */}
        <Route path={"/command/:rest*"}>
          <DesktopOnlyGate portalName="State Command Centre" portalType="admin">
            <RoleGate roles={["admin"]}><AdminCommand /></RoleGate>
          </DesktopOnlyGate>
        </Route>
        <Route path={"/command"}>
          <DesktopOnlyGate portalName="State Command Centre" portalType="admin">
            <RoleGate roles={["admin"]}><AdminCommand /></RoleGate>
          </DesktopOnlyGate>
        </Route>

        {/* Fallback Routes */}
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
