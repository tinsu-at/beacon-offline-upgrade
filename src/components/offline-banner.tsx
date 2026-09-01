import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudOff, RefreshCw } from "lucide-react";
import { initOfflineSync, offlineState, subscribeOffline, syncOutbox } from "@/lib/offline";

export function OfflineBanner() {
  const qc = useQueryClient();
  const [s, setS] = useState(offlineState());

  useEffect(() => {
    const unsub = subscribeOffline(setS);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    return initOfflineSync(({ synced, failed }) => {
      if (synced) {
        toast.success(`Synced ${synced} offline change${synced === 1 ? "" : "s"}`);
        qc.invalidateQueries();
        // Rows inserted through the outbox have no embedding yet; backfill them
        // so offline-created memories are retrievable in chat.
        void import("@/lib/memory.functions")
          .then(({ embedMissingMemories }) => embedMissingMemories())
          .catch(() => {});
      }
      if (failed) toast.error(`${failed} change${failed === 1 ? "" : "s"} could not sync yet`);
    });
  }, [qc]);


  if (s.online && !s.pending && !s.syncing) return null;

  return (
    <div className="fixed inset-x-0 top-14 z-40 flex justify-center px-3">
      <div className="glass-panel flex max-w-full items-center gap-3 rounded-full px-4 py-2 text-xs shadow-elegant">
        {s.syncing ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        <span className="min-w-0 truncate">
          {s.syncing
            ? `Syncing ${s.done}/${s.total}…`
            : s.online
              ? `${s.pending} change${s.pending === 1 ? "" : "s"} waiting to sync`
              : `Offline • Changes saved locally${s.pending ? ` (${s.pending})` : ""}`}
        </span>
        {s.online && !!s.pending && !s.syncing && (
          <button
            className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => void syncOutbox().then(() => qc.invalidateQueries())}
          >
            Sync now
          </button>
        )}
      </div>
    </div>
  );
}
