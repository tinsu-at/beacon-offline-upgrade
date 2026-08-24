import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatLongDate, todayISO } from "@/lib/beacon-data";
import { Trash2 } from "lucide-react";
import { writeOrQueue } from "@/lib/offline";

type Entry = {
  id: string;
  title: string | null;
  content: string;
  mood: string | null;
  entry_date: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({ meta: [{ title: "Journal — Beacon" }] }),
  component: JournalPage,
});

function JournalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["journal", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Entry[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !content.trim()) return;
    const row = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: title || null,
      content,
      mood: mood || null,
      entry_date: todayISO(),
    };
    qc.setQueryData<Entry[]>(["journal", user.id], (old) => [
      { ...row, created_at: new Date().toISOString() } as Entry,
      ...(old ?? []),
    ]);
    setTitle("");
    setContent("");
    setMood("");
    try {
      const queued = await writeOrQueue({
        label: "Journal entry",
        table: "journal_entries",
        type: "insert",
        values: row,
      });
      toast.success(queued ? "Saved offline — will sync later" : "Entry saved");
      if (!queued) qc.invalidateQueries({ queryKey: ["journal"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save entry");
      qc.invalidateQueries({ queryKey: ["journal"] });
    }
  }

  async function remove(id: string) {
    qc.setQueryData<Entry[]>(["journal", user?.id], (old) =>
      (old ?? []).filter((e) => e.id !== id),
    );
    try {
      const queued = await writeOrQueue({
        label: "Delete journal entry",
        table: "journal_entries",
        type: "delete",
        rowId: id,
      });
      if (!queued) qc.invalidateQueries({ queryKey: ["journal"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete entry");
      qc.invalidateQueries({ queryKey: ["journal"] });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Journal</h1>
        <p className="text-sm text-muted-foreground">{formatLongDate()}</p>
      </div>

      <Card className="rounded-3xl p-4 shadow-elegant sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A word for today..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mood</Label>
              <Input
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="Grateful, focused, tired..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reflection</Label>
            <Textarea
              required
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write freely. What went well? What would you do differently?"
            />
          </div>
          <Button type="submit" className="rounded-full">
            Save entry
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {entries.map((e) => (
          <Card key={e.id} className="rounded-2xl p-5">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(e.created_at).toLocaleString()}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {e.title && <h3 className="font-serif text-lg font-semibold">{e.title}</h3>}
            {e.mood && <p className="text-xs text-primary">{e.mood}</p>}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
