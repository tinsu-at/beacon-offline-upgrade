// Every on-device store in Beacon is per-account. Without this, signing in as
// a second user on the same device would show (and sync) the first user's
// offline memories, queued writes and preferences.

const ACTIVE_KEY = "beacon-active-user";

let activeUserId: string | null = null;

export function setActiveUserId(id: string | null) {
  activeUserId = id;
  if (typeof localStorage === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // storage unavailable — in-memory value still scopes this session
  }
}

export function getActiveUserId(): string | null {
  if (activeUserId) return activeUserId;
  if (typeof localStorage === "undefined") return null;
  try {
    activeUserId = localStorage.getItem(ACTIVE_KEY);
  } catch {
    activeUserId = null;
  }
  return activeUserId;
}

/** Namespace a localStorage key with the signed-in user's id. */
export function scopedKey(base: string): string {
  const uid = getActiveUserId();
  return uid ? `${base}:${uid}` : `${base}:anon`;
}
