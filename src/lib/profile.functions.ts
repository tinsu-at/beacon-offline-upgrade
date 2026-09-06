import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PROFILE_COLUMNS =
  "id, display_name, avatar_url, purpose, main_goals, why_beacon, improvement_areas, about_me, preferences, memory_enabled, onboarding_completed, onboarding_completed_at, telegram_enabled, developer_mode, english_correction, slogan, journal_questions";

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

const questionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(300),
  kind: z.enum(["text", "yesno"]),
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
  developer_mode: z.boolean().optional(),
  english_correction: z.boolean().optional(),
  slogan: z.string().max(300).nullable().optional(),
  journal_questions: z.array(questionSchema).max(30).nullable().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => profileInput.parse(i))
  .handler(async ({ data, context }) => {
    const patch = {
      ...data,
      id: context.userId,
      ...(data.onboarding_completed ? { onboarding_completed_at: new Date().toISOString() } : {}),
    };
    const { data: row, error } = await context.supabase
      .from("profiles")
      .upsert(patch, { onConflict: "id" })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Creates a short personal slogan from the user's own onboarding answers.
 * Never reuses another account's slogan.
 */
export const generateSlogan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("purpose, main_goals, why_beacon, improvement_areas, about_me, slogan")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) return { slogan: null as string | null };

    const answers = [
      profile.purpose && `Who they want to become: ${profile.purpose}`,
      profile.main_goals && `Goals: ${profile.main_goals}`,
      profile.why_beacon && `Why they use Beacon: ${profile.why_beacon}`,
      profile.improvement_areas && `Areas to improve: ${profile.improvement_areas}`,
      profile.about_me && `About them: ${profile.about_me}`,
    ]
      .filter(Boolean)
      .join("\n");
    if (!answers.trim()) return { slogan: null as string | null };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { slogan: null as string | null };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          {
            role: "system",
            content:
              'Write ONE short personal slogan (max 12 words) for this person, in their own spirit, based only on what they wrote. It must be a single sentence, motivating, concrete, no quotes, no emojis, no hashtags. Reply with JSON: {"slogan": string}.',
          },
          { role: "user", content: answers },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { slogan: null as string | null };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let slogan: string | null = null;
    try {
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
        slogan?: string;
      };
      if (typeof parsed.slogan === "string" && parsed.slogan.trim()) {
        slogan = parsed.slogan.trim().slice(0, 200);
      }
    } catch {
      slogan = null;
    }
    if (!slogan) return { slogan: null as string | null };

    await context.supabase.from("profiles").update({ slogan }).eq("id", context.userId);
    return { slogan };
  });
