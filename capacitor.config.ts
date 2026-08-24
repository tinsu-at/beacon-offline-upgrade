import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Beacon — private Android build (Capacitor).
 *
 * The Android shell loads the deployed Beacon build so the installed app
 * stays in sync with the new Beacon project.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.beacon",
  appName: "Beacon",
  webDir: "dist/client",
  server: {
    url: "https://beacon-offline-upgrade.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#FBF6EC",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#FBF6EC",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_beacon",
      iconColor: "#28469E",
    },
  },
};

export default config;
