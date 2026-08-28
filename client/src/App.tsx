import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

import { useAuth } from "./_core/hooks/useAuth";
import { RoleGate } from "./components/RoleGate";

// Admin Section Pages
import { AdminLogin, AdminCommand } from "./pages/admin";

// User & Operational Section Pages
import {
  UserHome,
  UserLogin,
  UserTrackFlow,
  UserSafety,
  UserResponder,
  UserMedical,
  UserHospitalRegister,
  UserMore,
  UserProfile,
} from "./pages/user";
import Emergency from "./pages/Emergency";
import { useMobileLifecycle } from "./hooks/useMobileLifecycle";

import { isNativeApp } from "./lib/apiConfig";
import MobileCommandRestricted from "./components/MobileCommandRestricted";
import { MedicalLogin, RescuerLogin } from "./pages/RoleLogin";

function Router() {
  useMobileLifecycle();
  const { user } = useAuth();
  const native = isNativeApp();

  return (
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
      <Route path={"/medical/login"} component={MedicalLogin} />

      {/* Main Entry: Registration & Sign In first if not logged in */}
      <Route path={"/"}>
        {user ? <UserHome /> : <UserLogin />}
      </Route>

      {/* User Section Routes */}
      <Route path={"/emergency"}>
        <RoleGate><Emergency /></RoleGate>
      </Route>
      <Route path={"/track"}>
        <RoleGate><UserTrackFlow /></RoleGate>
      </Route>
      <Route path={"/safety"}>
        <RoleGate><UserSafety /></RoleGate>
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
      <Route path={"/hospital/register"}>
        <RoleGate><UserHospitalRegister /></RoleGate>
      </Route>

      {/* Operational Wings */}
      <Route path={"/medical/:rest*"}>
        <RoleGate roles={["medical", "admin"]}><UserMedical /></RoleGate>
      </Route>
      <Route path={"/medical"}>
        <RoleGate roles={["medical", "admin"]}><UserMedical /></RoleGate>
      </Route>
      <Route path={"/responder/:rest*"}>
        <RoleGate roles={["rescuer", "admin"]}><UserResponder /></RoleGate>
      </Route>
      <Route path={"/responder"}>
        <RoleGate roles={["rescuer", "admin"]}><UserResponder /></RoleGate>
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
