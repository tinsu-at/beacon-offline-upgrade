export type ReflectionQuestion = { id: string; label: string; kind: "text" | "yesno" };

export const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  { id: "learned", label: "What did you learn today?", kind: "text" },
  { id: "promises", label: "Did you keep the promises you made to yourself?", kind: "yesno" },
  { id: "helped", label: "Did you help someone today?", kind: "yesno" },
  { id: "comfort_zone", label: "Did you step outside your comfort zone?", kind: "yesno" },
  { id: "accomplished", label: "What did you accomplish today?", kind: "text" },
  { id: "distracted", label: "What distracted you today?", kind: "text" },
  { id: "improve", label: "What is one thing you could improve tomorrow?", kind: "text" },
  {
    id: "beacon",
    label: "Did your actions today make you someone a child would be proud to imitate?",
    kind: "yesno",
  },
];

export type Reflections = Record<string, string>;

const START = "--- Daily reflection ---";

/** Appends the answered reflection questions to the free-form entry text. */
export function withReflections(content: string, answers: Reflections): string {
  const lines = REFLECTION_QUESTIONS.map((q) => {
    const a = (answers[q.id] ?? "").trim();
    return a ? `${q.label}\n${a}` : null;
  }).filter(Boolean) as string[];
  if (lines.length === 0) return content.trim();
  return `${content.trim()}\n\n${START}\n${lines.join("\n\n")}`.trim();
}

/** Splits a stored entry back into its free-form body and reflection answers. */
export function parseEntry(stored: string): { body: string; reflections: Reflections } {
  const idx = stored.indexOf(START);
  if (idx === -1) return { body: stored, reflections: {} };
  const body = stored.slice(0, idx).trim();
  const block = stored.slice(idx + START.length).trim();
  const reflections: Reflections = {};
  for (const chunk of block.split(/\n\s*\n/)) {
    const nl = chunk.indexOf("\n");
    if (nl === -1) continue;
    const label = chunk.slice(0, nl).trim();
    const answer = chunk.slice(nl + 1).trim();
    const q = REFLECTION_QUESTIONS.find((x) => x.label === label);
    if (q && answer) reflections[q.id] = answer;
  }
  return { body, reflections };
}

export function labelFor(id: string) {
  return REFLECTION_QUESTIONS.find((q) => q.id === id)?.label ?? id;
}
