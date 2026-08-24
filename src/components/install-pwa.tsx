import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIP = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwaButton() {
  const [prompt, setPrompt] = useState<BIP | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIP);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt || hidden) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full gap-2"
      onClick={async () => {
        await prompt.prompt();
        const res = await prompt.userChoice.catch(() => null);
        if (res?.outcome === "accepted") setHidden(true);
        setPrompt(null);
      }}
    >
      <Download className="h-3.5 w-3.5" />
      Install app
    </Button>
  );
}
