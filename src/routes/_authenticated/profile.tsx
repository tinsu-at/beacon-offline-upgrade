import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your profile — Beacon" },
      {
        name: "description",
        content:
          "View and update your purpose, goals, areas to improve and the personal context Beacon uses.",
      },
      { property: "og:title", content: "Your Beacon profile" },
      {
        property: "og:description",
        content: "Update the purpose, goals and context that personalize Beacon for you.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const FIELDS = [
  { key: "purpose" as const, label: "Purpose — who you want to become" },
  { key: "main_goals" as const, label: "Main goals" },
  { key: "improvement_areas" as const, label: "Areas to improve" },
  { key: "why_beacon" as const, label: "Why you use Beacon" },
  { key: "about_me" as const, label: "Anything else Beacon should know" },
];

function ProfilePage() {
  const qc = useQueryClient();
  const load = useServerFn(getProfile);
  const save = useServerFn(updateProfile);
  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => load() });

  const [displayName, setDisplayName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setValues({
      purpose: profile.purpose ?? "",
      main_goals: profile.main_goals ?? "",
      improvement_areas: profile.improvement_areas ?? "",
      why_beacon: profile.why_beacon ?? "",
      about_me: profile.about_me ?? "",
    });
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: { display_name: displayName.trim() || null, ...values } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
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
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Your profile</h1>
          <p className="text-sm text-muted-foreground">
            Beacon uses this to personalize its coaching for you — nobody else can see it.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Personalization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What should Beacon call you?"
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Textarea
                id={f.key}
                rows={3}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button className="rounded-full" disabled={saving} onClick={handleSave}>
            Save profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
