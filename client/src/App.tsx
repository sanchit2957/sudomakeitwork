import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

import { useAuth } from "./_core/hooks/useAuth";

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
} from "./pages/user";
import Emergency from "./pages/Emergency";
import { useMobileLifecycle } from "./hooks/useMobileLifecycle";

function Router() {
  useMobileLifecycle();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8f7] text-[#122824] dark:bg-[#090a0a] dark:text-[#f3f4f6]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
          <p className="font-mono text-xs font-bold text-muted-foreground">Initializing portal…</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Auth Routes */}
      <Route path={"/login"} component={UserLogin} />
      <Route path={"/user/login"} component={UserLogin} />
      <Route path={"/admin/login"} component={AdminLogin} />
      <Route path={"/admin"} component={AdminLogin} />

      {/* Main Entry: Registration & Sign In first if not logged in */}
      <Route path={"/"}>
        {user ? <UserHome /> : <UserLogin />}
      </Route>

      {/* User Section Routes */}
      <Route path={"/emergency"}>
        {user ? <Emergency /> : <UserLogin />}
      </Route>
      <Route path={"/track"}>
        {user ? <UserTrackFlow /> : <UserLogin />}
      </Route>
      <Route path={"/safety"}>
        {user ? <UserSafety /> : <UserLogin />}
      </Route>
      <Route path={"/more"}>
        {user ? <UserMore /> : <UserLogin />}
      </Route>
      <Route path={"/hospital/register"}>
        {user ? <UserHospitalRegister /> : <UserLogin />}
      </Route>

      {/* Operational Wings */}
      <Route path={"/medical/:rest*"}>
        {user ? <UserMedical /> : <UserLogin />}
      </Route>
      <Route path={"/medical"}>
        {user ? <UserMedical /> : <UserLogin />}
      </Route>
      <Route path={"/responder/:rest*"}>
        {user ? <UserResponder /> : <UserLogin />}
      </Route>
      <Route path={"/responder"}>
        {user ? <UserResponder /> : <UserLogin />}
      </Route>

      {/* Admin Section Routes */}
      <Route path={"/command/:rest*"}>
        {user ? <AdminCommand /> : <AdminLogin />}
      </Route>
      <Route path={"/command"}>
        {user ? <AdminCommand /> : <AdminLogin />}
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
