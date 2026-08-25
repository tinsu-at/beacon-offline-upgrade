import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Beacon — private Android build (Capacitor).
 *
 * Beacon runs on a server (TanStack Start server functions, Gemini chat API,
 * Telegram webhook), so the Android shell loads the deployed Beacon build
 * instead of a static export. Everything — auth, memory, chat, offline cache,
 * service worker — keeps working exactly as it does on the web.
 *
 * To point the app at a different host (e.g. the preview build while testing),
 * change `server.url` below and re-run `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.beacon",
  appName: "Beacon",
  webDir: "dist/client",
  server: {
    url: "https://tinsae-beacon-light.lovable.app",
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
