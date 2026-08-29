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
        content: z.string().min(3).max(2000),
        category: z.enum(CATEGORIES).default("fact"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { embedText, toPgVector } = await import("@/lib/embeddings.server");
    const emb = await embedText(data.content);
    const { error } = await context.supabase.from("memories").insert({
      user_id: context.userId,
      content: data.content,
      category: data.category,
      source: "manual",
      embedding: toPgVector(emb) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
