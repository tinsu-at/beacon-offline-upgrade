/**
 * Offline app locker (Telegram style).
 *
 * Everything lives on-device: the PIN / pattern is stored only as a salted
 * SHA-256 hash in localStorage, so the locker works with no network at all and
 * the secret itself is never persisted or sent anywhere.
 */

export type LockKind = "pin" | "pattern";

type LockConfig = {
  enabled: boolean;
  kind: LockKind;
  salt: string;
  hash: string;
  /** Auto-lock delay in minutes; 0 = lock immediately on background. */
  timeoutMin: number;
};

const KEY = "beacon-lock-v1";
const LAST_ACTIVE = "beacon-lock-last-active";

function read(): LockConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

function write(cfg: LockConfig | null) {
  if (typeof window === "undefined") return;
  if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
  else localStorage.removeItem(KEY);
}

export function getLockConfig(): LockConfig | null {
  return read();
}

export function isLockEnabled(): boolean {
  return Boolean(read()?.enabled);
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function setLock(kind: LockKind, secret: string, timeoutMin = 0) {
  const salt = randomSalt();
  write({ enabled: true, kind, salt, hash: await hashSecret(secret, salt), timeoutMin });
}

export function disableLock() {
  write(null);
}

export function setLockTimeout(timeoutMin: number) {
  const cfg = read();
  if (cfg) write({ ...cfg, timeoutMin });
}

export async function verifySecret(secret: string): Promise<boolean> {
  const cfg = read();
  if (!cfg) return true;
  return (await hashSecret(secret, cfg.salt)) === cfg.hash;
}

/** Remember when the app was last in the foreground. */
export function markActive() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_ACTIVE, String(Date.now()));
}

/** True when the locker should be showing right now. */
export function shouldLockNow(): boolean {
  const cfg = read();
  if (!cfg?.enabled) return false;
  const last = Number(localStorage.getItem(LAST_ACTIVE) ?? 0);
  if (!last) return true;
  return Date.now() - last >= cfg.timeoutMin * 60_000;
}

/** Pattern nodes (0-8) encoded as a stable string. */
export function encodePattern(nodes: number[]): string {
  return nodes.join("-");
}
