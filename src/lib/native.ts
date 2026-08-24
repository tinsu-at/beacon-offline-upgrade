/**
 * Native (Capacitor / Android) bridge.
 *
 * Every helper here is a no-op in the browser, so the web + PWA build keeps
 * behaving exactly as before. Capacitor modules are imported dynamically so
 * they never land in the SSR/browser critical path.
 */

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Status bar, splash screen and Android hardware back button. */
export async function initNative(opts: { dark: boolean; onBack: () => boolean }) {
  if (!isNative()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
      import("@capacitor/app"),
    ]);
    await StatusBar.setStyle({ style: opts.dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: opts.dark ? "#0F1729" : "#FBF6EC" }).catch(
      () => undefined,
    );
    await SplashScreen.hide();
    await App.addListener("backButton", ({ canGoBack }) => {
      // onBack returns true when the app handled it (closed a sheet/dialog).
      if (opts.onBack()) return;
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
  } catch {
    // Plugin missing (web build) — ignore.
  }
}

export async function setNativeStatusBarTheme(dark: boolean) {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? "#0F1729" : "#FBF6EC" }).catch(
      () => undefined,
    );
  } catch {
    /* noop */
  }
}

export async function nativeVibrate() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* noop */
  }
}

/* ---------------- Local notifications ---------------- */

export async function requestNativeNotifPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  } catch {
    return false;
  }
}

export async function nativeNotifPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const res = await LocalNotifications.checkPermissions();
    return res.display === "granted";
  } catch {
    return false;
  }
}

export type NativeSchedule = {
  id: number;
  title: string;
  body: string;
  hour: number;
  minute: number;
  /** 0-6 (Sun-Sat) for weekly reminders; omitted for daily. */
  weekday?: number;
  sound: boolean;
};

/** Replaces all previously scheduled Beacon reminders with the given set. */
export async function scheduleNativeNotifications(items: NativeSchedule[]) {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    if (!items.length) return;
    await LocalNotifications.schedule({
      notifications: items.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body,
        smallIcon: "ic_stat_beacon",
        iconColor: "#28469E",
        sound: i.sound ? undefined : "",
        schedule: {
          allowWhileIdle: true,
          on:
            i.weekday === undefined
              ? { hour: i.hour, minute: i.minute }
              : { weekday: i.weekday + 1, hour: i.hour, minute: i.minute },
        },
      })),
    });
  } catch {
    /* noop */
  }
}
