import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Flame, Plus, Trash2 } from "lucide-react";
import { todayISO } from "@/lib/beacon-data";
import { writeOrQueue } from "@/lib/offline";

type Habit = {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  archived: boolean;
};
type Log = { habit_id: string; log_date: string };

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Habits — Beacon" }] }),
  component: HabitsPage,
});

function HabitsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();
  const [newName, setNewName] = useState("");

  const { data: habits = [] } = useQuery({
    queryKey: ["habits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user!.id)
        .eq("archived", false)
        .order("created_at", { ascending: true });
      return (data ?? []) as Habit[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["habit-logs-30", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 60);
      const { data } = await supabase
        .from("habit_logs")
        .select("habit_id, log_date")
        .eq("user_id", user!.id)
        .gte("log_date", start.toISOString().slice(0, 10));
      return (data ?? []) as Log[];
    },
  });

  const streaks = useMemo(() => {
    const byHabit: Record<string, Set<string>> = {};
    for (const l of logs) {
      byHabit[l.habit_id] ??= new Set();
      byHabit[l.habit_id].add(l.log_date);
    }
    const out: Record<string, number> = {};
    for (const h of habits) {
      const set = byHabit[h.id] ?? new Set();
      let s = 0;
      const d = new Date();
      while (set.has(d.toISOString().slice(0, 10))) {
        s++;
        d.setDate(d.getDate() - 1);
      }
      out[h.id] = s;
    }
    return out;
  }, [logs, habits]);

  const todayLogs = useMemo(
    () => new Set(logs.filter((l) => l.log_date === today).map((l) => l.habit_id)),
    [logs, today],
  );

  function patchLogs(fn: (list: Log[]) => Log[]) {
    qc.setQueryData<Log[]>(["habit-logs-30", user?.id], (old) => fn(old ?? []));
  }

  async function toggleToday(habit: Habit) {
    if (!user) return;
    const wasDone = todayLogs.has(habit.id);
    patchLogs((list) =>
      wasDone
        ? list.filter((l) => !(l.habit_id === habit.id && l.log_date === today))
        : [...list, { habit_id: habit.id, log_date: today }],
    );
    try {
      const queued = wasDone
        ? await writeOrQueue({
            label: `Un-log ${habit.name}`,
            table: "habit_logs",
            type: "deleteWhere",
            match: { user_id: user.id, habit_id: habit.id, log_date: today },
          })
        : await writeOrQueue({
            label: `Log ${habit.name}`,
            table: "habit_logs",
            type: "insert",
            values: {
              id: crypto.randomUUID(),
              user_id: user.id,
              habit_id: habit.id,
              log_date: today,
            },
          });
      if (queued) toast.success("Saved offline — will sync later");
      else {
        qc.invalidateQueries({ queryKey: ["habit-logs-30"] });
        qc.invalidateQueries({ queryKey: ["habit-progress"] });
        qc.invalidateQueries({ queryKey: ["weekly-streak"] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update habit");
      qc.invalidateQueries({ queryKey: ["habit-logs-30"] });
    }
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    const id = crypto.randomUUID();
    const name = newName.trim();
    qc.setQueryData<Habit[]>(["habits", user.id], (old) => [
      ...(old ?? []),
      { id, name, icon: null, is_default: false, archived: false },
    ]);
    setNewName("");
    try {
      const queued = await writeOrQueue({
        label: `New habit ${name}`,
        table: "habits",
        type: "insert",
        values: { id, user_id: user.id, name },
      });
      if (queued) toast.success("Saved offline — will sync later");
      else qc.invalidateQueries({ queryKey: ["habits"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add habit");
      qc.invalidateQueries({ queryKey: ["habits"] });
    }
  }

  async function removeHabit(id: string) {
    qc.setQueryData<Habit[]>(["habits", user?.id], (old) => (old ?? []).filter((h) => h.id !== id));
    try {
      const queued = await writeOrQueue({
        label: "Archive habit",
        table: "habits",
        type: "update",
        rowId: id,
        values: { archived: true },
      });
      if (queued) toast.success("Saved offline — will sync later");
      else qc.invalidateQueries({ queryKey: ["habits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove habit");
      qc.invalidateQueries({ queryKey: ["habits"] });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Habits</h1>
        <p className="text-sm text-muted-foreground">Small reps. Compound results.</p>
      </div>

      <form onSubmit={addHabit} className="flex gap-2">
        <Input
          placeholder="Add a custom habit — e.g. Morning walk"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" className="shrink-0 rounded-full">
          <Plus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {habits.map((h) => {
          const done = todayLogs.has(h.id);
          return (
            <Card key={h.id} className="hover-lift flex items-center gap-3 rounded-2xl p-4">
              <button
                aria-label={done ? "Mark as not done" : "Mark done"}
                onClick={() => toggleToday(h)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : "bg-beige text-primary hover:bg-accent"
                }`}
              >
                <Check className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{h.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-xs">
                    <Flame className="mr-1 h-3 w-3 text-gold" />
                    {streaks[h.id] ?? 0} day streak
                  </Badge>
                  {h.is_default && <span className="text-xs text-muted-foreground">Default</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeHabit(h.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
