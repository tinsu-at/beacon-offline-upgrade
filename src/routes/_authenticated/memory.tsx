import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Brain, Plus } from "lucide-react";
import { listMemories, addMemory, deleteMemory } from "@/lib/memory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  head: () => ({ meta: [{ title: "Memory — Beacon" }] }),
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

function MemoryPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMemories);
  const add = useServerFn(addMemory);
  const del = useServerFn(deleteMemory);

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("fact");

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => list(),
  });

  const addMut = useMutation({
    mutationFn: async () => add({ data: { content: content.trim(), category } }),
    onSuccess: () => {
      toast.success("Memory saved");
      setContent("");
      qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
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
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
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
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Stored memories {memories ? `(${memories.length})` : ""}
          </CardTitle>
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => delMut.mutate(m.id)}
                aria-label="Delete memory"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
