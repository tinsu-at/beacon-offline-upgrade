// Local, offline-first switch for Beacon's long-term memory.
// Stored on-device so it works with no network; the flag is sent with each
// chat request so the server skips retrieval and extraction when it is off.

const KEY = "beacon-memory-enabled";

export function isMemoryEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(KEY) !== "off";
}

export function setMemoryEnabled(enabled: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, enabled ? "on" : "off");
}
