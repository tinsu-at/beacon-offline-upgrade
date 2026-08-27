import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { Moon, Sun, LogOut } from "lucide-react";
import { BeaconReflection } from "@/components/beacon-reflection";
import { OfflineBanner } from "@/components/offline-banner";
import { toast } from "sonner";
import { notifPermission, requestNotifPermission, scheduleAll } from "@/lib/notifications";
import { AppLock } from "@/components/app-lock";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the persisted session from local storage, so the app
    // still opens when the device is offline. getUser() would hit the network.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: Shell,
});

function Shell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    // Never bounce to /auth while offline: the cached session stays valid.
    const online = typeof navigator === "undefined" || navigator.onLine;
    if (!loading && !user && online) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Ask for notification permission once, on first launch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("beacon-notif-primed") === "1") return;
    if (notifPermission() !== "default") return;
    const t = setTimeout(() => {
      toast("Turn on reminders?", {
        description: "Beacon can nudge you for habits, tasks and daily reflection.",
        duration: 15000,
        action: {
          label: "Enable",
          onClick: () => {
            localStorage.setItem("beacon-notif-primed", "1");
            void requestNotifPermission().then((p) => {
              if (p === "granted") {
                scheduleAll();
                toast.success("Reminders enabled");
              }
            });
          },
        },
        onDismiss: () => localStorage.setItem("beacon-notif-primed", "1"),
      });
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <AppLock />
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="safe-top sticky top-0 z-20 box-content flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur">
            <div className="hidden md:block">
              <SidebarTrigger />
            </div>
            <div className="md:hidden font-serif text-lg font-semibold">Beacon</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <OfflineBanner />
          <main className="flex min-h-0 flex-1 flex-col pb-24 md:pb-0">
            <Outlet />
          </main>
          <MobileNav />
          <BeaconReflection />
        </div>
      </div>
    </SidebarProvider>
  );
}
