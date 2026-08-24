// Offline outbox: queues database writes while the device is offline and
// replays them in order when connectivity returns. Reads stay available
// because the React Query cache is persisted to localStorage (see router.tsx).

import { supabase } from "@/integrations/supabase/client";

export type OutboxOp =
  | {
      id: string;
      at: number;
      label: string;
      table: string;
      type: "insert";
      values: Record<string, unknown>;
    }
  | {
      id: string;
      at: number;
      label: string;
      table: string;
      type: "update";
      rowId: string;
      values: Record<string, unknown>;
    }
  | { id: string; at: number; label: string; table: string; type: "delete"; rowId: string }
  | {
      id: string;
      at: number;
      label: string;
      table: string;
      type: "deleteWhere";
      match: Record<string, string>;
    };

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type NewOutboxOp = DistributiveOmit<OutboxOp, "id" | "at">;

const KEY = "beacon-outbox-v1";

type State = {
  online: boolean;
  syncing: boolean;
  pending: number;
  total: number;
  done: number;
};

let state: State = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  total: 0,
  done: 0,
};

const listeners = new Set<(s: State) => void>();

function emit() {
  state = { ...state, pending: readQueue().length };
  for (const l of listeners) l(state);
}

export function subscribeOffline(fn: (s: State) => void) {
  listeners.add(fn);
  fn({ ...state, pending: readQueue().length });
  return () => listeners.delete(fn);
}

export function offlineState(): State {
  return { ...state, pending: readQueue().length };
}

function readQueue(): OutboxOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxOp[];
  } catch {
    return [];
  }
}

function writeQueue(q: OutboxOp[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
  emit();
}

/**
 * Give every queued insert a client-generated primary key so replaying it is
 * idempotent: if the row already landed, the retry fails on the unique key
 * instead of creating a duplicate (see the duplicate handling in syncOutbox).
 */
function withStableId(op: NewOutboxOp): NewOutboxOp {
  if (op.type !== "insert") return op;
  if (typeof op.values["id"] === "string") return op;
  return { ...op, values: { ...op.values, id: crypto.randomUUID() } };
}

export function enqueue(rawOp: NewOutboxOp) {
  const op = withStableId(rawOp);
  const full = { ...op, id: crypto.randomUUID(), at: Date.now() } as OutboxOp;
  const q = readQueue();
  // Collapse repeated updates to the same row+table (last write wins).
  if (full.type === "update") {
    const idx = q.findIndex(
      (o) => o.type === "update" && o.table === full.table && o.rowId === full.rowId,
    );
    if (idx >= 0) {
      const prev = q[idx] as Extract<OutboxOp, { type: "update" }>;
      q[idx] = { ...prev, values: { ...prev.values, ...full.values }, at: full.at };
      writeQueue(q);
      return full.id;
    }
  }
  q.push(full);
  writeQueue(q);
  return full.id;
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function runOp(op: OutboxOp) {
  const table = op.table as never;
  if (op.type === "insert") {
    return supabase.from(table).insert(op.values as never);
  }
  if (op.type === "update") {
    return supabase
      .from(table)
      .update(op.values as never)
      .eq("id", op.rowId);
  }
  if (op.type === "delete") {
    return supabase.from(table).delete().eq("id", op.rowId);
  }
  let q = supabase.from(table).delete();
  for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
  return q;
}

/**
 * Run a write immediately when online, otherwise store it in the outbox.
 * Returns true when the write was queued for later.
 */
export async function writeOrQueue(op: NewOutboxOp): Promise<boolean> {
  if (!isOnline()) {
    enqueue(op);
    return true;
  }
  try {
    const { error } = await runOp({ ...op, id: "now", at: Date.now() } as OutboxOp);
    if (error) throw new Error(error.message);
    return false;
  } catch (e) {
    if (!isOnline()) {
      enqueue(op);
      return true;
    }
    throw e;
  }
}

let syncing = false;

export async function syncOutbox(): Promise<{ synced: number; failed: number }> {
  if (syncing || !isOnline()) return { synced: 0, failed: 0 };
  const queue = readQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  syncing = true;
  state = { ...state, syncing: true, total: queue.length, done: 0 };
  emit();

  let synced = 0;
  let failed = 0;
  const remaining: OutboxOp[] = [];

  for (const op of queue) {
    try {
      const { error } = await runOp(op);
      if (error) {
        // The row already exists: a previous attempt landed before we saw the
        // response. Idempotent replay — count it as synced, never duplicate.
        if (op.type === "insert" && /duplicate key|already exists|23505/i.test(error.message)) {
          synced++;
        }
        // Row already gone (deleted elsewhere) is not a data-loss conflict.
        else if (op.type !== "insert" && /not found|no rows/i.test(error.message)) {
          synced++;
        } else if (!isOnline()) {
          remaining.push(op);
        } else {
          failed++;
          remaining.push(op);
        }
      } else {
        synced++;
      }
    } catch {
      remaining.push(op);
      if (isOnline()) failed++;
    }
    state = { ...state, done: state.done + 1 };
    emit();
  }

  writeQueue(remaining);
  syncing = false;
  state = { ...state, syncing: false, total: 0, done: 0 };
  emit();
  return { synced, failed };
}

export function initOfflineSync(onSynced?: (r: { synced: number; failed: number }) => void) {
  if (typeof window === "undefined") return () => {};
  const update = () => {
    state = { ...state, online: navigator.onLine };
    emit();
  };
  const goOnline = async () => {
    update();
    const r = await syncOutbox();
    if ((r.synced || r.failed) && onSynced) onSynced(r);
  };
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", update);
  update();
  void goOnline();
  const interval = setInterval(() => {
    if (isOnline() && readQueue().length) void goOnline();
  }, 60_000);
  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", update);
    clearInterval(interval);
  };
}
