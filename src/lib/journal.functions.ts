import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseEntry, labelFor } from "@/lib/journal-reflections";

export const journalInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("journal_entries")
      .select("entry_date, title, mood, content")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return { insights: "", empty: true as const };
    }
    const { generateJournalInsights } = await import("@/lib/journal-insights.server");
    const insights = await generateJournalInsights(
      data.map((e) => {
        const { body, reflections } = parseEntry(e.content ?? "");
        return {
          entry_date: e.entry_date,
          title: e.title,
          mood: e.mood,
          content: body,
          reflections: Object.fromEntries(
            Object.entries(reflections).map(([k, v]) => [labelFor(k), v]),
          ),
        };
      }),
    );
    return { insights, empty: false as const };
  });
