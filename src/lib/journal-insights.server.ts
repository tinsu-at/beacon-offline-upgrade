const RESPONSES_URL = "https://ai.gateway.lovable.dev/v1/responses";

export type JournalEntryForAi = {
  entry_date: string;
  title?: string | null;
  mood?: string | null;
  content: string;
  reflections?: Record<string, string> | null;
};

function renderEntries(entries: JournalEntryForAi[]) {
  return entries
    .map((e) => {
      const answers = Object.entries(e.reflections ?? {})
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join("\n");
      return [
        `Date: ${e.entry_date}`,
        e.title ? `Title: ${e.title}` : null,
        e.mood ? `Mood: ${e.mood}` : null,
        `Entry: ${e.content}`,
        answers ? `Reflections:\n${answers}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n")
    .slice(0, 40000);
}

export async function generateJournalInsights(
  entries: JournalEntryForAi[],
  personalContext?: string,
): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const prompt = [
    "You are Beacon, a warm but direct personal growth coach.",
    personalContext
      ? `Personalize everything to this user, in their own words:\n${personalContext}`
      : "You have no profile for this user yet — do not assume their values or purpose.",
    "Read the user's recent journal entries and daily reflection answers, then reply in markdown with exactly these four short sections:",
    "## Summary — 2-4 sentences summarising the period.",
    "## Recurring themes — 3-5 bullets naming patterns you notice.",
    "## Progress to celebrate — 2-4 bullets of genuine wins, promises kept, comfort zones stepped out of, people helped.",
    "## Suggested improvements — 2-4 concrete, small, doable suggestions for tomorrow.",
    "Be specific, quote small details from the entries, and keep the whole reply under 350 words.",
    "",
    "ENTRIES:",
    renderEntries(entries),
  ].join("\n");

  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      input: prompt,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && !text && evt.response?.output_text) {
          text = evt.response.output_text;
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  return text.trim();
}
