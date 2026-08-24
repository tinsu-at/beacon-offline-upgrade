import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasBotToken } = await import("@/lib/telegram.server");
    const { data } = await context.supabase
      .from("telegram_settings")
      .select("connected, bot_username, automation_enabled, sleeping_mode, connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      tokenConfigured: hasBotToken(),
      connected: data?.connected ?? false,
      botUsername: data?.bot_username ?? null,
      automationEnabled: data?.automation_enabled ?? true,
      sleepingMode: data?.sleeping_mode ?? false,
      connectedAt: data?.connected_at ?? null,
    };
  });

export const testTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getMe, hasBotToken, telegramApi } = await import("@/lib/telegram.server");
    if (!hasBotToken()) {
      return { ok: false as const, error: "TELEGRAM_BOT_TOKEN is not configured." };
    }
    const me = await getMe();
    if (!me.ok) return { ok: false as const, error: me.error };
    const info = await telegramApi<{ url?: string; last_error_message?: string }>("getWebhookInfo");
    return {
      ok: true as const,
      botUsername: me.result.username ?? null,
      webhookUrl: info.ok ? (info.result.url ?? null) : null,
      webhookError: info.ok ? (info.result.last_error_message ?? null) : null,
    };
  });

export const connectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMe, getBotToken, webhookSecret, telegramApi, publicBaseUrl, hasBotToken } =
      await import("@/lib/telegram.server");
    if (!hasBotToken()) {
      return { ok: false as const, error: "TELEGRAM_BOT_TOKEN is not configured." };
    }
    const me = await getMe();
    if (!me.ok) return { ok: false as const, error: me.error };

    const url = `${publicBaseUrl(getRequest().url)}/api/public/telegram/webhook`;
    const reg = await telegramApi("setWebhook", {
      url,
      secret_token: webhookSecret(getBotToken()),
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: true,
    });
    if (!reg.ok) return { ok: false as const, error: reg.error };

    const { error } = await context.supabase.from("telegram_settings").upsert(
      {
        user_id: context.userId,
        connected: true,
        bot_id: me.result.id,
        bot_username: me.result.username ?? null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, botUsername: me.result.username ?? null, webhookUrl: url };
  });

export const disconnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { telegramApi } = await import("@/lib/telegram.server");
    const res = await telegramApi("deleteWebhook", { drop_pending_updates: false });
    await context.supabase
      .from("telegram_settings")
      .update({ connected: false })
      .eq("user_id", context.userId);
    return { ok: res.ok, error: res.ok ? null : res.error };
  });

export const updateTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        automationEnabled: z.boolean().optional(),
        sleepingMode: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, boolean> = {};
    if (data.automationEnabled !== undefined) patch["automation_enabled"] = data.automationEnabled;
    if (data.sleepingMode !== undefined) patch["sleeping_mode"] = data.sleepingMode;
    const { error } = await context.supabase
      .from("telegram_settings")
      .upsert({ user_id: context.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTelegramCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("telegram_customers")
      .select(
        "id, display_name, telegram_username, telegram_chat_id, status, state, notes, handoff_reason, waiting_for_human, handled_while_sleeping, last_interaction, created_at",
      )
      .order("last_interaction", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTelegramConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ customerId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("telegram_messages")
      .select("id, sender, direction, text, created_at")
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setConversationState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        state: z.enum(["BEACON_ACTIVE", "HUMAN_TAKEOVER"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("telegram_customers")
      .update({
        state: data.state,
        waiting_for_human: data.state === "HUMAN_TAKEOVER",
        handoff_reason: data.state === "HUMAN_TAKEOVER" ? "Manual takeover" : null,
      })
      .eq("id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTelegramReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ customerId: z.string().uuid(), text: z.string().min(1).max(3500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: customer, error: cErr } = await context.supabase
      .from("telegram_customers")
      .select("id, telegram_chat_id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (cErr || !customer) return { ok: false as const, error: "Customer not found" };

    const { sendMessage } = await import("@/lib/telegram.server");
    const res = await sendMessage(customer.telegram_chat_id, data.text);
    if (!res.ok) return { ok: false as const, error: res.error };

    await context.supabase.from("telegram_messages").insert({
      owner_id: context.userId,
      customer_id: customer.id,
      direction: "out",
      sender: "human",
      text: data.text,
    });
    await context.supabase
      .from("telegram_customers")
      .update({ waiting_for_human: false, last_interaction: new Date().toISOString() })
      .eq("id", customer.id);
    return { ok: true as const };
  });

export const listStyleExamples = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("telegram_style_examples")
      .select("id, customer_message, owner_reply, tag, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addStyleExample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        customerMessage: z.string().min(2).max(1000),
        ownerReply: z.string().min(1).max(2000),
        tag: z.string().max(60).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("telegram_style_examples").insert({
      owner_id: context.userId,
      customer_message: data.customerMessage,
      owner_reply: data.ownerReply,
      tag: data.tag || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStyleExample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("telegram_style_examples")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Overnight / sleeping-mode summary of Telegram activity. */
export const getOvernightSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: customers, error } = await context.supabase
      .from("telegram_customers")
      .select(
        "id, display_name, telegram_username, status, state, handoff_reason, waiting_for_human, handled_while_sleeping, created_at, last_interaction",
      )
      .gte("last_interaction", since);
    if (error) throw new Error(error.message);
    const rows = customers ?? [];
    const { count } = await context.supabase
      .from("telegram_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    return {
      since,
      newCustomers: rows.filter((c) => c.created_at >= since),
      interested: rows.filter((c) => c.status === "interested"),
      potential: rows.filter((c) => c.status === "potential"),
      needsAttention: rows.filter((c) => c.state === "HUMAN_TAKEOVER"),
      waiting: rows.filter((c) => c.waiting_for_human),
      handledWhileSleeping: rows.filter((c) => c.handled_while_sleeping),
      messageCount: count ?? 0,
    };
  });
