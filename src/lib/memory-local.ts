// Persistent on-device store for Beacon's long-term memories.
//
// The React Query cache alone is not a reliable home for memories created
// offline (it can be evicted, rehydrated late, or overwritten by an empty
// server response). This module keeps an explicit localStorage mirror of the
// memory list plus the local-only changes that have not reached the server
// yet, so an offline memory survives closing and reopening the app and is
// merged — never duplicated — once the outbox syncs.

export type LocalMemory = {
  id: string;
  content: string;
  category: string;
  source: string | null;
  created_at: string;
  /** Set while the row (or edit) still lives only on this device. */
  pending?: boolean;
};

type Store = {
  rows: LocalMemory[];
  /** Ids deleted locally, so a stale server list cannot resurrect them. */
  tombstones: string[];
};

const KEY = "beacon-memories-v1";

function emptyStore(): Store {
  return { rows: [], tombstones: [] };
}

function read(): Store {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
    };
  } catch {
    return emptyStore();
  }
}

function write(store: Store) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable — keep the in-memory list working.
  }
}

function sortRows(rows: LocalMemory[]) {
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** The list to render: everything known on this device, newest first. */
export function readLocalMemories(): LocalMemory[] {
  return sortRows(read().rows);
}

export function addLocalMemory(row: LocalMemory): LocalMemory[] {
  const store = read();
  const rows = store.rows.filter((r) => r.id !== row.id);
  rows.unshift(row);
  const next = { rows, tombstones: store.tombstones.filter((id) => id !== row.id) };
  write(next);
  return sortRows(next.rows);
}

export function updateLocalMemory(
  id: string,
  patch: Partial<LocalMemory>,
  pending = false,
): LocalMemory[] {
  const store = read();
  const rows = store.rows.map((r) =>
    r.id === id ? { ...r, ...patch, pending: pending || r.pending } : r,
  );
  write({ ...store, rows });
  return sortRows(rows);
}

export function removeLocalMemory(id: string, tombstone = true): LocalMemory[] {
  const store = read();
  const rows = store.rows.filter((r) => r.id !== id);
  const tombstones = tombstone
    ? Array.from(new Set([...store.tombstones, id]))
    : store.tombstones.filter((t) => t !== id);
  write({ rows, tombstones });
  return sortRows(rows);
}

export function clearLocalMemories(tombstone = true): LocalMemory[] {
  const store = read();
  const tombstones = tombstone
    ? Array.from(new Set([...store.tombstones, ...store.rows.map((r) => r.id)]))
    : [];
  write({ rows: [], tombstones });
  return [];
}

/**
 * Reconcile a fresh server list with local state.
 *
 * - Rows the server confirms lose their `pending` flag (no duplicates: offline
 *   inserts carry the client-generated id that the outbox replays).
 * - Rows still pending locally stay visible until the server has them.
 * - Rows deleted offline stay hidden until the server agrees they are gone.
 */
export function mergeServerMemories(serverRows: LocalMemory[]): LocalMemory[] {
  const store = read();
  const serverIds = new Set(serverRows.map((r) => r.id));
  const localById = new Map(store.rows.map((r) => [r.id, r]));

  const merged: LocalMemory[] = [];
  for (const row of serverRows) {
    if (store.tombstones.includes(row.id)) continue; // pending offline delete
    const local = localById.get(row.id);
    // A pending local edit wins until the server reflects it; once the server
    // content matches, the row is fully synced and stops being pending.
    const stillPending =
      !!local?.pending && (local.content !== row.content || local.category !== row.category);
    merged.push(stillPending ? { ...row, ...local, pending: true } : { ...row, pending: false });
  }
  for (const local of store.rows) {
    if (!serverIds.has(local.id) && local.pending) merged.push(local);
  }

  const tombstones = store.tombstones.filter((id) => serverIds.has(id));
  const next = { rows: sortRows(merged), tombstones };
  write(next);
  return next.rows;
}
