import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "gov.in.assamrescue.app",
  appName: "Sahay",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#174e46",
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: "#174e46",
      style: "DARK" as any,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#174e46",
      sound: "beep.wav",
    },
  },
};

export default config;
