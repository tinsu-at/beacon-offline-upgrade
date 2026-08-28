import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Sparkles, Trash2 } from "lucide-react";
import { writeOrQueue } from "@/lib/offline";
import { journalInsights } from "@/lib/journal.functions";
import {
  REFLECTION_QUESTIONS,
  labelFor,
  parseEntry,
  withReflections,
  type Reflections,
} from "@/lib/journal-reflections";

type Entry = {
  id: string;
  title: string | null;
  content: string;
  mood: string | null;
  entry_date: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Beacon" },
      {
        name: "description",
        content:
          "Write your daily journal entry, answer Beacon's reflection questions, and get AI summaries of your progress.",
      },
    ],
  }),
  component: JournalPage,
});

function JournalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [answers, setAnswers] = useState<Reflections>({});

  const getInsights = useServerFn(journalInsights);
  const insights = useMutation({
    mutationFn: () => getInsights({ data: undefined }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not generate insights"),
  });

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

  function setAnswer(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const hasAnswers = Object.values(answers).some((v) => v && v.trim());
    if (!content.trim() && !hasAnswers) return;
    const row = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: title || null,
      content: withReflections(content, answers),
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
    setAnswers({});
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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Journal</h1>
        <p className="text-sm text-muted-foreground">{formatLongDate()}</p>
      </div>

      <Card className="rounded-3xl p-4 shadow-elegant sm:p-6">
        <form onSubmit={submit} className="space-y-5">
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
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write freely. What went well? What would you do differently?"
            />
          </div>

          <div className="space-y-4 rounded-2xl bg-muted/40 p-4">
            <div>
              <h2 className="font-serif text-lg font-semibold">Daily reflection questions</h2>
              <p className="text-xs text-muted-foreground">
                Answer what you can — short answers are perfect.
              </p>
            </div>
            {REFLECTION_QUESTIONS.map((q) => (
              <div key={q.id} className="space-y-2">
                <Label className="text-sm font-normal leading-snug">{q.label}</Label>
                {q.kind === "yesno" ? (
                  <div className="flex flex-wrap gap-2">
                    {["Yes", "Not today"].map((opt) => (
                      <Button
                        key={opt}
                        type="button"
                        size="sm"
                        variant={answers[q.id] === opt ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setAnswer(q.id, answers[q.id] === opt ? "" : opt)}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    rows={2}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder="Keep it simple..."
                  />
                )}
              </div>
            ))}
          </div>

          <Button type="submit" className="rounded-full">
            Save entry
          </Button>
        </form>
      </Card>

      <Card className="rounded-3xl p-4 shadow-elegant sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">AI journal insights</h2>
            <p className="text-xs text-muted-foreground">
              Summary, recurring themes, progress to celebrate and suggested improvements.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={insights.isPending}
            onClick={() => insights.mutate()}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {insights.isPending ? "Reflecting..." : "Generate"}
          </Button>
        </div>
        {insights.data?.empty && (
          <p className="mt-3 text-sm text-muted-foreground">
            Write a few entries first and Beacon will find the patterns.
          </p>
        )}
        {insights.data?.insights && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
            {insights.data.insights}
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {entries.map((e) => {
          const { body, reflections } = parseEntry(e.content ?? "");
          const answered = Object.entries(reflections);
          return (
            <Card key={e.id} className="rounded-2xl p-5">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(e.created_at).toLocaleString()}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {e.title && <h3 className="font-serif text-lg font-semibold">{e.title}</h3>}
              {e.mood && <p className="text-xs text-primary">{e.mood}</p>}
              {body && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>}
              {answered.length > 0 && (
                <dl className="mt-4 space-y-2 border-t pt-3">
                  {answered.map(([id, value]) => (
                    <div key={id}>
                      <dt className="text-xs text-muted-foreground">{labelFor(id)}</dt>
                      <dd className="text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
