import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Brain, Plus, Pencil, Check, X, Share2, Copy } from "lucide-react";
import {
  listMemories,
  addMemory,
  deleteMemory,
  updateMemory,
  clearMemories,
} from "@/lib/memory.functions";
import { isMemoryEnabled, setMemoryEnabled } from "@/lib/memory-settings";
import {
  readLocalMemories,
  mergeServerMemories,
  addLocalMemory,
  updateLocalMemory,
  removeLocalMemory,
  clearLocalMemories,
} from "@/lib/memory-local";
import { writeOrQueue, isOnline } from "@/lib/offline";
import {
  listMyShares,
  listSharedWithMe,
  shareMemory,
  revokeShare,
} from "@/lib/memory-shares.functions";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/memory")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Memory — Beacon" },
      {
        name: "description",
        content: "View, edit and manage the long-term memories Beacon keeps about you.",
      },
    ],
  }),
  component: MemoryPage,
});

const CATEGORIES = [
  "goal",
  "project",
  "habit",
  "routine",
  "preference",
  "fact",
  "achievement",
  "strength",
  "weakness",
  "reflection",
] as const;

type Category = (typeof CATEGORIES)[number];

type MemoryRow = {
  id: string;
  content: string;
  category: string;
  source: string | null;
  created_at: string;
};

function MemoryPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const list = useServerFn(listMemories);
  const add = useServerFn(addMemory);
  const del = useServerFn(deleteMemory);
  const edit = useServerFn(updateMemory);
  const clearAll = useServerFn(clearMemories);
  const myShares = useServerFn(listMyShares);
  const sharedWithMe = useServerFn(listSharedWithMe);
  const share = useServerFn(shareMemory);
  const revoke = useServerFn(revokeShare);

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("fact");
  const [enabled, setEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<Category>("fact");

  useEffect(() => setEnabled(isMemoryEnabled()), []);

  const { data: memories, isLoading } = useQuery<MemoryRow[]>({
    queryKey: ["memories"],
    // Offline (or when the server is unreachable) fall back to the on-device
    // store so memories created offline never disappear.
    queryFn: async () => {
      if (!isOnline()) return readLocalMemories();
      try {
        const rows = (await list()) as MemoryRow[];
        return mergeServerMemories(rows);
      } catch {
        return readLocalMemories();
      }
    },
    initialData: () => readLocalMemories(),
    networkMode: "offlineFirst",
  });

  const { data: shares } = useQuery({
    queryKey: ["memory-shares"],
    queryFn: () => myShares(),
    enabled: isOnline(),
    retry: false,
  });

  const { data: received } = useQuery({
    queryKey: ["memory-shares-received"],
    queryFn: () => sharedWithMe(),
    enabled: isOnline(),
    retry: false,
  });

  const shareMut = useMutation({
    mutationFn: (vars: { memoryId: string; recipientId: string }) => share({ data: vars }),
    onSuccess: () => {
      toast.success("Memory shared");
      qc.invalidateQueries({ queryKey: ["memory-shares"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Sharing revoked");
      qc.invalidateQueries({ queryKey: ["memory-shares"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function promptShare(memoryId: string) {
    if (!isOnline()) {
      toast.error("Sharing needs a connection.");
      return;
    }
    const recipientId = window
      .prompt("Paste the Beacon user ID of the person you want to share this memory with:")
      ?.trim();
    if (!recipientId) return;
    shareMut.mutate({ memoryId, recipientId });
  }

  const setRows = (rows: MemoryRow[]) => qc.setQueryData<MemoryRow[]>(["memories"], rows);

  const addMut = useMutation({
    mutationFn: async () => {
      const text = content.trim();
      const id = crypto.randomUUID();
      const row: MemoryRow = {
        id,
        content: text,
        category,
        source: "manual",
        created_at: new Date().toISOString(),
      };
      if (!isOnline()) {
        await writeOrQueue({
          label: "Save memory",
          table: "memories",
          type: "insert",
          values: { id, user_id: user?.id, content: text, category, source: "manual" },
        });
        setRows(addLocalMemory({ ...row, pending: true }));
        return { queued: true };
      }
      await add({ data: { id, content: text, category } });
      setRows(addLocalMemory(row));
      return { queued: false };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "Saved offline — will sync" : "Memory saved");
      setContent("");
      if (!queued) qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const editMut = useMutation({
    mutationFn: async (vars: { id: string; content: string; category: Category }) => {
      if (!isOnline()) {
        await writeOrQueue({
          label: "Update memory",
          table: "memories",
          type: "update",
          rowId: vars.id,
          values: { content: vars.content, category: vars.category },
        });
        setRows(
          updateLocalMemory(vars.id, { content: vars.content, category: vars.category }, true),
        );
        return { queued: true };
      }
      await edit({ data: vars });
      setRows(updateLocalMemory(vars.id, { content: vars.content, category: vars.category }));
      return { queued: false };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "Updated offline — will sync" : "Memory updated");
      setEditingId(null);
      if (!queued) qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        await writeOrQueue({ label: "Delete memory", table: "memories", type: "delete", rowId: id });
        setRows(removeLocalMemory(id));
        return { queued: true };
      }
      await del({ data: { id } });
      setRows(removeLocalMemory(id, false));
      return { queued: false };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "Removed offline — will sync" : "Removed");
      if (!queued) qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      if (!isOnline()) {
        await writeOrQueue({
          label: "Clear all memories",
          table: "memories",
          type: "deleteWhere",
          match: { user_id: user.id },
        });
        setRows(clearLocalMemories());
        return { queued: true };
      }
      await clearAll();
      setRows(clearLocalMemories(false));
      return { queued: false };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "Cleared offline — will sync" : "All memories cleared");
      if (!queued) qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });


  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-forest text-primary-foreground shadow-soft">
          <Brain className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Beacon's memory</h1>
          <p className="text-sm text-muted-foreground">
            Long-term facts Beacon uses to personalize every reply.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium">Long-term memory</p>
            <p className="text-xs text-muted-foreground">
              When off, Beacon stops saving new memories and ignores stored ones.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              setMemoryEnabled(v);
              toast.success(v ? "Memory on" : "Memory off");
            }}
            aria-label="Toggle long-term memory"
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Add a memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. I'm learning React and building an English coaching app called Beacon."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger className="w-40 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => addMut.mutate()}
              disabled={content.trim().length < 3 || addMut.isPending}
              className="rounded-full gap-2"
            >
              <Plus className="h-4 w-4" /> Save memory
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="font-serif text-lg">
            Stored memories {memories ? `(${memories.length})` : ""}
          </CardTitle>
          {!!memories?.length && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-destructive"
              disabled={clearMut.isPending}
              onClick={() => {
                if (confirm("Delete all stored memories? This cannot be undone.")) {
                  clearMut.mutate();
                }
              }}
            >
              Clear all
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {memories?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Chat with Beacon or add facts above — it will start remembering.
            </p>
          )}
          {memories?.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3"
            >
              {editingId === m.id ? (
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={editCategory}
                      onValueChange={(v) => setEditCategory(v as Category)}
                    >
                      <SelectTrigger className="w-36 rounded-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="rounded-full gap-1"
                      disabled={editContent.trim().length < 3 || editMut.isPending}
                      onClick={() =>
                        editMut.mutate({
                          id: m.id,
                          content: editContent.trim(),
                          category: editCategory,
                        })
                      }
                    >
                      <Check className="h-4 w-4" /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full gap-1"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-foreground">
                        {m.category}
                      </span>
                      {m.source && (
                        <span className="text-[10px] text-muted-foreground">via {m.source}</span>
                      )}
                    </div>
                    <p className="text-sm">{m.content}</p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditContent(m.content);
                        setEditCategory((CATEGORIES as readonly string[]).includes(m.category)
                          ? (m.category as Category)
                          : "fact");
                      }}
                      aria-label="Edit memory"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => promptShare(m.id)}
                      aria-label="Share memory"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => delMut.mutate(m.id)}
                      aria-label="Delete memory"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-3">
            <p className="text-xs text-muted-foreground">
              Memories are private by default. Share one only if you choose to — the recipient sees
              nothing else, and you can revoke it at any time.
            </p>
            {user?.id && (
              <div className="mt-2 flex items-center gap-2">
                <code className="truncate rounded-full bg-accent px-2 py-1 text-[11px]">
                  {user.id}
                </code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy my Beacon user ID"
                  onClick={() => {
                    void navigator.clipboard?.writeText(user.id);
                    toast.success("Your Beacon user ID is copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Shared by you ({shares?.length ?? 0})</p>
            {shares?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3"
              >
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {memories?.find((m) => m.id === s.memory_id)?.content ?? s.memory_id} → {s.recipient_id}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-destructive"
                  onClick={() => revokeMut.mutate(s.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Shared with you ({received?.length ?? 0})</p>
            {received?.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card/60 p-3">
                <p className="text-sm">{s.memories?.content}</p>
                <p className="text-[10px] text-muted-foreground">from {s.owner_id}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
