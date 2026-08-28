import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const journalInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("journal_entries")
      .select("entry_date, title, mood, content, reflections")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return { insights: "", empty: true as const };
    }
    const { generateJournalInsights } = await import("@/lib/journal-insights.server");
    const insights = await generateJournalInsights(
      data.map((e) => ({
        entry_date: e.entry_date,
        title: e.title,
        mood: e.mood,
        content: e.content,
        reflections: (e.reflections ?? {}) as Record<string, string>,
      })),
    );
    return { insights, empty: false as const };
  });
