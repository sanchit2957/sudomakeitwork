import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

import { useAuth } from "./_core/hooks/useAuth";
import { RoleGate } from "./components/RoleGate";
import AccessCodeRevokedModal from "./components/AccessCodeRevokedModal";

// Critical synchronous core auth routes
import { AdminLogin } from "./pages/admin";
import { UserHome, UserLogin } from "./pages/user";
import { HospitalLogin, RescuerLogin } from "./pages/RoleLogin";
import { isNativeApp } from "./lib/apiConfig";
import MobileCommandRestricted from "./components/MobileCommandRestricted";
import { useMobileLifecycle } from "./hooks/useMobileLifecycle";

// Code-split heavy operational workspaces
const AdminCommand = lazy(() => import("./pages/admin/AdminCommand"));
const HospitalPortal = lazy(() => import("./pages/HospitalPortal"));
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
  const { user, revokedModalState, closeRevokedModal } = useAuth();
  const native = isNativeApp();

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
            {native ? <MobileCommandRestricted /> : <AdminLogin />}
          </Route>
          <Route path={"/admin"}>
            {native ? <MobileCommandRestricted /> : <AdminLogin />}
          </Route>
          <Route path={"/responder/login"} component={RescuerLogin} />
          <Route path={"/hospital/login"} component={HospitalLogin} />
          <Route path={"/medical/login"} component={HospitalLogin} />

          {/* Main Entry: User Home Emergency Hub */}
          <Route path={"/"}>
            <RoleGate roles={["user"]}><UserHome /></RoleGate>
          </Route>

        {/* User Section Routes */}
        <Route path={"/emergency"}>
          <RoleGate roles={["user"]}><Emergency /></RoleGate>
        </Route>
        <Route path={"/track"}>
          <RoleGate roles={["user"]}><UserTrackFlow /></RoleGate>
        </Route>
        <Route path={"/safety"}>
          <RoleGate roles={["user"]}><UserSafety /></RoleGate>
        </Route>
        <Route path={"/profile"}>
          <RoleGate><UserProfile /></RoleGate>
        </Route>
        <Route path={"/user/profile"}>
          <RoleGate><UserProfile /></RoleGate>
        </Route>
        <Route path={"/more"}>
          <RoleGate><UserMore /></RoleGate>
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

        {/* Single Canonical Hospital Operations Portal */}
        <Route path={"/hospital/:rest*"}>
          <RoleGate roles={["hospital", "medical"]}><HospitalPortal /></RoleGate>
        </Route>
        <Route path={"/hospital"}>
          <RoleGate roles={["hospital", "medical"]}><HospitalPortal /></RoleGate>
        </Route>
        <Route path={"/medical/:rest*"}>
          <RoleGate roles={["hospital", "medical"]}><HospitalPortal /></RoleGate>
        </Route>
        <Route path={"/medical"}>
          <RoleGate roles={["hospital", "medical"]}><HospitalPortal /></RoleGate>
        </Route>

        {/* Rescuer Portal */}
        <Route path={"/responder/:rest*"}>
          <RoleGate roles={["rescuer"]}><UserResponder /></RoleGate>
        </Route>
        <Route path={"/responder"}>
          <RoleGate roles={["rescuer"]}><UserResponder /></RoleGate>
        </Route>

        {/* Admin Section Routes - Restricted in Mobile Native App */}
        <Route path={"/command/:rest*"}>
          {native ? <MobileCommandRestricted /> : <RoleGate roles={["admin"]}><AdminCommand /></RoleGate>}
        </Route>
        <Route path={"/command"}>
          {native ? <MobileCommandRestricted /> : <RoleGate roles={["admin"]}><AdminCommand /></RoleGate>}
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
        defaultTheme="light"
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
