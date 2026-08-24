import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Flame,
  BookText,
  Target,
  TrendingUp,
  Settings,
  Compass,
  MessageCircle,
  Brain,
  Code2,
  Send,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { InstallPwaButton } from "@/components/install-pwa";

export const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", url: "/chat", icon: MessageCircle },
  { title: "Memory", url: "/memory", icon: Brain },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Habits", url: "/habits", icon: Flame },
  { title: "Journal", url: "/journal", icon: BookText },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Progress", url: "/progress", icon: TrendingUp },
  { title: "Telegram", url: "/telegram", icon: Send },
  { title: "Developer", url: "/developer", icon: Code2 },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-forest text-primary-foreground shadow-soft">
            <Compass className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="font-serif text-lg font-semibold tracking-tight">Beacon</span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <InstallPwaButton />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
