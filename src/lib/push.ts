// Web Push subscription helpers. Push delivery from a server requires a
// backend that stores subscriptions and sends VAPID-signed push payloads.
// Beacon's local reminders (see src/lib/notifications.ts) already work
// entirely on-device. This module lets you additionally register with the
// browser's Push service when a VAPID public key is provided via
// VITE_VAPID_PUBLIC_KEY. If not configured, subscribePush() returns a clear
// disabled state so the UI can explain the situation.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export type PushStatus =
  | { state: "unsupported" }
  | { state: "not-configured" }
  | { state: "denied" }
  | { state: "prompt" }
  | { state: "subscribed"; endpoint: string };

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return { state: "unsupported" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return { state: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { state: "not-configured" };
  if (Notification.permission === "denied") return { state: "denied" };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) return { state: "subscribed", endpoint: sub.endpoint };
  return { state: "prompt" };
}

export async function subscribePush(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY) return { state: "not-configured" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return { state: "unsupported" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { state: "denied" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  return { state: "subscribed", endpoint: sub.endpoint };
}

export async function unsubscribePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY);
}
