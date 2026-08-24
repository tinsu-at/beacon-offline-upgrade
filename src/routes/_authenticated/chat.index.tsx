import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquarePlus } from "lucide-react";
import { createConversation } from "@/lib/conversations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chat with Beacon" }] }),
  component: ChatIndex,
});

const STARTERS = [
  "Morning briefing: review yesterday, set my top 3 priorities for today, and give me one confidence challenge.",
  "Evening reflection: ask me what I accomplished, what distracted me, what I learned, and what I'll improve tomorrow.",
  "Challenge my current plan — where am I fooling myself?",
  "Help me design a tiny morning routine I actually won't skip.",
];

function ChatIndex() {
  const create = useServerFn(createConversation);
  const navigate = useNavigate();

  const startMut = useMutation({
    mutationFn: async () => create(),
    onSuccess: (row) => {
      navigate({
        to: "/chat/$threadId",
        params: { threadId: row.id },
        search: { starter: undefined },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startWith = useMutation({
    mutationFn: async (prompt: string) => {
      const row = await create();
      return { row, prompt };
    },
    onSuccess: ({ row, prompt }) => {
      // Pass starter via URL search param
      navigate({
        to: "/chat/$threadId",
        params: { threadId: row.id },
        search: { starter: prompt },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="animate-float mb-5 grid h-14 w-14 place-items-center rounded-2xl gradient-forest text-primary-foreground shadow-elegant">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="font-serif text-3xl font-semibold md:text-4xl">Chat with Beacon</h1>
      <p className="mt-3 max-w-lg text-muted-foreground">
        Your calm, honest companion for discipline, confidence, and growth. Share what's on your
        mind — Beacon listens carefully and speaks plainly.
      </p>

      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => startWith.mutate(s)}
            disabled={startWith.isPending}
            className="glass-panel rounded-2xl border border-border/60 px-4 py-3 text-left text-sm shadow-soft transition hover:border-primary/40 hover:shadow-elegant disabled:opacity-60"
          >
            {s}
          </button>
        ))}
      </div>

      <Button
        onClick={() => startMut.mutate()}
        disabled={startMut.isPending}
        className="mt-8 rounded-full"
        size="lg"
      >
        <MessageSquarePlus className="mr-2 h-4 w-4" /> New chat
      </Button>
    </div>
  );
}
