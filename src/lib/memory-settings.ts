// Local, offline-first switch for Beacon's long-term memory.
// Stored on-device (per account) so it works with no network; the flag is sent
// with each chat request so the server skips retrieval and extraction when off.

import { scopedKey } from "@/lib/user-scope";

const BASE = "beacon-memory-enabled";

export function isMemoryEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(scopedKey(BASE)) !== "off";
}

export function setMemoryEnabled(enabled: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(scopedKey(BASE), enabled ? "on" : "off");
}
