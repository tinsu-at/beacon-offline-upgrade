import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Explicit, owner-driven memory sharing. Nothing is ever shared automatically:
 * the owner picks one memory and one recipient (by Beacon user id), and can
 * revoke it at any time. Access is enforced by database policies, not the UI.
 */

export const listMyShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memory_shares")
      .select("id, memory_id, recipient_id, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSharedWithMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memory_shares")
      .select("id, owner_id, created_at, memories(id, content, category, created_at)")
      .eq("recipient_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const shareMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ memoryId: z.string().uuid(), recipientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.recipientId === context.userId) throw new Error("That is your own account.");
    const { error } = await context.supabase.from("memory_shares").insert({
      memory_id: data.memoryId,
      owner_id: context.userId,
      recipient_id: data.recipientId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memory_shares")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
