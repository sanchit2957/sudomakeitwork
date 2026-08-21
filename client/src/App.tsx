import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Command from "./pages/Command";
import Emergency from "./pages/Emergency";
import Home from "./pages/Home";
import Medical from "./pages/Medical";
import More from "./pages/More";
import Responder from "./pages/Responder";
import Safety from "./pages/Safety";
import Track from "./pages/Track";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/emergency"} component={Emergency} />
      <Route path={"/track"} component={Track} />
      <Route path={"/safety"} component={Safety} />
      <Route path={"/more"} component={More} />
      <Route path={"/medical/:rest*"} component={Medical} />
      <Route path={"/medical"} component={Medical} />
      <Route path={"/responder/:rest*"} component={Responder} />
      <Route path={"/responder"} component={Responder} />
      <Route path={"/command/:rest*"} component={Command} />
      <Route path={"/command"} component={Command} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
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
