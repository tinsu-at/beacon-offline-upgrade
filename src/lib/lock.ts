/**
 * Offline app locker (Telegram style).
 *
 * Everything lives on-device: the PIN / pattern is stored only as a salted
 * SHA-256 hash in localStorage, so the locker works with no network at all and
 * the secret itself is never persisted or sent anywhere.
 */

export type LockKind = "pin" | "pattern";

export type LockRecovery = {
  question: string;
  salt: string;
  hash: string;
};

type LockConfig = {
  enabled: boolean;
  kind: LockKind;
  salt: string;
  hash: string;
  /** Auto-lock delay in minutes; 0 = lock immediately on background. */
  timeoutMin: number;
  /** Optional recovery question; the answer is stored only as a salted hash. */
  recovery?: LockRecovery;
};

const KEY = "beacon-lock-v1";
const LAST_ACTIVE = "beacon-lock-last-active";
const THROTTLE = "beacon-lock-throttle-v1";

/** Guessing limits: after N failures, back off for a growing cooldown. */
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000];

type ThrottleState = Record<string, { fails: number; blockedUntil: number }>;

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
  const prev = read();
  write({
    enabled: true,
    kind,
    salt,
    hash: await hashSecret(secret, salt),
    timeoutMin,
    ...(prev?.recovery ? { recovery: prev.recovery } : {}),
  });
  resetThrottle("unlock");
}

export function disableLock() {
  write(null);
  if (typeof window !== "undefined") localStorage.removeItem(THROTTLE);
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

/* ---------------- Recovery question ---------------- */

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stores the recovery question with a salted hash of the answer. */
export async function setRecovery(question: string, answer: string) {
  const cfg = read();
  if (!cfg) return;
  const salt = randomSalt();
  write({
    ...cfg,
    recovery: { question: question.trim(), salt, hash: await hashSecret(normalizeAnswer(answer), salt) },
  });
  resetThrottle("recovery");
}

export function clearRecovery() {
  const cfg = read();
  if (!cfg) return;
  const { recovery: _recovery, ...rest } = cfg;
  write(rest);
}

export function getRecoveryQuestion(): string | null {
  return read()?.recovery?.question ?? null;
}

export async function verifyRecoveryAnswer(answer: string): Promise<boolean> {
  const rec = read()?.recovery;
  if (!rec) return false;
  return (await hashSecret(normalizeAnswer(answer), rec.salt)) === rec.hash;
}

/* ---------------- Guess throttling ---------------- */

export type ThrottleKind = "unlock" | "recovery";

function readThrottle(): ThrottleState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(THROTTLE) ?? "{}") as ThrottleState;
  } catch {
    return {};
  }
}

function writeThrottle(state: ThrottleState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THROTTLE, JSON.stringify(state));
}

/** Milliseconds left before another guess is allowed (0 = allowed now). */
export function blockedForMs(kind: ThrottleKind): number {
  const entry = readThrottle()[kind];
  if (!entry) return 0;
  return Math.max(0, entry.blockedUntil - Date.now());
}

export function attemptsLeft(kind: ThrottleKind): number {
  const entry = readThrottle()[kind];
  return Math.max(0, MAX_ATTEMPTS - (entry?.fails ?? 0) % MAX_ATTEMPTS);
}

/** Records a wrong guess; returns the cooldown in ms (0 when none yet). */
export function recordFailure(kind: ThrottleKind): number {
  const state = readThrottle();
  const fails = (state[kind]?.fails ?? 0) + 1;
  let blockedUntil = 0;
  if (fails % MAX_ATTEMPTS === 0) {
    const step = Math.min(Math.floor(fails / MAX_ATTEMPTS) - 1, COOLDOWN_MS.length - 1);
    blockedUntil = Date.now() + COOLDOWN_MS[step]!;
  }
  state[kind] = { fails, blockedUntil };
  writeThrottle(state);
  return Math.max(0, blockedUntil - Date.now());
}

export function resetThrottle(kind: ThrottleKind) {
  const state = readThrottle();
  delete state[kind];
  writeThrottle(state);
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

