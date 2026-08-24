import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageCircle,
  CheckSquare,
  Flame,
  BookText,
  Target,
  TrendingUp,
  Brain,
  Code2,
  Settings,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const items = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", url: "/chat", icon: MessageCircle },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Habits", url: "/habits", icon: Flame },
] as const;

const moreItems = [
  { title: "Journal", url: "/journal", icon: BookText },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Progress", url: "/progress", icon: TrendingUp },
  { title: "Memory", url: "/memory", icon: Brain },
  { title: "Telegram", url: "/telegram", icon: Send },
  { title: "Developer", url: "/developer", icon: Code2 },

  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const moreActive = moreItems.some((i) => pathname.startsWith(i.url));

  return (
    <nav
      className="safe-bottom glass-panel fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl px-2 py-2 shadow-elegant md:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
        return (
          <Link
            key={item.url}
            to={item.url}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                active ? "bg-primary text-primary-foreground shadow-soft" : "bg-transparent"
              }`}
            >
              <item.icon className="h-4 w-4" />
            </span>
            {item.title}
          </Link>
        );
      })}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
              moreActive ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="More pages"
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                moreActive ? "bg-primary text-primary-foreground shadow-soft" : "bg-transparent"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
            More
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetTitle className="font-serif text-lg">All of Beacon</SheetTitle>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {moreItems.map((item) => {
              const active = pathname.startsWith(item.url);
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border border-border/60 px-2 py-4 text-xs font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
