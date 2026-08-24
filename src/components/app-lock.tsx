import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Fingerprint, ShieldCheck } from "lucide-react";
import {
  attemptsLeft,
  blockedForMs,
  encodePattern,
  getLockConfig,
  getRecoveryQuestion,
  isLockEnabled,
  markActive,
  recordFailure,
  resetThrottle,
  setLock,
  shouldLockNow,
  verifyRecoveryAnswer,
  verifySecret,
} from "@/lib/lock";


/** 3x3 pattern grid used by both the locker and the setup dialog. */
export function PatternPad({
  onComplete,
  disabled,
}: {
  onComplete: (nodes: number[]) => void;
  disabled?: boolean;
}) {
  const [nodes, setNodes] = useState<number[]>([]);
  const drawing = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const hit = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    const cells = el.querySelectorAll<HTMLElement>("[data-node]");
    cells.forEach((c) => {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (Math.hypot(x - cx, y - cy) < r.width * 0.6) {
        const n = Number(c.dataset["node"]);
        setNodes((prev) => (prev.includes(n) ? prev : [...prev, n]));
      }
    });
  }, []);

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (nodes.length >= 3) onComplete(nodes);
    setTimeout(() => setNodes([]), 200);
  }

  return (
    <div
      ref={ref}
      className="touch-none select-none"
      onPointerDown={(e) => {
        if (disabled) return;
        drawing.current = true;
        hit(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => drawing.current && hit(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerLeave={end}
    >
      <div className="grid grid-cols-3 gap-6">
        {Array.from({ length: 9 }, (_, i) => {
          const on = nodes.includes(i);
          return (
            <span
              key={i}
              data-node={i}
              className={`grid h-14 w-14 place-items-center rounded-full border transition-colors ${
                on ? "border-sky-300 bg-sky-400/20" : "border-white/20"
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full transition-colors ${
                  on ? "bg-sky-300" : "bg-white/40"
                }`}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Numeric keypad used by both the locker and the setup dialog. */
export function PinPad({
  value,
  onChange,
  length = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
}) {
  const push = (d: string) => value.length < length && onChange(value + d);
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${i < value.length ? "bg-sky-300" : "bg-white/25"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => push(d)}
            className="h-16 w-16 rounded-2xl border border-white/15 text-xl font-medium text-white/90 transition-colors active:bg-white/15"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => push("0")}
          className="h-16 w-16 rounded-2xl border border-white/15 text-xl font-medium text-white/90 transition-colors active:bg-white/15"
        >
          0
        </button>
        <button
          type="button"
          aria-label="Delete"
          onClick={() => onChange(value.slice(0, -1))}
          className="grid h-16 w-16 place-items-center rounded-2xl text-white/70 transition-colors active:bg-white/10"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Full-screen locker. Renders only when a lock is configured and the
 * auto-lock timeout has elapsed while the app was backgrounded.
 */
export function AppLock() {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"pin" | "pattern">(() => getLockConfig()?.kind ?? "pin");
  const [mode, setMode] = useState<"unlock" | "recover" | "reset" | "reset-confirm">("unlock");
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [firstSecret, setFirstSecret] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const lockNow = () => {
      setKind(getLockConfig()?.kind ?? "pin");
      setMode("unlock");
      setLocked(true);
    };

    if (isLockEnabled() && shouldLockNow()) lockNow();
    else markActive();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") markActive();
      else if (isLockEnabled() && shouldLockNow()) lockNow();
    };

    // Inactivity auto-lock while the app stays in the foreground.
    const onActivity = () => {
      if (!locked) markActive();
    };
    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const ev of activityEvents) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    const idleTimer = window.setInterval(() => {
      const cfg = getLockConfig();
      if (!cfg?.enabled || cfg.timeoutMin <= 0) return;
      if (document.visibilityState !== "visible") return;
      if (shouldLockNow()) lockNow();
    }, 15_000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", markActive);
    window.addEventListener("beacon-lock-now", lockNow);
    return () => {
      for (const ev of activityEvents) window.removeEventListener(ev, onActivity);
      window.clearInterval(idleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", markActive);
      window.removeEventListener("beacon-lock-now", lockNow);
    };
    // `locked` is intentionally read through the closure guard only.
  }, [locked]);

  // Live countdown while guessing is blocked.
  useEffect(() => {
    if (!locked) return;
    const tick = () => setCooldown(blockedForMs(mode === "recover" ? "recovery" : "unlock"));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [locked, mode]);

  const finish = useCallback(() => {
    markActive();
    resetThrottle("unlock");
    resetThrottle("recovery");
    setLocked(false);
    setPin("");
    setAnswer("");
    setFirstSecret("");
    setMode("unlock");
    setError(null);
  }, []);

  const unlock = useCallback(
    async (secret: string) => {
      if (blockedForMs("unlock") > 0) {
        setPin("");
        return;
      }
      if (await verifySecret(secret)) {
        finish();
      } else {
        recordFailure("unlock");
        const left = attemptsLeft("unlock");
        setError(
          left > 0
            ? `${kind === "pin" ? "Wrong PIN" : "Wrong pattern"} — ${left} ${left === 1 ? "try" : "tries"} left`
            : "Too many attempts. Wait before trying again.",
        );
        setPin("");
        if (navigator.vibrate) navigator.vibrate(80);
      }
    },
    [finish, kind],
  );

  useEffect(() => {
    if (mode === "unlock" && kind === "pin" && pin.length === 4) void unlock(pin);
  }, [pin, kind, mode, unlock]);

  const applyNewSecret = useCallback(
    async (secret: string) => {
      const cfg = getLockConfig();
      await setLock(kind, secret, cfg?.timeoutMin ?? 0);
      finish();
    },
    [kind, finish],
  );

  const handleNewSecret = useCallback(
    (secret: string) => {
      if (mode === "reset") {
        setFirstSecret(secret);
        setPin("");
        setMode("reset-confirm");
        setError(null);
        return;
      }
      if (secret === firstSecret) void applyNewSecret(secret);
      else {
        setPin("");
        setFirstSecret("");
        setMode("reset");
        setError("They did not match. Start again.");
      }
    },
    [mode, firstSecret, applyNewSecret],
  );

  useEffect(() => {
    if ((mode === "reset" || mode === "reset-confirm") && kind === "pin" && pin.length === 4) {
      handleNewSecret(pin);
    }
  }, [pin, kind, mode, handleNewSecret]);

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (blockedForMs("recovery") > 0) return;
    if (await verifyRecoveryAnswer(answer)) {
      resetThrottle("recovery");
      setAnswer("");
      setError(null);
      setPin("");
      setMode("reset");
    } else {
      recordFailure("recovery");
      const left = attemptsLeft("recovery");
      setError(
        left > 0
          ? `Incorrect answer — ${left} ${left === 1 ? "try" : "tries"} left`
          : "Too many attempts. Wait before trying again.",
      );
      setAnswer("");
    }
  }

  if (!locked) return null;

  const blocked = cooldown > 0;
  const cooldownLabel = `Try again in ${Math.ceil(cooldown / 1000)}s`;

  const title =
    mode === "recover"
      ? "Answer your recovery question"
      : mode === "reset"
        ? kind === "pin"
          ? "Create a new PIN"
          : "Draw a new pattern"
        : mode === "reset-confirm"
          ? kind === "pin"
            ? "Confirm your new PIN"
            : "Confirm your new pattern"
          : kind === "pin"
            ? "Enter PIN"
            : "Draw pattern";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 overflow-y-auto bg-[#0D0D0D] px-6 py-10 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15">
          {kind === "pin" ? (
            <ShieldCheck className="h-6 w-6 text-sky-300" />
          ) : (
            <Fingerprint className="h-6 w-6 text-sky-300" />
          )}
        </div>
        <p className="text-sm text-white/70">{blocked ? cooldownLabel : (error ?? title)}</p>
        {mode === "recover" && question && (
          <p className="max-w-xs text-center text-sm text-white/50">{question}</p>
        )}
      </div>

      {mode === "recover" ? (
        <form onSubmit={submitAnswer} className="flex w-full max-w-xs flex-col gap-3">
          <input
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={blocked}
            placeholder="Your answer"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-sky-300/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={blocked || answer.trim().length === 0}
            className="rounded-xl bg-sky-400/90 px-4 py-3 text-sm font-medium text-[#0D0D0D] disabled:opacity-40"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("unlock");
              setError(null);
              setAnswer("");
            }}
            className="text-xs text-white/50 underline-offset-4 hover:underline"
          >
            Back to unlock
          </button>
        </form>
      ) : blocked ? (
        <p className="text-sm text-white/50">Locked out for a moment to prevent guessing.</p>
      ) : kind === "pin" ? (
        <PinPad value={pin} onChange={setPin} />
      ) : (
        <PatternPad
          onComplete={(n) =>
            mode === "unlock"
              ? void unlock(encodePattern(n))
              : handleNewSecret(encodePattern(n))
          }
        />
      )}

      {mode === "unlock" && (
        <button
          type="button"
          onClick={() => {
            const q = getRecoveryQuestion();
            if (!q) {
              setError("No recovery question set on this device.");
              return;
            }
            setQuestion(q);
            setError(null);
            setMode("recover");
          }}
          className="text-xs text-sky-300/80 underline-offset-4 hover:underline"
        >
          Forgot {kind === "pin" ? "PIN" : "pattern"}?
        </button>
      )}

      <p className="text-center text-xs text-white/40">
        Beacon is locked on this device. Works fully offline.
      </p>
    </div>
  );

}
