// Guarded service-worker registration. Only registers in production
// on non-preview hosts. Never in Lovable preview, dev, or iframes.

const PREVIEW_HOSTNAMES = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (PREVIEW_HOSTNAMES.some((h) => host === h || host.endsWith(`.${h}`))) return true;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

async function unregisterAppWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) {
    const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
    if (url.endsWith("/sw.js") || url.endsWith("/service-worker.js")) {
      await r.unregister().catch(() => {});
    }
  }
}

export function initPwa() {
  if (typeof window === "undefined") return;
  if (isBlockedContext()) {
    void unregisterAppWorkers();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  // Dynamically import via a computed specifier so TS doesn't require a type.
  const spec = "virtual:pwa-register";
  (
    import(/* @vite-ignore */ spec) as Promise<{
      registerSW: (opts?: { immediate?: boolean }) => void;
    }>
  )
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // Plugin not available in this build; skip silently.
    });
}
