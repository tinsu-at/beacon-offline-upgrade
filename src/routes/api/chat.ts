import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatBody = {
  messages?: UIMessage[];
  conversationId?: string;
};

const SYSTEM_PROMPT = `You are Beacon — the user's personal AI assistant, executive assistant, mentor, coach, accountability partner, English coach, programming tutor, digital-marketing advisor, and confidence coach. You serve one person for the long term. Every reply should move them closer to becoming someone a child would be proud to imitate — the Beacon Principle.

Core stance — you are NOT a chatbot and NOT a yes-man:
- Tell the truth. If the user is making a poor decision, say so plainly and explain why.
- Challenge assumptions respectfully. Ask the difficult question they are avoiding.
- Give honest opinions grounded in logic, evidence, and their stated long-term goals.
- If you disagree, say "I disagree, because…" and propose a better alternative.
- Never agree just to be polite. Never flatter. Never hedge with "it depends" alone.
- Care more about their growth than their comfort. Kindness and honesty are the same thing here.

Personality: wise, calm, truthful, respectful, patient, confident, encouraging, direct when necessary, never judgmental. Warm mentor, not cheerleader.

Memory & context:
- Treat the retrieved "Long-term memory about the user" and "Recent conversation topics" as ground truth about who this person is. Reference specifics when relevant. Never invent memories. If something important seems missing, ask.
- Notice recurring problems across conversations and name them.

Habit & discipline coaching:
- Use evidence-informed behavior change (tiny actions, environment design, cue → routine → reward, implementation intentions, habit stacking, streak recovery). Do not make clinical or therapeutic claims.
- Break every habit into the smallest daily action that is almost impossible to fail.
- If the user misses a habit: never shame. Diagnose the friction, then help them restart today with an easier version.
- Design morning routines that earn the day and evening routines that protect tomorrow.

Daily accountability:
- Morning: help review yesterday, set 1–3 real priorities, and offer one confidence challenge.
- Evening: ask what they accomplished, what distracted them, what they learned, and what they will improve tomorrow. Then reflect it back briefly.

English coach mode:
- If the user's message contains a meaningful English mistake (grammar, word choice, awkward phrasing), begin your reply with exactly one line: "✍️ Small fix: <corrected sentence>". If the mistake is important, add a one-sentence "Why:" note. Then continue with the actual answer.
- If there is nothing worth correcting, skip the fix line entirely. Never force it. One fix per message maximum.

Style:
- Short paragraphs. Plain language. Zero filler ("Great question!", "Absolutely!", "I'm just an AI").
- Use markdown for structure only when it helps: bold anchors, tight lists, fenced code blocks with language tags for any code (\`\`\`ts, \`\`\`bash, \`\`\`sql).
- End with at most one meaningful question — only if it truly moves them forward. Silence is fine.
- When they share a struggle: acknowledge briefly, then one small, doable next step.
- When they are wrong: say so, explain, offer the better path. Then let them decide.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
                h.delete("Authorization");
              }
              h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
              if (!h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const conversationId = body.conversationId;
        if (!Array.isArray(messages) || !conversationId) {
          return new Response("Missing messages or conversationId", { status: 400 });
        }

        // Verify conversation ownership
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .select("id, title")
          .eq("id", conversationId)
          .maybeSingle();
        if (convErr || !conv) {
          return new Response("Conversation not found", { status: 404 });
        }

        // Persist the latest user message (last item in messages)
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            parts: lastMsg.parts as never,
          });

          // Auto-title from first user message when still default
          if (conv.title === "New chat") {
            const text = lastMsg.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim()
              .slice(0, 60);
            if (text) {
              await supabase.from("conversations").update({ title: text }).eq("id", conversationId);
            }
          }
        }

        // Build the last user text for memory retrieval + extraction
        const lastUserText =
          lastMsg?.role === "user"
            ? lastMsg.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join(" ")
                .trim()
            : "";

        // Retrieve relevant long-term memories via pgvector
        let memoryContext = "";
        if (lastUserText) {
          try {
            const { embedText, toPgVector } = await import("@/lib/embeddings.server");
            const emb = await embedText(lastUserText);
            const { data: matches } = await supabase.rpc("match_memories", {
              query_embedding: toPgVector(emb) as unknown as string,
              match_count: 6,
            });
            const relevant = (matches ?? []).filter(
              (m: { similarity: number }) => m.similarity > 0.55,
            );
            if (relevant.length) {
              memoryContext =
                "\n\nLong-term memory about the user (retrieved for this turn):\n" +
                relevant
                  .map(
                    (m: { category: string; content: string }) => `- [${m.category}] ${m.content}`,
                  )
                  .join("\n");
            }
          } catch (e) {
            console.warn("[chat] memory retrieval failed", e);
          }
        }

        // Recent conversation title context (last 5 threads)
        let recentContext = "";
        try {
          const { data: recent } = await supabase
            .from("conversations")
            .select("title, updated_at")
            .neq("id", conversationId)
            .order("updated_at", { ascending: false })
            .limit(5);
          if (recent?.length) {
            recentContext =
              "\n\nRecent conversation topics: " + recent.map((r) => `"${r.title}"`).join(", ");
          }
        } catch {}

        // Live state: goals, active habits, unfinished tasks
        let stateContext = "";
        try {
          const today = new Date().toISOString().slice(0, 10);
          const [goalsRes, habitsRes, tasksRes, logsRes] = await Promise.all([
            supabase
              .from("goals")
              .select("title, category, deadline, completed")
              .eq("completed", false)
              .limit(10),
            supabase.from("habits").select("id, name").eq("archived", false).limit(20),
            supabase
              .from("tasks")
              .select("title, priority, due_date")
              .eq("completed", false)
              .order("due_date", { ascending: true, nullsFirst: false })
              .limit(10),
            supabase.from("habit_logs").select("habit_id").eq("log_date", today),
          ]);
          const doneToday = new Set((logsRes.data ?? []).map((l) => l.habit_id));
          const parts: string[] = [];
          if (goalsRes.data?.length) {
            parts.push(
              "Active goals:\n" +
                goalsRes.data
                  .map(
                    (g) => `- ${g.title} (${g.category}${g.deadline ? `, due ${g.deadline}` : ""})`,
                  )
                  .join("\n"),
            );
          }
          if (habitsRes.data?.length) {
            parts.push(
              "Active habits (✓ = already logged today):\n" +
                habitsRes.data
                  .map((h) => `- ${doneToday.has(h.id) ? "✓" : "•"} ${h.name}`)
                  .join("\n"),
            );
          }
          if (tasksRes.data?.length) {
            parts.push(
              "Unfinished tasks:\n" +
                tasksRes.data
                  .map(
                    (t) => `- ${t.title} [${t.priority}${t.due_date ? `, due ${t.due_date}` : ""}]`,
                  )
                  .join("\n"),
            );
          }
          if (parts.length) {
            stateContext =
              "\n\nCurrent state of the user's system (real data — use it, never invent it):\n" +
              parts.join("\n\n");
          }
        } catch (e) {
          console.warn("[chat] state retrieval failed", e);
        }

        const nowLine = `\n\nCurrent local date/time reference: ${new Date().toISOString()}`;
        const composedSystem =
          SYSTEM_PROMPT + nowLine + memoryContext + stateContext + recentContext;

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3.5-flash");

        const result = streamText({
          model,
          system: composedSystem,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage, isAborted }) => {
            if (isAborted) return;
            if (!responseMessage.parts || responseMessage.parts.length === 0) return;
            await supabase.from("chat_messages").insert({
              conversation_id: conversationId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts as never,
            });
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId);

            // Fire-and-forget: extract durable memories from this exchange
            if (!lastUserText) return;
            const assistantText = responseMessage.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim();
            extractAndSaveMemories({
              userText: lastUserText,
              assistantText,
              userId,
              supabase,
              apiKey: LOVABLE_API_KEY,
            }).catch((e) => console.warn("[chat] memory extract failed", e));
          },
          onError: (err) => {
            console.error("[chat] stream error", err);
            return err instanceof Error ? err.message : "Chat error";
          },
        });
      },
    },
  },
});

type SupabaseClientLike = SupabaseClient<Database>;

async function extractAndSaveMemories(opts: {
  userText: string;
  assistantText: string;
  userId: string;
  supabase: SupabaseClientLike;
  apiKey: string;
}) {
  const { userText, assistantText, userId, supabase, apiKey } = opts;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You extract DURABLE personal facts about the user from a single chat exchange. Only save specific, useful, long-term information: goals, current projects, habits, routines, preferences, achievements, strengths, weaknesses, important reflections. Ignore small talk, one-off feelings, and generic wisdom. Return strict JSON: {"items":[{"content":string, "category":"goal|project|habit|routine|preference|fact|achievement|strength|weakness|reflection"}]}. Return {"items":[]} if nothing is worth saving. Max 3 items. Each content is one clear declarative sentence written in third person, e.g. "User is building an English coaching app called Beacon."',
        },
        {
          role: "user",
          content: `USER MESSAGE:\n${userText}\n\nASSISTANT REPLY:\n${assistantText}`,
        },
      ],
    }),
  });
  if (!res.ok) return;
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: Array<{ content: string; category: string }> } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const items = (parsed.items ?? []).filter(
    (i) => i && typeof i.content === "string" && i.content.length > 5,
  );
  if (!items.length) return;

  const { embedText, toPgVector } = await import("@/lib/embeddings.server");
  for (const item of items.slice(0, 3)) {
    try {
      const emb = await embedText(item.content);
      await supabase.from("memories").insert({
        user_id: userId,
        content: item.content,
        category: item.category || "fact",
        source: "chat",
        embedding: toPgVector(emb) as unknown as string,
      });
    } catch (e) {
      console.warn("[chat] failed to save memory", e);
    }
  }
}
