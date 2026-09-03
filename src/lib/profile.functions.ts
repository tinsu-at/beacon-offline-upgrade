import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PROFILE_COLUMNS =
  "id, display_name, avatar_url, purpose, main_goals, why_beacon, improvement_areas, about_me, preferences, memory_enabled, onboarding_completed, onboarding_completed_at";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;

    // Self-heal: a profile row should always exist for a signed-in user.
    const { data: created, error: insErr } = await context.supabase
      .from("profiles")
      .insert({ id: context.userId })
      .select(PROFILE_COLUMNS)
      .single();
    if (insErr) throw new Error(insErr.message);
    return created;
  });

const profileInput = z.object({
  display_name: z.string().max(120).nullable().optional(),
  purpose: z.string().max(2000).nullable().optional(),
  main_goals: z.string().max(2000).nullable().optional(),
  why_beacon: z.string().max(2000).nullable().optional(),
  improvement_areas: z.string().max(2000).nullable().optional(),
  about_me: z.string().max(4000).nullable().optional(),
  memory_enabled: z.boolean().optional(),
  onboarding_completed: z.boolean().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => profileInput.parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { ...data, id: context.userId };
    if (data.onboarding_completed) patch['onboarding_completed_at'] = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("profiles")
      .upsert(patch, { onConflict: "id" })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
