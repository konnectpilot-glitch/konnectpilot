import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  Share2,
  Shield,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";
import { CalendarDays, Library, DollarSign, LineChart } from "lucide-react";
import { useGetMe, useGetMyUsage } from "@workspace/api-client-react";
import NotificationsBell from "./notifications-bell";
import ImpersonationBanner from "./impersonation-banner";
import WorkspaceSwitcher from "./workspace-switcher";

type NavItem = { href: string; label: string; icon: any };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/brands", label: "Brands", icon: Building2 },
  { href: "/generate", label: "Generate Post", icon: Sparkles },
  { href: "/library", label: "Library", icon: Library },
  { href: "/approval", label: "Approval Queue", icon: ClipboardCheck },
  { href: "/posts", label: "Post History", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/accounts", label: "Social Accounts", icon: Share2 },
  { href: "/affiliate", label: "Affiliate", icon: DollarSign },
  { href: "/team", label: "Team", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItem: NavItem = { href: "/admin", label: "Admin", icon: Shield };

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-secondary text-muted-foreground",
    starter: "bg-blue-50 text-blue-700",
    pro: "bg-purple-50 text-purple-700",
    agency: "bg-amber-50 text-amber-700",
  };
  const label = plan === "free" ? "Free plan" : `${plan} plan`;
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize hover:opacity-80 transition-opacity", colors[plan] ?? colors.free)}>
      {label}
    </span>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: me } = useGetMe();
  const { data: usage } = useGetMyUsage();
  const visibleNavItems = me?.isSuperadmin ? [...navItems, adminNavItem] : navItems;
  const currentPlan = usage?.plan ?? "free";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-foreground">KonnectPilot</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || location.startsWith(href + "?") || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
            {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.emailAddresses?.[0]?.emailAddress}
            </p>
            <Link href="/billing" className="inline-block mt-0.5">
              <PlanBadge plan={currentPlan} />
            </Link>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-60 bg-card border-r border-border z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-foreground">KonnectPilot</span>
          </div>
          <div className="flex items-center gap-1">
            <WorkspaceSwitcher />
            <NotificationsBell />
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-secondary">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-end gap-3 px-6 py-3 border-b border-border bg-card">
          <WorkspaceSwitcher />
          <NotificationsBell />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
