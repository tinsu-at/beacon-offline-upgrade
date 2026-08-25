import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Moon,
  Sun,
  BellRing,
  Send,
  Volume2,
  VibrateIcon,
  ChevronDown,
  Lock,
  Unlock,
} from "lucide-react";
import {
  clearRecovery,
  disableLock,
  getLockConfig,
  getRecoveryQuestion,
  isLockEnabled,
  setLock,
  setLockTimeout,
  setRecovery,
  type LockKind,
} from "@/lib/lock";
import { PinPad, PatternPad } from "@/components/app-lock";
import {
  DEFAULT_NOTIF_PREFS,
  loadNotifPrefs,
  saveNotifPrefs,
  requestNotifPermission,
  notifPermission,
  fireNotification,
  type NotifKey,
  type NotifPrefs,
} from "@/lib/notifications";
import {
  getPushStatus,
  subscribePush,
  unsubscribePush,
  isPushConfigured,
  type PushStatus,
} from "@/lib/push";
import { TelegramSettingsCard } from "@/components/telegram-settings-card";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Beacon" }] }),
  component: SettingsPage,
});

const NOTIF_LABELS: Record<NotifKey, { label: string; desc: string }> = {
  morningBriefing: { label: "Morning briefing", desc: "Plan the day with Beacon." },
  confidenceChallenge: { label: "Confidence challenge", desc: "One brave act per day." },
  taskReminder: { label: "Task reminder", desc: "Protect today's most important task." },
  habitReminder: { label: "Habit reminder", desc: "Log your habits, keep the streak." },
  goalReminder: { label: "Goal reminder", desc: "Move one goal forward today." },
  journalReminder: { label: "Journal nudge", desc: "Three lines about today." },
  eveningReflection: { label: "Evening reflection", desc: "The Beacon Principle check-in." },
  dailyReview: { label: "Daily review", desc: "Wins, distractions, lessons." },
  weeklyReview: { label: "Weekly review", desc: "Zoom out once a week." },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockKind, setLockKind] = useState<LockKind>("pin");
  const [lockTimeout, setLockTimeoutState] = useState(0);
  const [lockSecret, setLockSecret] = useState("");
  const [lockStep, setLockStep] = useState<"idle" | "confirm">("idle");
  const [lockFirstSecret, setLockFirstSecret] = useState("");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [push, setPush] = useState<PushStatus>({ state: "prompt" });
  const [expanded, setExpanded] = useState<NotifKey | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile]);

  useEffect(() => {
    setPrefs(loadNotifPrefs());
    setPermission(notifPermission());
    getPushStatus()
      .then(setPush)
      .catch(() => {});
    const cfg = getLockConfig();
    if (cfg) {
      setLockEnabled(cfg.enabled);
      setLockKind(cfg.kind);
      setLockTimeoutState(cfg.timeoutMin);
    }
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  function updatePref(key: NotifKey, patch: Partial<NotifPrefs[NotifKey]>) {
    const next: NotifPrefs = { ...prefs, [key]: { ...prefs[key], ...patch } };
    setPrefs(next);
    saveNotifPrefs(next);
  }

  async function enableNotifications() {
    const p = await requestNotifPermission();
    setPermission(p);
    if (p === "granted") {
      toast.success("Notifications enabled");
      saveNotifPrefs(prefs);
    } else {
      toast.error("Notification permission denied");
    }
  }

  async function handleSubscribe() {
    const s = await subscribePush();
    setPush(s);
    if (s.state === "subscribed") toast.success("Push notifications enabled");
    else if (s.state === "denied") toast.error("Permission denied in browser");
    else if (s.state === "unsupported") toast.error("Push not supported on this device");
    else if (s.state === "not-configured")
      toast.error("Push server not configured (VITE_VAPID_PUBLIC_KEY missing)");
  }

  async function handleUnsubscribe() {
    await unsubscribePush();
    setPush({ state: "prompt" });
    toast.success("Push disabled");
  }

  function testNotification(key: NotifKey) {
    if (permission !== "granted") {
      toast.error("Enable browser notifications first");
      return;
    }
    fireNotification(key, prefs[key]);
    toast.success("Test sent");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Make Beacon yours.</p>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" className="rounded-full">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Choose light or dark.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="rounded-full"
              >
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="rounded-full"
              >
                Dark
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TelegramSettingsCard />
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            {lockEnabled ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            App Lock
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div>
              <p className="font-medium">Lock Beacon</p>
              <p className="text-xs text-muted-foreground">
                Protect Beacon with a PIN or pattern. Works offline.
              </p>
            </div>

            <Switch
              checked={lockEnabled}
              onCheckedChange={(enabled) => {
                if (!enabled) {
                  disableLock();
                  setLockEnabled(false);
                  setLockSecret("");
                  setLockFirstSecret("");
                  setLockStep("idle");
                  toast.success("App Lock disabled");
                  return;
                }

                setLockEnabled(true);
                setLockSecret("");
                setLockFirstSecret("");
                setLockStep("idle");
              }}
            />
          </div>

          {lockEnabled && (
            <>
              <div className="rounded-2xl border border-border p-4 space-y-4">
                <div>
                  <p className="font-medium">Lock method</p>
                  <p className="text-xs text-muted-foreground">Choose how you unlock Beacon.</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={lockKind === "pin" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => {
                      setLockKind("pin");
                      setLockSecret("");
                      setLockFirstSecret("");
                      setLockStep("idle");
                    }}
                  >
                    PIN
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={lockKind === "pattern" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => {
                      setLockKind("pattern");
                      setLockSecret("");
                      setLockFirstSecret("");
                      setLockStep("idle");
                    }}
                  >
                    Pattern
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-4 space-y-3">
                <div>
                  <p className="font-medium">Auto-lock</p>
                  <p className="text-xs text-muted-foreground">
                    Choose when Beacon should lock after you leave it.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Immediately", value: 0 },
                    { label: "1 min", value: 1 },
                    { label: "5 min", value: 5 },
                    { label: "15 min", value: 15 },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={lockTimeout === option.value ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => {
                        setLockTimeoutState(option.value);

                        if (isLockEnabled()) {
                          setLockTimeout(option.value);
                        }
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {isLockEnabled() && (
                <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                  <div>
                    <p className="font-medium">Lock now</p>
                    <p className="text-xs text-muted-foreground">
                      Immediately show the lock screen on this device.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => window.dispatchEvent(new Event("beacon-lock-now"))}
                  >
                    Lock
                  </Button>
                </div>
              )}

              <div className="rounded-2xl border border-border p-4 space-y-4">
                <div>
                  <p className="font-medium">
                    {lockStep === "confirm"
                      ? lockKind === "pin"
                        ? "Confirm your PIN"
                        : "Confirm your pattern"
                      : isLockEnabled()
                        ? lockKind === "pin"
                          ? "Change your PIN"
                          : "Change your pattern"
                        : "Set your lock"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {lockKind === "pin"
                      ? "Enter the same 4-digit PIN twice. It is stored only as a salted hash on this device."
                      : "Draw the same pattern twice using at least 3 points. Stored only as a salted hash on this device."}
                  </p>
                </div>

                {lockKind === "pin" ? (
                  <PinPad
                    value={lockSecret}
                    onChange={(value) => {
                      if (value.length < 4) {
                        setLockSecret(value);
                        return;
                      }

                      if (lockStep === "idle") {
                        setLockFirstSecret(value);
                        setLockSecret("");
                        setLockStep("confirm");
                        return;
                      }

                      if (value === lockFirstSecret) {
                        void setLock(lockKind, value, lockTimeout);
                        setLockSecret("");
                        setLockFirstSecret("");
                        setLockStep("idle");
                        toast.success("App Lock enabled");
                      } else {
                        setLockSecret("");
                        toast.error("PINs do not match. Try again.");
                      }
                    }}
                  />
                ) : (
                  <PatternPad
                    onComplete={(nodes) => {
                      const pattern = nodes.join("-");

                      if (lockStep === "idle") {
                        setLockFirstSecret(pattern);
                        setLockStep("confirm");
                        return;
                      }

                      if (pattern === lockFirstSecret) {
                        void setLock(lockKind, pattern, lockTimeout);
                        setLockSecret("");
                        setLockFirstSecret("");
                        setLockStep("idle");
                        toast.success("App Lock enabled");
                      } else {
                        setLockFirstSecret("");
                        setLockStep("idle");
                        toast.error("Patterns do not match. Try again.");
                      }
                    }}
                  />
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <BellRing className="h-4 w-4" />
              <div>
                <p className="font-medium">Browser notifications</p>
                <p className="text-xs text-muted-foreground">
                  {permission === "granted"
                    ? "Enabled on this device."
                    : permission === "denied"
                      ? "Blocked — enable in your browser site settings."
                      : "Allow Beacon to remind you at the right time."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={enableNotifications}
              disabled={permission === "granted"}
            >
              {permission === "granted" ? "Enabled" : "Enable"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div className="min-w-0">
              <p className="font-medium">Push notifications (PWA)</p>
              <p className="text-xs text-muted-foreground">
                {push.state === "subscribed"
                  ? "Subscribed. Beacon can reach you even when the app is closed."
                  : push.state === "unsupported"
                    ? "Not supported on this device or browser."
                    : push.state === "not-configured"
                      ? "Push server not configured. Set VITE_VAPID_PUBLIC_KEY to enable."
                      : push.state === "denied"
                        ? "Blocked — allow notifications in browser site settings."
                        : "Register this device so Beacon can push reminders through the service worker."}
              </p>
            </div>
            {push.state === "subscribed" ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={handleUnsubscribe}
              >
                Unsubscribe
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-full"
                onClick={handleSubscribe}
                disabled={
                  push.state === "unsupported" ||
                  push.state === "not-configured" ||
                  !isPushConfigured()
                }
              >
                Register
              </Button>
            )}
          </div>

          {(Object.keys(NOTIF_LABELS) as NotifKey[]).map((key) => {
            const isOpen = expanded === key;
            const pref = prefs[key];
            return (
              <div key={key} className="rounded-2xl border border-border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{NOTIF_LABELS[key].label}</p>
                    <p className="text-xs text-muted-foreground">{NOTIF_LABELS[key].desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      value={pref.time}
                      onChange={(e) => updatePref(key, { time: e.target.value })}
                      className="h-9 w-28"
                    />
                    <Switch
                      checked={pref.enabled}
                      onCheckedChange={(v) => updatePref(key, { enabled: v })}
                    />
                    <button
                      onClick={() => setExpanded(isOpen ? null : key)}
                      aria-label="Expand"
                      className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="space-y-3 border-t border-border p-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={pref.title}
                        onChange={(e) => updatePref(key, { title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Message</Label>
                      <Input
                        value={pref.body}
                        onChange={(e) => updatePref(key, { body: e.target.value })}
                      />
                    </div>
                    {typeof pref.day === "number" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Day of week</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map((d, i) => (
                            <Button
                              key={d}
                              type="button"
                              size="sm"
                              variant={pref.day === i ? "default" : "outline"}
                              className="rounded-full px-3"
                              onClick={() => updatePref(key, { day: i })}
                            >
                              {d}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs">
                        <Volume2 className="h-3.5 w-3.5" />
                        Sound
                        <Switch
                          checked={pref.sound !== false}
                          onCheckedChange={(v) => updatePref(key, { sound: v })}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <VibrateIcon className="h-3.5 w-3.5" />
                        Vibrate
                        <Switch
                          checked={pref.vibrate === true}
                          onCheckedChange={(v) => updatePref(key, { vibrate: v })}
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testNotification(key)}
                        className="ml-auto rounded-full gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Test
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Local reminders run on this device while Beacon is installed or open. Register push to
            also receive them when Beacon is closed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
