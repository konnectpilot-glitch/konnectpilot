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
  Image,
  Clapperboard,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Building2 },
  {
    href: "/generate",
    label: "Generate Post",
    icon: Sparkles,
    children: [
      { href: "/generate?tab=image", label: "Post Image", icon: Image },
      { href: "/generate?tab=video", label: "Video Script", icon: Clapperboard },
    ],
  },
  { href: "/posts", label: "Post History", icon: FileText },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    starter: "bg-blue-50 text-blue-700",
    pro: "bg-purple-50 text-purple-700",
    agency: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", colors[plan] ?? colors.free)}>
      {plan}
    </span>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check if we're on the generate page — keep sub-items visible
  const onGeneratePage = location === "/generate" || location.startsWith("/generate");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-foreground">PostPilot</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, children: subItems }) => {
          const isActive = location === href || (location.startsWith(href + "?") || location.startsWith(href + "/"));
          const hasChildren = subItems && subItems.length > 0;

          return (
            <div key={href}>
              <Link
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
                {hasChildren && (
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", onGeneratePage && "rotate-180")} />
                )}
              </Link>

              {/* Sub-items — shown when parent page is active */}
              {hasChildren && onGeneratePage && (
                <div className="ml-3 pl-4 border-l border-border mt-0.5 mb-1 space-y-0.5">
                  {subItems.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                    // Determine if this sub-item tab is active via search param
                    const tabParam = subHref.split("?tab=")[1];
                    const currentSearch = typeof window !== "undefined" ? window.location.search : "";
                    const subActive = currentSearch.includes(`tab=${tabParam}`);
                    return (
                      <Link
                        key={subHref}
                        href={subHref}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          subActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        {subLabel}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
    <div className="flex h-screen bg-background overflow-hidden">
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
            <span className="font-bold text-foreground">PostPilot</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-secondary">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
