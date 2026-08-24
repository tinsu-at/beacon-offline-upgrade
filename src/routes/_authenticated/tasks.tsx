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
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { writeOrQueue } from "@/lib/offline";

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  completed: boolean;
};

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Beacon" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user!.id)
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      return (data ?? []) as Task[];
    },
  });

  function patchCache(fn: (list: Task[]) => Task[]) {
    qc.setQueryData<Task[]>(["tasks", user?.id], (old) => fn(old ?? []));
  }

  async function toggle(t: Task) {
    patchCache((list) => list.map((x) => (x.id === t.id ? { ...x, completed: !t.completed } : x)));
    try {
      const queued = await writeOrQueue({
        label: `Task "${t.title}"`,
        table: "tasks",
        type: "update",
        rowId: t.id,
        values: {
          completed: !t.completed,
          completed_at: !t.completed ? new Date().toISOString() : null,
        },
      });
      if (queued) toast.success("Saved offline — will sync later");
      else {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["top-task"] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update task");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  }

  async function remove(id: string) {
    patchCache((list) => list.filter((x) => x.id !== id));
    try {
      const queued = await writeOrQueue({
        label: "Delete task",
        table: "tasks",
        type: "delete",
        rowId: id,
      });
      if (queued) toast.success("Deleted offline — will sync later");
      else qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete task");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Daily planner</h1>
          <p className="text-sm text-muted-foreground">Create today. Ship today.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="shrink-0 rounded-full">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">New task</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif">{editing ? "Edit task" : "New task"}</DialogTitle>
            </DialogHeader>
            <TaskForm
              task={editing}
              onDone={() => {
                setOpen(false);
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["tasks"] });
                qc.invalidateQueries({ queryKey: ["top-task"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <Card className="rounded-3xl border-dashed p-10 text-center text-sm text-muted-foreground">
            No tasks yet — add your first one.
          </Card>
        )}
        {tasks.map((t) => (
          <Card key={t.id} className="hover-lift flex items-start gap-3 rounded-2xl p-4">
            <Checkbox checked={t.completed} onCheckedChange={() => toggle(t)} className="mt-1" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={t.completed ? "line-through text-muted-foreground" : "font-medium"}
                >
                  {t.title}
                </span>
                <Badge variant="outline" className="rounded-full capitalize">
                  {t.priority}
                </Badge>
                {t.due_date && (
                  <span className="text-xs text-muted-foreground">Due {t.due_date}</span>
                )}
              </div>
              {t.description && (
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(t);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const payload = {
      title,
      description: description || null,
      priority,
      due_date: dueDate || null,
      user_id: user.id,
    };
    try {
      const queued = task
        ? await writeOrQueue({
            label: "Update task",
            table: "tasks",
            type: "update",
            rowId: task.id,
            values: payload,
          })
        : await writeOrQueue({
            label: "New task",
            table: "tasks",
            type: "insert",
            values: { ...payload, id: crypto.randomUUID() },
          });
      toast.success(
        queued ? "Saved offline — will sync later" : task ? "Task updated" : "Task added",
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save task");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Due date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full rounded-full">
        {task ? "Save changes" : "Add task"}
      </Button>
    </form>
  );
}
