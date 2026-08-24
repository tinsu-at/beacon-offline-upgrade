import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Inbox } from "lucide-react";
import {
  getTelegramStatus,
  connectTelegram,
  disconnectTelegram,
  testTelegram,
  updateTelegramSettings,
} from "@/lib/telegram.functions";

export function TelegramSettingsCard() {
  const qc = useQueryClient();
  const status = useServerFn(getTelegramStatus);
  const connect = useServerFn(connectTelegram);
  const disconnect = useServerFn(disconnectTelegram);
  const test = useServerFn(testTelegram);
  const update = useServerFn(updateTelegramSettings);

  const { data } = useQuery({ queryKey: ["tg-status"], queryFn: () => status() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tg-status"] });

  const connectMut = useMutation({
    mutationFn: () => connect({ data: undefined }),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error);
      toast.success(`Connected as @${r.botUsername ?? "bot"}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => test({ data: undefined }),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error);
      toast.success(
        `Bot @${r.botUsername ?? "?"} reachable. Webhook: ${r.webhookUrl ? "registered" : "not registered"}${
          r.webhookError ? ` (last error: ${r.webhookError})` : ""
        }`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect({ data: undefined }),
    onSuccess: () => {
      toast.success("Telegram disconnected");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settingsMut = useMutation({
    mutationFn: (v: { automationEnabled?: boolean; sleepingMode?: boolean }) => update({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Send className="h-4 w-4" /> Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
          <div>
            <p className="font-medium">
              {data?.connected ? "Connected" : "Disconnected"}{" "}
              {data?.botUsername && (
                <Badge variant="secondary" className="ml-1">
                  @{data.botUsername}
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.tokenConfigured
                ? "Bot token is stored securely on the server."
                : "Bot token is missing — add TELEGRAM_BOT_TOKEN in project secrets."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => connectMut.mutate()}
              disabled={connectMut.isPending}
            >
              Connect Telegram
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending}
            >
              Test Connection
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending || !data?.connected}
            >
              Disconnect
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border p-4">
          <div>
            <p className="font-medium">Automation</p>
            <p className="text-xs text-muted-foreground">
              When off, Beacon records messages but never replies automatically.
            </p>
          </div>
          <Switch
            checked={data?.automationEnabled ?? true}
            onCheckedChange={(v) => settingsMut.mutate({ automationEnabled: v })}
          />
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border p-4">
          <div>
            <p className="font-medium">Sleeping mode</p>
            <p className="text-xs text-muted-foreground">
              Beacon handles normal questions while you sleep and escalates anything important.
            </p>
          </div>
          <Switch
            checked={data?.sleepingMode ?? false}
            onCheckedChange={(v) => settingsMut.mutate({ sleepingMode: v })}
          />
        </div>

        <Button asChild variant="outline" className="w-full rounded-full gap-2">
          <Link to="/telegram">
            <Inbox className="h-4 w-4" /> Open Telegram inbox
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
