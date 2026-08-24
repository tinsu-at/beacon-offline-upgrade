// Server-only Telegram helpers. Never import this from client code.
// The bot token is read from process.env inside functions only and is never
// returned to the browser or written to logs.
import { createHash, timingSafeEqual } from "crypto";

const TELEGRAM_API = "https://api.telegram.org";

export function getBotToken(): string {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export function hasBotToken(): boolean {
  return Boolean(process.env["TELEGRAM_BOT_TOKEN"]);
}

/** Deterministic per-token webhook secret. Never leaves the server. */
export function webhookSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Redacts anything that looks like a bot token before logging. */
export function redact(input: unknown): string {
  const text = typeof input === "string" ? input : String(input);
  return text.replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "[redacted-token]");
}

export async function telegramApi<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string; status: number }> {
  const token = getBotToken();
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        status: res.status,
        error: redact(json.description ?? `Telegram API error ${res.status}`),
      };
    }
    return { ok: true, result: json.result as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: redact(e instanceof Error ? e.message : "Network error"),
    };
  }
}

export type BotInfo = { id: number; username?: string; first_name?: string };

export async function getMe() {
  return telegramApi<BotInfo>("getMe");
}

export async function sendMessage(chatId: number, text: string) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
  });
}

/**
 * Public base URL Telegram should call. Uses the stable dev/published host so
 * the webhook keeps working across deploys.
 */
export function publicBaseUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  let host = url.host;
  if (host.startsWith("id-preview--")) {
    const rest = host.slice("id-preview--".length);
    const dot = rest.indexOf(".");
    host = `project--${rest.slice(0, dot)}-dev${rest.slice(dot)}`;
  }
  return `https://${host}`;
}

export const HANDOFF_TRIGGERS = [
  "customer explicitly asks for the owner / a human",
  "payment, bank details, or money transfer is involved",
  "refunds or cancellations",
  "special discount or price negotiation requests",
  "you do not know the answer or are uncertain",
  "customer is seriously angry or complaining",
  "any decision you are not authorized to make",
];

export function buildTelegramSystemPrompt(opts: {
  ownerName: string;
  memories: string[];
  styleExamples: Array<{ customer_message: string; owner_reply: string }>;
  customer: { display_name: string | null; status: string; notes: string | null };
  sleeping: boolean;
}): string {
  const { ownerName, memories, styleExamples, customer, sleeping } = opts;
  return `You are Beacon, replying on Telegram on behalf of ${ownerName}. You are talking to a CUSTOMER, not to ${ownerName}.

Personality (same Beacon voice): calm, honest, warm, respectful, direct, never robotic, never flowery corporate AI. Short human messages. No "As an AI". No filler. Match the customer's language (English, Amharic, or mixed) and keep messages chat-sized.

ABSOLUTE SAFETY RULES — never break these:
- Never invent prices, discounts, availability, delivery times, policies, payment details, or promises. If it is not in the context below, you do not know it.
- Never share anything about ${ownerName}'s private life, other customers, or other conversations. Only use the business context provided.
- When unsure, say you will confirm with ${ownerName} and hand off.
- Never make a high-risk business decision on your own.

HAND OFF to ${ownerName} when any of these apply:
${HANDOFF_TRIGGERS.map((t) => `- ${t}`).join("\n")}

${sleeping ? "SLEEPING MODE is ON: " + ownerName + " is unavailable. Answer normal questions and FAQs, collect the customer's name and what they need, qualify their interest politely, and tell them " + ownerName + " will follow up. Escalate anything important." : ""}

Customer: ${customer.display_name ?? "unknown"} (status: ${customer.status})${customer.notes ? `\nNotes about this customer: ${customer.notes}` : ""}

${memories.length ? `Business knowledge from ${ownerName} (ground truth — use only this):\n${memories.map((m) => `- ${m}`).join("\n")}` : `No business knowledge is available yet, so you must not state any facts about services or prices.`}

${
  styleExamples.length
    ? `How ${ownerName} writes (imitate tone, length, vocabulary, greetings, emoji habits — NEVER reuse the private details in them):\n` +
      styleExamples
        .map((e) => `Customer: "${e.customer_message}"\n${ownerName}: "${e.owner_reply}"`)
        .join("\n\n")
    : ""
}

Reply with strict JSON only:
{"reply": string, "handoff": boolean, "handoff_reason": string, "status": "new"|"interested"|"potential"|"customer"|"question"}
"reply" is the exact message to send to the customer. If handoff is true, "reply" should politely say you will check with ${ownerName} and get back to them.`;
}

export type BeaconReply = {
  reply: string;
  handoff: boolean;
  handoff_reason: string;
  status: string;
};

/** Reuses the existing Lovable AI Gateway (Gemini) used by Beacon chat. */
export async function generateBeaconReply(opts: {
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<BeaconReply> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: opts.system }, ...opts.history],
    }),
  });
  if (!res.ok) {
    const status = res.status;
    if (status === 429) throw new Error("AI rate limit reached");
    throw new Error(`AI gateway error ${status}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<BeaconReply> = {};
  try {
    parsed = JSON.parse(raw) as Partial<BeaconReply>;
  } catch {
    parsed = {};
  }
  return {
    reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "",
    handoff: parsed.handoff === true,
    handoff_reason: typeof parsed.handoff_reason === "string" ? parsed.handoff_reason : "",
    status: typeof parsed.status === "string" ? parsed.status : "new",
  };
}
