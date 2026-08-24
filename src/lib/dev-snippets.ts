// Curated code snippets for the Developer page. Add new snippets here;
// they'll appear in the browser instantly with syntax highlighting,
// copy, download, and (for JS) a sandboxed Run action.

export type Runtime = "javascript" | "typescript" | "html" | "css" | "sql" | "bash" | "json";

export type Snippet = {
  id: string;
  title: string;
  description: string;
  language: Runtime;
  filename: string;
  runnable?: boolean;
  code: string;
};

export const SNIPPETS: Snippet[] = [
  {
    id: "beacon-principle",
    title: "The Beacon Principle",
    description:
      "Ask yourself once a day. Returns a scorecard object based on three quick self-ratings.",
    language: "javascript",
    filename: "beacon-principle.js",
    runnable: true,
    code: `// The Beacon Principle
// "Did your actions today make you someone a child would be proud to imitate?"
function beaconScore({ discipline, honesty, courage }) {
  const total = (discipline + honesty + courage) / 3;
  return {
    total: Number(total.toFixed(2)),
    verdict: total >= 8 ? "Proud to imitate" : total >= 6 ? "On the path" : "Recalibrate",
  };
}

console.log(beaconScore({ discipline: 9, honesty: 8, courage: 7 }));
console.log(beaconScore({ discipline: 4, honesty: 6, courage: 5 }));`,
  },
  {
    id: "habit-streak",
    title: "Habit streak calculator",
    description: "Given an array of ISO date strings, compute the current daily streak.",
    language: "javascript",
    filename: "habit-streak.js",
    runnable: true,
    code: `function currentStreak(dates) {
  const set = new Set(dates);
  const day = 24 * 60 * 60 * 1000;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor = new Date(cursor.getTime() - day);
  }
  return streak;
}

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
console.log("Streak:", currentStreak([today, yesterday]));`,
  },
  {
    id: "fibonacci",
    title: "Fibonacci (memoized)",
    description: "Classic warm-up: memoized Fibonacci with a tiny performance trace.",
    language: "javascript",
    filename: "fibonacci.js",
    runnable: true,
    code: `const memo = new Map();
function fib(n) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);
  const v = fib(n - 1) + fib(n - 2);
  memo.set(n, v);
  return v;
}
const t = performance.now();
const value = fib(40);
console.log("fib(40) =", value, "in", (performance.now() - t).toFixed(2), "ms");`,
  },
  {
    id: "morning-briefing-prompt",
    title: "Morning briefing prompt",
    description:
      "The exact system prompt Beacon uses in the morning. Use as a template for other assistants.",
    language: "typescript",
    filename: "morning-briefing.ts",
    code: `export const morningBriefing = (name: string, priorities: string[]) => \`
You are Beacon, a calm, honest, wise executive assistant for \${name}.
It is morning. Deliver a briefing in 5 short lines:
1) A one-sentence encouragement grounded in the Beacon Principle.
2) Today's date and mission.
3) The top 3 priorities: \${priorities.join(", ")}.
4) One confidence challenge for today.
5) One question that will focus \${name}'s attention.
Be direct. Never flatter. Never agree just to be polite.
\`;`,
  },
  {
    id: "supabase-select",
    title: "Type-safe Supabase select",
    description: "Fetch the current user's active habits with the typed client.",
    language: "typescript",
    filename: "habits-query.ts",
    code: `import { supabase } from "@/integrations/supabase/client";

export async function activeHabits(userId: string) {
  const { data, error } = await supabase
    .from("habits")
    .select("id, name, cadence, archived_at")
    .eq("owner", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}`,
  },
  {
    id: "rls-policy",
    title: "RLS policy: rows owned by auth.uid()",
    description: "The minimal safe pattern for a per-user table on Lovable Cloud.",
    language: "sql",
    filename: "rls.sql",
    code: `alter table public.entries enable row level security;

create policy "read own entries"
  on public.entries for select
  to authenticated
  using (owner = auth.uid());

create policy "insert own entries"
  on public.entries for insert
  to authenticated
  with check (owner = auth.uid());

create policy "update own entries"
  on public.entries for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

create policy "delete own entries"
  on public.entries for delete
  to authenticated
  using (owner = auth.uid());`,
  },
  {
    id: "service-worker-check",
    title: "Check service worker registration",
    description: "Run this in DevTools console to see which SW is controlling Beacon.",
    language: "javascript",
    filename: "sw-check.js",
    runnable: true,
    code: `if (!("serviceWorker" in navigator)) {
  console.log("Service workers are not supported here.");
} else {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (!regs.length) return console.log("No service workers registered.");
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL;
      console.log("SW:", url, "scope:", r.scope);
    }
  });
}`,
  },
  {
    id: "install-hint",
    title: "Install app hint (HTML)",
    description: "Minimal card explaining the install flow on iOS and Android.",
    language: "html",
    filename: "install-hint.html",
    code: `<div class="card">
  <h3>Install Beacon</h3>
  <p><strong>iOS:</strong> Share → Add to Home Screen.</p>
  <p><strong>Android:</strong> Menu → Install app.</p>
  <p><strong>Desktop:</strong> Click the install icon in the address bar.</p>
</div>`,
  },
];
