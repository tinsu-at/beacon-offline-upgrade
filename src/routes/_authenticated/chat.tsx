import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, Trash2, Sparkles, PanelLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chat with Beacon" }] }),
  component: ChatLayout,
});

function ChatLayout() {
  const list = useServerFn(listConversations);
  const create = useServerFn(createConversation);
  const del = useServerFn(deleteConversation);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: threads = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: async () => create(),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/chat/$threadId", params: { threadId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (params.threadId === id) navigate({ to: "/chat" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const threadList = (
    <>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg gradient-forest text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="truncate font-serif text-sm font-semibold">Beacon Chats</span>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          aria-label="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2 pb-4">
        <div className="flex flex-col gap-1">
          {threads.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No chats yet. Start one to begin.
            </p>
          )}
          {threads.map((t) => {
            const active = params.threadId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl px-1 transition-colors",
                  active ? "bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  onClick={() => setSheetOpen(false)}
                  className="min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-sm"
                >
                  {t.title || "New chat"}
                </Link>
                <button
                  type="button"
                  aria-label="Delete chat"
                  onClick={() => delMut.mutate(t.id)}
                  className="mr-1 opacity-60 transition-opacity group-hover:opacity-100 focus:opacity-100 md:opacity-0"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      {/* Threads sidebar (desktop) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur md:flex">
        {threadList}
      </aside>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile thread bar */}
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 rounded-full">
                <PanelLeft className="h-4 w-4" />
                Chats
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-80 max-w-[85vw] flex-col p-0">
              <SheetTitle className="sr-only">Conversations</SheetTitle>
              {threadList}
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-2 rounded-full"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            <MessageSquarePlus className="h-4 w-4" />
            New
          </Button>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
