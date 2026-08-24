import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          getBotToken,
          webhookSecret,
          safeEqual,
          sendMessage,
          redact,
          buildTelegramSystemPrompt,
          generateBeaconReply,
        } = await import("@/lib/telegram.server");

        // 1. Validate the request came from Telegram (shared secret header).
        let expected: string;
        try {
          expected = webhookSecret(getBotToken());
        } catch {
          return new Response("Not configured", { status: 503 });
        }
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const message = update.message ?? update.edited_message;
        const chatId = message?.chat?.id;
        if (typeof update.update_id !== "number" || typeof chatId !== "number") {
          return Response.json({ ok: true, ignored: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 2. Resolve the owner (single connected Beacon account for this bot).
        const { data: settings } = await supabaseAdmin
          .from("telegram_settings")
          .select("user_id, automation_enabled, sleeping_mode, connected")
          .eq("connected", true)
          .order("connected_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!settings) return Response.json({ ok: true, ignored: "not-connected" });
        const ownerId = settings.user_id;

        // 3. Identify / create the customer.
        const from = message?.from;
        const displayName =
          [from?.first_name, from?.last_name].filter(Boolean).join(" ") ||
          from?.username ||
          message?.chat?.title ||
          "Telegram user";

        const { data: existing } = await supabaseAdmin
          .from("telegram_customers")
          .select("id, state, status, display_name, notes, handled_while_sleeping")
          .eq("owner_id", ownerId)
          .eq("telegram_chat_id", chatId)
          .maybeSingle();

        let customer = existing;
        if (!customer) {
          const { data: created, error } = await supabaseAdmin
            .from("telegram_customers")
            .insert({
              owner_id: ownerId,
              telegram_chat_id: chatId,
              telegram_user_id: from?.id ?? null,
              telegram_username: from?.username ?? null,
              display_name: displayName,
              status: "new",
            })
            .select("id, state, status, display_name, notes, handled_while_sleeping")
            .single();
          if (error || !created) {
            console.error("[telegram] customer upsert failed", redact(error?.message ?? ""));
            return Response.json({ ok: true });
          }
          customer = created;
        }

        const text = (message?.text ?? message?.caption ?? "").trim();

        // 4. Store the inbound message; unique (owner_id, update_id) drops
        //    duplicate Telegram retries so we never answer twice.
        const { error: insErr } = await supabaseAdmin.from("telegram_messages").insert({
          owner_id: ownerId,
          customer_id: customer.id,
          update_id: update.update_id,
          direction: "in",
          sender: "customer",
          text: text || "[non-text message]",
        });
        if (insErr) {
          if (insErr.code === "23505") return Response.json({ ok: true, duplicate: true });
          console.error("[telegram] message insert failed", redact(insErr.message));
          return Response.json({ ok: true });
        }

        await supabaseAdmin
          .from("telegram_customers")
          .update({
            last_interaction: new Date().toISOString(),
            telegram_user_id: from?.id ?? null,
            telegram_username: from?.username ?? null,
            display_name: customer.display_name ?? displayName,
          })
          .eq("id", customer.id);

        const sleeping = settings.sleeping_mode === true;
        const automationOn = sleeping || settings.automation_enabled === true;

        // 5. Automation off, or the human took over: record only, flag waiting.
        if (!automationOn || customer.state === "HUMAN_TAKEOVER") {
          await supabaseAdmin
            .from("telegram_customers")
            .update({ waiting_for_human: true })
            .eq("id", customer.id);
          return Response.json({ ok: true, mode: "manual" });
        }

        if (!text) return Response.json({ ok: true, ignored: "no-text" });

        try {
          // 6. Beacon's own memory + owner style, scoped to this owner only.
          const [{ data: profile }, { data: styleRows }, { data: historyRows }] = await Promise.all(
            [
              supabaseAdmin.from("profiles").select("display_name").eq("id", ownerId).maybeSingle(),
              supabaseAdmin
                .from("telegram_style_examples")
                .select("customer_message, owner_reply")
                .eq("owner_id", ownerId)
                .order("created_at", { ascending: false })
                .limit(8),
              supabaseAdmin
                .from("telegram_messages")
                .select("sender, text, created_at")
                .eq("customer_id", customer.id)
                .order("created_at", { ascending: false })
                .limit(16),
            ],
          );

          let memories: string[] = [];
          try {
            const { embedText, toPgVector } = await import("@/lib/embeddings.server");
            const emb = await embedText(text);
            const { data: matches } = await supabaseAdmin.rpc("match_memories", {
              query_embedding: toPgVector(emb) as unknown as string,
              match_count: 6,
              target_user: ownerId,
            });
            memories = (matches ?? [])
              .filter((m: { similarity: number }) => m.similarity > 0.6)
              .map((m: { content: string }) => m.content);
          } catch (e) {
            console.warn("[telegram] memory retrieval skipped", redact(String(e)));
          }

          const system = buildTelegramSystemPrompt({
            ownerName: profile?.display_name ?? "the owner",
            memories,
            styleExamples: styleRows ?? [],
            customer: {
              display_name: customer.display_name,
              status: customer.status,
              notes: customer.notes,
            },
            sleeping,
          });

          const history = (historyRows ?? [])
            .slice()
            .reverse()
            .map((m) => ({
              role: (m.sender === "customer" ? "user" : "assistant") as "user" | "assistant",
              content: m.text ?? "",
            }))
            .filter((m) => m.content);

          const result = await generateBeaconReply({ system, history });
          const replyText =
            result.reply ||
            "Thanks for reaching out — let me check on this and come back to you shortly.";

          const sent = await sendMessage(chatId, replyText);
          if (!sent.ok) {
            console.error("[telegram] sendMessage failed", sent.status, sent.error);
            return Response.json({ ok: true, sendFailed: true });
          }

          await supabaseAdmin.from("telegram_messages").insert({
            owner_id: ownerId,
            customer_id: customer.id,
            direction: "out",
            sender: "beacon",
            text: replyText,
          });

          await supabaseAdmin
            .from("telegram_customers")
            .update({
              status: result.status || customer.status,
              state: result.handoff ? "HUMAN_TAKEOVER" : customer.state,
              handoff_reason: result.handoff ? result.handoff_reason || "Beacon escalated" : null,
              waiting_for_human: result.handoff,
              handled_while_sleeping: customer.handled_while_sleeping || sleeping,
            })
            .eq("id", customer.id);

          return Response.json({ ok: true, handoff: result.handoff });
        } catch (e) {
          console.error("[telegram] reply generation failed", redact(String(e)));
          await supabaseAdmin
            .from("telegram_customers")
            .update({ waiting_for_human: true, handoff_reason: "Beacon could not reply" })
            .eq("id", customer.id);
          return Response.json({ ok: true, error: true });
        }
      },
    },
  },
});

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type TelegramMessage = {
  text?: string;
  caption?: string;
  chat?: { id?: number; title?: string };
  from?: { id?: number; username?: string; first_name?: string; last_name?: string };
};
