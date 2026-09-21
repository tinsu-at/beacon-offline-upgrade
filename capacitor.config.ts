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
  // Keep the Android app self-contained: Capacitor serves the bundled dist/client files.
  // Cloud AI, Supabase sync, and other server features remain online-only.
  android: {
    allowMixedContent: false,
    backgroundColor: "#FBF6EC",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
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
