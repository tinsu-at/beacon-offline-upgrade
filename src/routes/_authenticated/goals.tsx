import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  category: "short" | "long";
  deadline: string | null;
  completed: boolean;
};
type Milestone = { id: string; goal_id: string; title: string; completed: boolean };

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — Beacon" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Goal[];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("milestones").select("*").eq("user_id", user!.id);
      return (data ?? []) as Milestone[];
    },
  });

  async function toggleGoal(g: Goal) {
    await supabase.from("goals").update({ completed: !g.completed }).eq("id", g.id);
    qc.invalidateQueries({ queryKey: ["goals"] });
  }
  async function removeGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["goals"] });
    qc.invalidateQueries({ queryKey: ["milestones"] });
  }
  async function toggleMilestone(m: Milestone) {
    await supabase.from("milestones").update({ completed: !m.completed }).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["milestones"] });
  }
  async function addMilestone(goalId: string, title: string) {
    if (!user || !title.trim()) return;
    await supabase.from("milestones").insert({ user_id: user.id, goal_id: goalId, title });
    qc.invalidateQueries({ queryKey: ["milestones"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Goals</h1>
          <p className="text-sm text-muted-foreground">Where you're headed. Short and long.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 rounded-full">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">New goal</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif">New goal</DialogTitle>
            </DialogHeader>
            <GoalForm
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["goals"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {["short", "long"].map((cat) => (
          <div key={cat}>
            <h2 className="mb-2 font-serif text-lg font-semibold capitalize">{cat}-term</h2>
            <div className="space-y-3">
              {goals
                .filter((g) => g.category === cat)
                .map((g) => {
                  const ms = milestones.filter((m) => m.goal_id === g.id);
                  const done = ms.filter((m) => m.completed).length;
                  return (
                    <Card key={g.id} className="hover-lift rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={g.completed}
                          onCheckedChange={() => toggleGoal(g)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p
                            className={
                              g.completed ? "line-through text-muted-foreground" : "font-medium"
                            }
                          >
                            {g.title}
                          </p>
                          {g.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                          )}
                          {g.deadline && (
                            <Badge variant="outline" className="mt-2 rounded-full">
                              By {g.deadline}
                            </Badge>
                          )}

                          <div className="mt-3 space-y-1.5">
                            {ms.map((m) => (
                              <label key={m.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={m.completed}
                                  onCheckedChange={() => toggleMilestone(m)}
                                />
                                <span
                                  className={
                                    m.completed ? "line-through text-muted-foreground" : ""
                                  }
                                >
                                  {m.title}
                                </span>
                              </label>
                            ))}
                            <AddMilestoneInput onAdd={(t) => addMilestone(g.id, t)} />
                          </div>

                          {ms.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {done}/{ms.length} milestones
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeGoal(g.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              {goals.filter((g) => g.category === cat).length === 0 && (
                <Card className="rounded-2xl border-dashed p-6 text-center text-sm text-muted-foreground">
                  No {cat}-term goals yet.
                </Card>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddMilestoneInput({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v);
        setV("");
      }}
      className="flex gap-2"
    >
      <Input
        placeholder="Add milestone"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-8"
      />
      <Button type="submit" size="sm" variant="outline" className="rounded-full">
        Add
      </Button>
    </form>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"short" | "long">("short");
  const [deadline, setDeadline] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title,
      description: description || null,
      category,
      deadline: deadline || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Goal added");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as "short" | "long")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short-term</SelectItem>
              <SelectItem value="long">Long-term</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Deadline</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full rounded-full">
        Add goal
      </Button>
    </form>
  );
}
