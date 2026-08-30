import { useEffect } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

export function useMobileLifecycle() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1. Configure Status Bar
    void (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#174e46" });
      } catch (err) {
        console.warn("[Mobile] StatusBar configuration error:", err);
      }
    })();

    // 2. Hide Splash Screen smoothly once UI is ready
    void (async () => {
      try {
        await SplashScreen.hide({ fadeOutDuration: 400 });
      } catch (err) {
        console.warn("[Mobile] SplashScreen hide error:", err);
      }
    })();

    // 3. Android Hardware Back Button Handling
    let backListenerHandle: { remove: () => Promise<void> } | null = null;
    void (async () => {
      try {
        backListenerHandle = await CapApp.addListener("backButton", ({ canGoBack }) => {
          if (location !== "/" && location !== "/login" && location !== "/user/login") {
            if (canGoBack) {
              window.history.back();
            } else {
              setLocation("/");
            }
          } else {
            // At root: minimize/exit
            void CapApp.minimizeApp();
          }
        });
      } catch (err) {
        console.warn("[Mobile] Back button listener error:", err);
      }
    })();

    return () => {
      if (backListenerHandle) {
        void backListenerHandle.remove();
      }
    };
  }, [location, setLocation]);
}
