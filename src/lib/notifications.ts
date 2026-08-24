// Local, on-device notification scheduler for Beacon.
// Uses the browser Notification API. Persists preferences in localStorage
// and re-arms itself each time the page loads or a preference changes.
// On Android (Capacitor) it delegates to native local notifications so
// reminders fire even when the app is closed.
import {
  isNative,
  nativeNotifPermission,
  requestNativeNotifPermission,
  scheduleNativeNotifications,
} from "@/lib/native";

export type NotifKey =
  | "morningBriefing"
  | "eveningReflection"
  | "habitReminder"
  | "journalReminder"
  | "confidenceChallenge"
  | "dailyReview"
  | "taskReminder"
  | "goalReminder"
  | "weeklyReview";

export type NotifPref = {
  enabled: boolean;
  time: string; // "HH:mm"
  title: string;
  body: string;
  sound?: boolean;
  vibrate?: boolean;
  /** 0=Sunday … 6=Saturday. When set, the reminder fires weekly on that day. */
  day?: number;
};

export type NotifPrefs = Record<NotifKey, NotifPref>;

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  morningBriefing: {
    enabled: true,
    time: "07:00",
    title: "Morning briefing",
    body: "Let's plan the day. Beacon is ready when you are.",
  },
  confidenceChallenge: {
    enabled: true,
    time: "09:00",
    title: "Today's confidence challenge",
    body: "One small brave act builds a bolder you.",
  },
  habitReminder: {
    enabled: true,
    time: "12:30",
    title: "Habit check-in",
    body: "Log your habits — tiny reps compound.",
  },
  journalReminder: {
    enabled: true,
    time: "18:00",
    title: "Journal a moment",
    body: "Three lines about today is enough.",
  },
  eveningReflection: {
    enabled: true,
    time: "21:00",
    title: "Evening reflection",
    body: "Did today make you someone a child would be proud to imitate?",
  },
  dailyReview: {
    enabled: false,
    time: "22:00",
    title: "Daily review",
    body: "What went well? What can you improve tomorrow?",
  },
  taskReminder: {
    enabled: true,
    time: "10:00",
    title: "Task check",
    body: "What is the one task that must not slip today?",
  },
  goalReminder: {
    enabled: true,
    time: "16:00",
    title: "Goal progress",
    body: "Move one goal forward before the day closes.",
  },
  weeklyReview: {
    enabled: true,
    time: "19:00",
    day: 0,
    title: "Weekly review",
    body: "Review the week: wins, misses, and next week's focus.",
  },
};

const KEY = "beacon-notif-prefs-v2";

export function loadNotifPrefs(): NotifPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_NOTIF_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTIF_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return { ...DEFAULT_NOTIF_PREFS, ...parsed } as NotifPrefs;
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  scheduleAll(prefs);
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined") return "denied";
  if (isNative()) {
    const ok = await requestNativeNotifPermission();
    nativePermission = ok ? "granted" : "denied";
    if (ok) scheduleAll();
    return nativePermission;
  }
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

let nativePermission: NotificationPermission = "default";
if (typeof window !== "undefined" && isNative()) {
  void nativeNotifPermission().then((ok) => {
    nativePermission = ok ? "granted" : "default";
  });
}

export function notifPermission(): NotificationPermission {
  if (typeof window === "undefined") return "denied";
  if (isNative()) return nativePermission;
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

const timers = new Map<NotifKey, ReturnType<typeof setTimeout>>();

function nextFireMs(hhmm: string, day?: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (typeof day === "number") {
    let delta = (day - t.getDay() + 7) % 7;
    if (delta === 0 && t.getTime() <= now.getTime()) delta = 7;
    t.setDate(t.getDate() + delta);
  } else if (t.getTime() <= now.getTime()) {
    t.setDate(t.getDate() + 1);
  }
  return t.getTime() - now.getTime();
}

function routeFor(key: NotifKey): string {
  switch (key) {
    case "morningBriefing":
    case "eveningReflection":
    case "dailyReview":
    case "weeklyReview":
      return "/chat";
    case "habitReminder":
      return "/habits";
    case "journalReminder":
      return "/journal";
    case "taskReminder":
      return "/tasks";
    case "goalReminder":
      return "/goals";
    default:
      return "/dashboard";
  }
}

export function fireNotification(key: NotifKey, pref: NotifPref) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    if (pref.vibrate && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([80, 40, 80]);
      } catch {
        /* noop */
      }
    }
    const n = new Notification(pref.title, {
      body: pref.body,
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      tag: `beacon-${key}`,
      silent: pref.sound === false,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = routeFor(key);
    };
  } catch {
    // ignore
  }
}

function fire(key: NotifKey, pref: NotifPref) {
  fireNotification(key, pref);
}

export function scheduleAll(prefs: NotifPrefs = loadNotifPrefs()) {
  if (typeof window === "undefined") return;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();

  if (isNative()) {
    const keys = Object.keys(prefs) as NotifKey[];
    void scheduleNativeNotifications(
      keys
        .filter((k) => prefs[k].enabled)
        .map((k, i) => {
          const p = prefs[k];
          const [hour, minute] = p.time.split(":").map(Number);
          return {
            id: i + 1,
            title: p.title,
            body: p.body,
            hour,
            minute,
            weekday: p.day,
            sound: p.sound !== false,
          };
        }),
    );
    return;
  }

  for (const key of Object.keys(prefs) as NotifKey[]) {
    const pref = prefs[key];
    if (!pref.enabled) continue;
    const arm = () => {
      const delay = nextFireMs(pref.time, pref.day);
      const id = setTimeout(() => {
        fire(key, pref);
        arm(); // re-arm for the next occurrence
      }, delay);
      timers.set(key, id);
    };
    arm();
  }
}
