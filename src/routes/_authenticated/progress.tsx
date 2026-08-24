import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — Beacon" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["progress-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: tasksDone }, { count: journalCount }, { count: goalsDone }, { data: logs }] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("completed", true),
          supabase
            .from("journal_entries")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user!.id),
          supabase
            .from("goals")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("completed", true),
          supabase.from("habit_logs").select("log_date").eq("user_id", user!.id),
        ]);
      return {
        tasksDone: tasksDone ?? 0,
        journalCount: journalCount ?? 0,
        goalsDone: goalsDone ?? 0,
        logs: logs ?? [],
      };
    },
  });

  const last30 = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    const counts = new Map<string, number>();
    for (const l of stats?.logs ?? []) counts.set(l.log_date, (counts.get(l.log_date) ?? 0) + 1);
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: counts.get(key) ?? 0 });
    }
    return days;
  }, [stats]);

  const max = Math.max(1, ...last30.map((d) => d.count));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Progress</h1>
        <p className="text-sm text-muted-foreground">Momentum, one day at a time.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Tasks completed" value={stats?.tasksDone ?? 0} />
        <StatCard label="Journal entries" value={stats?.journalCount ?? 0} />
        <StatCard label="Goals achieved" value={stats?.goalsDone ?? 0} />
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Habit activity — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1.5">
            {last30.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-primary transition-all"
                  style={{
                    height: `${(d.count / max) * 100}%`,
                    minHeight: d.count ? "6%" : "2%",
                    opacity: d.count ? 1 : 0.15,
                  }}
                  title={`${d.date}: ${d.count}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{last30[0]?.date}</span>
            <span>{last30[last30.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="hover-lift rounded-3xl">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-serif text-4xl font-semibold text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}
