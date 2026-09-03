import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome to Beacon — set up your assistant" },
      {
        name: "description",
        content:
          "Tell Beacon your goals, why you're here and who you want to become, so it can personalize every reply.",
      },
      { property: "og:title", content: "Welcome to Beacon" },
      {
        property: "og:description",
        content: "A few quick questions so Beacon can personalize itself to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

const QUESTIONS = [
  {
    key: "main_goals" as const,
    label: "What are your main goals?",
    placeholder: "e.g. Finish my degree, get fit, launch a small business.",
  },
  {
    key: "why_beacon" as const,
    label: "Why do you want to use Beacon?",
    placeholder: "e.g. I need someone honest to keep me accountable every day.",
  },
  {
    key: "purpose" as const,
    label: "What kind of person do you want to become?",
    placeholder: "e.g. Calm, disciplined and dependable.",
  },
  {
    key: "improvement_areas" as const,
    label: "What areas do you want Beacon to help you improve?",
    placeholder: "e.g. Focus, English, consistency, confidence.",
  },
  {
    key: "about_me" as const,
    label: "What should Beacon know about you to help you better?",
    placeholder: "e.g. I work nights, I have two kids, I learn best with small steps.",
  },
];

type Answers = Record<(typeof QUESTIONS)[number]["key"], string>;

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const load = useServerFn(getProfile);
  const save = useServerFn(updateProfile);

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => load() });
  const [answers, setAnswers] = useState<Answers>({
    main_goals: "",
    why_beacon: "",
    purpose: "",
    improvement_areas: "",
    about_me: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setAnswers({
      main_goals: profile.main_goals ?? "",
      why_beacon: profile.why_beacon ?? "",
      purpose: profile.purpose ?? "",
      improvement_areas: profile.improvement_areas ?? "",
      about_me: profile.about_me ?? "",
    });
  }, [profile]);

  async function finish(skip: boolean) {
    setSaving(true);
    try {
      await save({
        data: skip
          ? { onboarding_completed: true }
          : { ...answers, onboarding_completed: true },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(skip ? "You can fill this in later from your profile." : "Beacon is set up.");
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-forest text-primary-foreground shadow-soft">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Welcome to Beacon</h1>
          <p className="text-sm text-muted-foreground">
            Five short questions. Skip anything you like — you can change every answer later.
          </p>
        </div>
      </div>

      {QUESTIONS.map((q) => (
        <Card key={q.key} className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-serif text-base">{q.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder={q.placeholder}
              value={answers[q.key]}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full" disabled={saving} onClick={() => finish(false)}>
          Save and continue
        </Button>
        <Button
          variant="ghost"
          className="rounded-full"
          disabled={saving}
          onClick={() => finish(true)}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
