import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CATEGORIES = [
  "goal",
  "project",
  "habit",
  "routine",
  "preference",
  "fact",
  "achievement",
  "strength",
  "weakness",
  "reflection",
] as const;

export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memories")
      .select("id, content, category, source, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        content: z.string().min(3).max(2000),
        category: z.enum(CATEGORIES).default("fact"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { embedText, toPgVector } = await import("@/lib/embeddings.server");
    let embedding: string | null = null;
    try {
      embedding = toPgVector(await embedText(data.content));
    } catch {
      embedding = null;
    }
    const { data: row, error } = await context.supabase
      .from("memories")
      .insert({
        ...(data.id ? { id: data.id } : {}),
        user_id: context.userId,
        content: data.content,
        category: data.category,
        source: "manual",
        ...(embedding ? { embedding: embedding as unknown as string } : {}),
      })
      .select("id, content, category, source, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Memories that landed through the offline outbox have no embedding, so they
 * would never be retrieved in chat. Fill them in once the device is back online.
 */
export const embedMissingMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("memories")
      .select("id, content")
      .is("embedding", null)
      .limit(25);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { embedded: 0 };
    const { embedText, toPgVector } = await import("@/lib/embeddings.server");
    let embedded = 0;
    for (const row of rows) {
      try {
        const vec = toPgVector(await embedText(row.content));
        await context.supabase
          .from("memories")
          .update({ embedding: vec as unknown as string })
          .eq("id", row.id);
        embedded++;
      } catch {
        // Skip; a later sync will retry.
      }
    }
    return { embedded };
  });


export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        content: z.string().min(3).max(2000),
        category: z.enum(CATEGORIES),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { embedText, toPgVector } = await import("@/lib/embeddings.server");
    let embedding: string | null = null;
    try {
      embedding = toPgVector(await embedText(data.content));
    } catch {
      embedding = null;
    }
    const { error } = await context.supabase
      .from("memories")
      .update({
        content: data.content,
        category: data.category,
        ...(embedding ? { embedding: embedding as unknown as string } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("memories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
