import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { todayISO } from "@/lib/beacon-data";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export function BeaconReflection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "improve" | "done">("ask");
  const [note, setNote] = useState("");
  const [madeProud, setMadeProud] = useState<boolean | null>(null);
  const today = todayISO();

  useEffect(() => {
    if (!user) return;
    const h = new Date().getHours();
    if (h < 19) return; // only after 7pm
    (async () => {
      const { data } = await supabase
        .from("beacon_reflections")
        .select("id")
        .eq("user_id", user.id)
        .eq("reflection_date", today)
        .maybeSingle();
      if (!data) setOpen(true);
    })();
  }, [user, today]);

  async function submit(proud: boolean, improvement?: string) {
    if (!user) return;
    const { error } = await supabase.from("beacon_reflections").upsert(
      {
        user_id: user.id,
        reflection_date: today,
        made_proud: proud,
        improvement_note: improvement ?? null,
      },
      { onConflict: "user_id,reflection_date" },
    );
    if (error) return toast.error(error.message);
    setStep("done");
    setTimeout(() => setOpen(false), 1800);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-beige text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center font-serif text-xl">The Beacon Principle</DialogTitle>
          <DialogDescription className="text-center">
            Did your actions today make you someone a child would be proud to imitate?
          </DialogDescription>
        </DialogHeader>

        {step === "ask" && (
          <div className="flex justify-center gap-3 pt-2">
            <Button
              className="rounded-full"
              onClick={() => {
                setMadeProud(true);
                submit(true);
              }}
            >
              Yes
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setMadeProud(false);
                setStep("improve");
              }}
            >
              Not today
            </Button>
          </div>
        )}

        {step === "improve" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              That's okay. What is one thing you can improve tomorrow?
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="One small improvement..."
              rows={3}
            />
            <Button className="w-full rounded-full" onClick={() => submit(false, note)}>
              Save reflection
            </Button>
          </div>
        )}

        {step === "done" && (
          <p className="pt-2 text-center text-sm text-muted-foreground">
            {madeProud
              ? "Beautiful. Keep going — consistency is the compound interest of character."
              : "Tomorrow is a fresh page. You've got this."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
