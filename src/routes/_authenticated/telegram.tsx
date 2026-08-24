import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listTelegramCustomers,
  getTelegramConversation,
  setConversationState,
  sendTelegramReply,
  listStyleExamples,
  addStyleExample,
  deleteStyleExample,
  getOvernightSummary,
} from "@/lib/telegram.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Trash2, UserCheck, Bot } from "lucide-react";

export const Route = createFileRoute("/_authenticated/telegram")({
  head: () => ({
    meta: [
      { title: "Telegram Inbox — Beacon" },
      {
        name: "description",
        content: "Manage Telegram customers, human handoff, and Beacon's reply style.",
      },
    ],
  }),
  component: TelegramPage,
});

function TelegramPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Telegram</h1>
        <p className="text-sm text-muted-foreground">
          Customers, handoff, overnight summary, and how Beacon should sound.
        </p>
      </div>
      <Tabs defaultValue="inbox">
        <TabsList className="rounded-full">
          <TabsTrigger value="inbox" className="rounded-full">
            Inbox
          </TabsTrigger>
          <TabsTrigger value="summary" className="rounded-full">
            Summary
          </TabsTrigger>
          <TabsTrigger value="teach" className="rounded-full">
            Teach Beacon
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <Inbox />
        </TabsContent>
        <TabsContent value="summary" className="mt-4">
          <Summary />
        </TabsContent>
        <TabsContent value="teach" className="mt-4">
          <Teach />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Inbox() {
  const qc = useQueryClient();
  const fetchCustomers = useServerFn(listTelegramCustomers);
  const fetchConversation = useServerFn(getTelegramConversation);
  const setState = useServerFn(setConversationState);
  const sendReply = useServerFn(sendTelegramReply);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["tg-customers"],
    queryFn: () => fetchCustomers(),
    refetchInterval: 20000,
  });

  const active = customers.find((c) => c.id === selected) ?? null;

  const { data: messages = [] } = useQuery({
    queryKey: ["tg-messages", selected],
    enabled: !!selected,
    queryFn: () => fetchConversation({ data: { customerId: selected! } }),
    refetchInterval: 15000,
  });

  const stateMut = useMutation({
    mutationFn: (v: { customerId: string; state: "BEACON_ACTIVE" | "HUMAN_TAKEOVER" }) =>
      setState({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tg-customers"] });
      toast.success("Conversation updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMut = useMutation({
    mutationFn: (text: string) => sendReply({ data: { customerId: selected!, text } }),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error ?? "Send failed");
      setDraft("");
      qc.invalidateQueries({ queryKey: ["tg-messages", selected] });
      qc.invalidateQueries({ queryKey: ["tg-customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <Card className="rounded-3xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base">Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No Telegram customers yet. Message your bot to start.
            </p>
          )}
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                selected === c.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{c.display_name ?? "Unknown"}</span>
                {c.waiting_for_human && <Badge variant="destructive">waiting</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {c.telegram_username ? `@${c.telegram_username} · ` : ""}
                {c.status}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 font-serif text-base">
            <span>{active ? (active.display_name ?? "Conversation") : "Select a customer"}</span>
            {active && (
              <span className="flex items-center gap-2">
                <Badge variant={active.state === "HUMAN_TAKEOVER" ? "destructive" : "secondary"}>
                  {active.state === "HUMAN_TAKEOVER" ? "Human takeover" : "Beacon active"}
                </Badge>
                {active.state === "BEACON_ACTIVE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full gap-1"
                    onClick={() =>
                      stateMut.mutate({ customerId: active.id, state: "HUMAN_TAKEOVER" })
                    }
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Take over
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-full gap-1"
                    onClick={() =>
                      stateMut.mutate({ customerId: active.id, state: "BEACON_ACTIVE" })
                    }
                  >
                    <Bot className="h-3.5 w-3.5" /> Resume Beacon
                  </Button>
                )}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {active?.handoff_reason && (
            <p className="rounded-2xl bg-muted p-3 text-xs">
              <strong>Handoff reason:</strong> {active.handoff_reason}
            </p>
          )}
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.direction === "in" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {m.sender} · {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {active && messages.length === 0 && (
              <p className="text-xs text-muted-foreground">No messages yet.</p>
            )}
          </div>
          {active && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) replyMut.mutate(draft.trim());
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reply as yourself…"
              />
              <Button type="submit" className="rounded-full" disabled={replyMut.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary() {
  const fetchSummary = useServerFn(getOvernightSummary);
  const { data } = useQuery({ queryKey: ["tg-summary"], queryFn: () => fetchSummary() });
  if (!data) return <p className="text-sm text-muted-foreground">Loading summary…</p>;

  const blocks: Array<[string, Array<{ id: string; display_name: string | null }>]> = [
    ["New customers", data.newCustomers],
    ["Interested", data.interested],
    ["Potential", data.potential],
    ["Needs your attention", data.needsAttention],
    ["Waiting for you", data.waiting],
    ["Handled while sleeping", data.handledWhileSleeping],
  ];

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="font-serif text-lg">Last 24 hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{data.messageCount} messages exchanged.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {blocks.map(([label, rows]) => (
            <div key={label} className="rounded-2xl border border-border p-3">
              <p className="text-sm font-medium">
                {label} <span className="text-muted-foreground">({rows.length})</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {rows.slice(0, 6).map((r) => (
                  <li key={r.id}>{r.display_name ?? "Unknown"}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Teach() {
  const qc = useQueryClient();
  const list = useServerFn(listStyleExamples);
  const add = useServerFn(addStyleExample);
  const del = useServerFn(deleteStyleExample);
  const [customerMessage, setCustomerMessage] = useState("");
  const [ownerReply, setOwnerReply] = useState("");

  const { data: examples = [] } = useQuery({ queryKey: ["tg-style"], queryFn: () => list() });

  const addMut = useMutation({
    mutationFn: () => add({ data: { customerMessage, ownerReply } }),
    onSuccess: () => {
      setCustomerMessage("");
      setOwnerReply("");
      qc.invalidateQueries({ queryKey: ["tg-style"] });
      toast.success("Example saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tg-style"] }),
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Teach Beacon your voice</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (customerMessage.trim() && ownerReply.trim()) addMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Customer said</Label>
              <Input
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                placeholder="How much is your service?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>You replied</Label>
              <Textarea
                value={ownerReply}
                onChange={(e) => setOwnerReply(e.target.value)}
                placeholder="It's 500 birr bro. If you want, I can get you started today."
              />
            </div>
            <Button type="submit" className="rounded-full" disabled={addMut.isPending}>
              Save example
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Beacon copies tone, length, and phrasing from these examples only — never the private
            details of one customer into another chat.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {examples.map((ex) => (
          <div key={ex.id} className="rounded-2xl border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground">Customer: {ex.customer_message}</p>
                <p className="font-medium">You: {ex.owner_reply}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => delMut.mutate(ex.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
