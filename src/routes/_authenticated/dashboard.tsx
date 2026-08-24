import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  challengeOfDay,
  formatLongDate,
  greeting,
  missionOfDay,
  quoteOfDay,
  todayISO,
} from "@/lib/beacon-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookText,
  CheckSquare,
  Flame,
  MessageCircle,
  Quote,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Beacon" }] }),
  component: Dashboard,
});

function CircularProgress({
  value,
  size = 88,
  stroke = 8,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="color-mix(in oklab, var(--color-primary) 12%, transparent)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--color-primary)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)" }}
      />
    </svg>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const today = todayISO();
  const quote = quoteOfDay(today);
  const challenge = challengeOfDay(today);
  const mission = missionOfDay(today);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: topTask } = useQuery({
    queryKey: ["top-task", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user!.id)
        .eq("completed", false)
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: habitProgress } = useQuery({
    queryKey: ["habit-progress", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data: habits } = await supabase
        .from("habits")
        .select("id,name")
        .eq("user_id", user!.id)
        .eq("archived", false);
      const { data: logs } = await supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", user!.id)
        .eq("log_date", today);
      const doneIds = Array.from(new Set((logs ?? []).map((l) => l.habit_id)));
      return { total: habits?.length ?? 0, done: doneIds.length, habits: habits ?? [], doneIds };
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["weekly-streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("habit_logs")
        .select("log_date")
        .eq("user_id", user!.id)
        .gte("log_date", startStr);
      const days = new Set((data ?? []).map((d) => d.log_date));
      return days.size;
    },
  });

  const { data: goals } = useQuery({
    queryKey: ["goals-open", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("goals")
        .select("id,title,completed")
        .eq("user_id", user!.id)
        .eq("completed", false)
        .limit(2);
      const list = rows ?? [];
      const withProgress = await Promise.all(
        list.map(async (g) => {
          const { data: ms } = await supabase
            .from("milestones")
            .select("completed")
            .eq("goal_id", g.id);
          const total = ms?.length ?? 0;
          const done = (ms ?? []).filter((m) => m.completed).length;
          return { id: g.id, title: g.title, progress: done, target: total };
        }),
      );
      return withProgress;
    },
  });

  const { data: achievements } = useQuery({
    queryKey: ["recent-achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,updated_at")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .order("updated_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const pct =
    habitProgress && habitProgress.total > 0
      ? Math.round((habitProgress.done / habitProgress.total) * 100)
      : 0;
  const streakPct = Math.round(((streak ?? 0) / 7) * 100);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      {/* Hero */}
      <section className="animate-fade-up gradient-hero relative overflow-hidden rounded-3xl border border-border/60 p-6 shadow-soft md:p-10">
        <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-rose/50 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl animate-float" />
        <p className="text-sm text-muted-foreground">{formatLongDate()}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight md:text-5xl">
          {greeting()}, {profile?.display_name ?? "friend"}.
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg">
          Let's become someone a child would be proud to imitate.
        </p>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="glass-panel max-w-xl rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Today's mission
            </div>
            <p className="mt-1.5 font-serif text-lg leading-snug md:text-xl">{mission}</p>
          </div>
          <Button asChild size="lg" className="rounded-full shadow-elegant">
            <Link to="/chat">
              <MessageCircle className="mr-1 h-4 w-4" /> Chat with Beacon
            </Link>
          </Button>
        </div>
      </section>

      {/* Priority + Confidence challenge */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-fade-up hover-lift rounded-3xl border-border/70 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-4 w-4 text-primary" /> Today's top priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topTask ? (
              <>
                <p className="font-serif text-xl leading-snug">{topTask.title}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full capitalize">
                    {topTask.priority}
                  </Badge>
                  {topTask.due_date && (
                    <span className="text-xs text-muted-foreground">Due {topTask.due_date}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing pressing. Plan a small win →</p>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-4 px-0 text-primary hover:bg-transparent"
            >
              <Link to="/tasks">Open tasks →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="animate-fade-up hover-lift rounded-3xl border-transparent bg-primary text-primary-foreground shadow-elegant">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Confidence challenge</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-lg leading-snug">{challenge}</p>
            <Button asChild size="sm" variant="secondary" className="mt-4 rounded-full">
              <Link to="/habits">Log it</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Habits + Streak + Quote */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-fade-up hover-lift rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-primary" /> Today's habits
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="relative">
              <CircularProgress value={pct} />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center leading-none">
                  <div className="font-serif text-xl font-semibold">{pct}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    done
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-serif text-2xl font-semibold">
                  {habitProgress?.done ?? 0}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  / {habitProgress?.total ?? 0} completed
                </span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {(habitProgress?.habits ?? []).slice(0, 3).map((h) => {
                  const done = habitProgress?.doneIds?.includes(h.id);
                  return (
                    <li key={h.id} className="flex items-center gap-2 truncate">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? "bg-primary" : "bg-border"}`}
                      />
                      <span className={`truncate ${done ? "line-through" : ""}`}>{h.name}</span>
                    </li>
                  );
                })}
              </ul>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mt-2 px-0 text-primary hover:bg-transparent"
              >
                <Link to="/habits">Open habits →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up hover-lift rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" /> Weekly streak
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="relative">
              <CircularProgress value={streakPct} />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center leading-none">
                  <div className="font-serif text-xl font-semibold">{streak ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    / 7d
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                Days active this week. Small reps compound into character.
              </p>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mt-2 px-0 text-primary hover:bg-transparent"
              >
                <Link to="/progress">See progress →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up hover-lift rounded-3xl border-border/70 bg-rose/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              <Quote className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Quote of the day</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-lg leading-snug">"{quote.text}"</p>
            <p className="mt-2 text-xs text-muted-foreground">— {quote.author}</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals + Achievements + Journal */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-fade-up hover-lift rounded-3xl md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" /> Goal progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(goals ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active goals yet. Set one to start climbing.
              </p>
            )}
            {(goals ?? []).map((g) => {
              const t = g.target ?? 0;
              const p = g.progress ?? 0;
              const pctG = t > 0 ? Math.round((p / t) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{g.title}</span>
                    <span className="text-xs text-muted-foreground">{pctG}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-700"
                      style={{ width: `${pctG}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="px-0 text-primary hover:bg-transparent"
            >
              <Link to="/goals">Manage goals →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="animate-fade-up hover-lift rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-primary" /> Recent achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(achievements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Complete a task to see it here.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {achievements!.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="truncate">{a.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journal shortcut */}
      <Card className="animate-fade-up hover-lift rounded-3xl border-border/70">
        <CardContent className="flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose text-primary shadow-soft">
              <BookText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-serif text-lg font-semibold">Journal a moment</h3>
              <p className="text-sm text-muted-foreground">
                A short reflection today shapes a clearer mind tomorrow.
              </p>
            </div>
          </div>
          <Button asChild className="rounded-full">
            <Link to="/journal">Open journal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
