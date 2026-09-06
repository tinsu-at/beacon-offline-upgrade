// Per-account feature switches. Everything here is stored on the user's own
// profile row (RLS-protected), so one account can never turn features on for
// another account.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { ReflectionQuestion } from "@/lib/journal-reflections";
import { buildDefaultQuestions } from "@/lib/journal-reflections";

export type ProfileFeatures = {
  telegramEnabled: boolean;
  developerMode: boolean;
  englishCorrection: boolean;
  slogan: string | null;
  journalQuestions: ReflectionQuestion[] | null;
};

function parseQuestions(value: unknown): ReflectionQuestion[] | null {
  if (!Array.isArray(value)) return null;
  const out: ReflectionQuestion[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    if (typeof q.id !== "string" || typeof q.label !== "string") continue;
    out.push({ id: q.id, label: q.label, kind: q.kind === "yesno" ? "yesno" : "text" });
  }
  return out.length ? out : null;
}

export function useProfileRow() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
}

export function useFeatures(): ProfileFeatures & { isLoading: boolean } {
  const { data, isLoading } = useProfileRow();
  const row = data as Record<string, unknown> | null | undefined;
  return {
    isLoading,
    telegramEnabled: row?.telegram_enabled === true,
    developerMode: row?.developer_mode === true,
    englishCorrection: row?.english_correction === true,
    slogan: typeof row?.slogan === "string" && row.slogan.trim() ? (row.slogan as string) : null,
    journalQuestions: parseQuestions(row?.journal_questions),
  };
}

/** The reflection questions this account should see. */
export function useJournalQuestions(): ReflectionQuestion[] {
  const { journalQuestions, slogan } = useFeatures();
  return journalQuestions ?? buildDefaultQuestions(slogan);
}
