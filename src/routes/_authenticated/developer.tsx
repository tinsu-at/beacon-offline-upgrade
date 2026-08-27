import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
const streamdownPlugins = { code };
import { Copy, Download, Play, Square, Search, Code2 } from "lucide-react";
import { toast } from "sonner";
import { SNIPPETS, type Snippet } from "@/lib/dev-snippets";

export const Route = createFileRoute("/_authenticated/developer")({
  head: () => ({
    meta: [
      { title: "Developer — Beacon" },
      { name: "description", content: "Browse, copy, download, and run curated code snippets." },
    ],
  }),
  component: DeveloperPage,
});

function DeveloperPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Snippet>(SNIPPETS[0]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SNIPPETS;
    return SNIPPETS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.language.includes(q) ||
        s.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <Code2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Developer</h1>
          <p className="text-sm text-muted-foreground">
            Snippets you can copy, download, or run in a sandbox.
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[320px_1fr]">
        <aside className="min-h-0 space-y-3 overflow-y-auto md:pr-1">

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search snippets"
              className="pl-9"
            />
          </div>
          <div className="space-y-2">
            {filtered.map((s) => {
              const isActive = active.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                    isActive ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{s.title}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground">
                      {s.language}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No snippets match "{query}".
              </p>
            )}
          </div>
        </aside>

        <SnippetView snippet={active} />
      </div>
    </div>
  );
}

function SnippetView({ snippet }: { snippet: Snippet }) {
  const [output, setOutput] = useState<Array<{ level: "log" | "error" | "warn"; text: string }>>(
    [],
  );
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  function copy() {
    navigator.clipboard
      .writeText(snippet.code)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Copy failed"));
  }

  function download() {
    const blob = new Blob([snippet.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = snippet.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${snippet.filename}`);
  }

  function stop() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  }

  function run() {
    stop();
    setOutput([]);
    setRunning(true);
    const wrapped = `
      const __send = (level, args) => {
        const text = args.map((a) => {
          try { return typeof a === "string" ? a : JSON.stringify(a, null, 2); }
          catch { return String(a); }
        }).join(" ");
        self.postMessage({ level, text });
      };
      const console = {
        log:  (...a) => __send("log", a),
        info: (...a) => __send("log", a),
        warn: (...a) => __send("warn", a),
        error:(...a) => __send("error", a),
      };
      try {
        ${snippet.code}
      } catch (e) {
        __send("error", [e && e.stack ? e.stack : String(e)]);
      }
      self.postMessage({ __done: true });
    `;
    const blob = new Blob([wrapped], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;
    const timeout = setTimeout(() => {
      setOutput((o) => [...o, { level: "error", text: "Execution timed out after 5s" }]);
      stop();
    }, 5000);
    worker.onmessage = (e) => {
      const data = e.data as { level?: "log" | "error" | "warn"; text?: string; __done?: boolean };
      if (data.__done) {
        clearTimeout(timeout);
        stop();
        return;
      }
      if (data.level && typeof data.text === "string") {
        setOutput((o) => [...o, { level: data.level!, text: data.text! }]);
      }
    };
    worker.onerror = (e) => {
      setOutput((o) => [...o, { level: "error", text: e.message }]);
      clearTimeout(timeout);
      stop();
    };
    URL.revokeObjectURL(url);
  }

  const fence = `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\``;

  return (
    <Card className="flex min-h-0 flex-col rounded-3xl md:h-full h-full">
      <CardHeader className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="font-serif text-lg">{snippet.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{snippet.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {snippet.runnable && (
            <Button size="sm" onClick={running ? stop : run} className="rounded-full gap-2">
              {running ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Stop" : "Run"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={copy} className="rounded-full gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={download} className="rounded-full gap-2">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="overflow-hidden rounded-2xl border border-border">
          <Streamdown plugins={streamdownPlugins}>{fence}</Streamdown>
        </div>
        {snippet.runnable && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Output
              </p>
              {output.length > 0 && (
                <button
                  onClick={() => setOutput([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl border border-border bg-muted/40 p-3 font-mono text-xs">
              {output.length === 0 ? (
                <p className="text-muted-foreground">
                  {running ? "Running…" : "Press Run to execute in a sandboxed worker."}
                </p>
              ) : (
                output.map((o, i) => (
                  <pre
                    key={i}
                    className={`whitespace-pre-wrap ${
                      o.level === "error"
                        ? "text-destructive"
                        : o.level === "warn"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                    }`}
                  >
                    {o.text}
                  </pre>
                ))
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Code runs inside a Web Worker with no DOM, no network, and a 5s timeout.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
