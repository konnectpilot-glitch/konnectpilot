import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  FileText,
  CreditCard,
  Settings,
  ClipboardCheck,
  Share2,
  CalendarDays,
  Library,
  Users,
  LineChart,
  DollarSign,
  Plus,
  Sun,
  Moon,
  Monitor,
  Search as SearchIcon,
  MessageSquare,
  Wand2,
  Inbox as InboxIcon,
  type LucideIcon,
} from "lucide-react";
import { useListBrands } from "@workspace/api-client-react";
import { useTheme } from "@/lib/theme";

/**
 * Global Cmd+K command palette. Listens for ⌘K / Ctrl+K anywhere in the app
 * and offers: jump-to-page, jump-to-brand, quick actions (new brand, generate
 * post), and theme switching.
 *
 * Rendered once inside Layout so authenticated pages all get it.
 */
type Item = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  onSelect: () => void;
  keywords?: string;
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: brands } = useListBrands();
  const { setTheme } = useTheme();

  // Global keybind. We listen on document so it works regardless of which
  // input is focused — Cmd+K is universally expected.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function go(path: string) {
    return () => {
      setLocation(path);
      setOpen(false);
    };
  }

  const pages: Item[] = [
    { id: "nav:dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Pages", onSelect: go("/dashboard") },
    { id: "nav:calendar", label: "Calendar", icon: CalendarDays, group: "Pages", onSelect: go("/calendar") },
    { id: "nav:brands", label: "Brands", icon: Building2, group: "Pages", onSelect: go("/brands") },
    { id: "nav:generate", label: "Generate post", hint: "AI", icon: Sparkles, group: "Pages", onSelect: go("/generate") },
    { id: "nav:library", label: "Library", icon: Library, group: "Pages", onSelect: go("/library") },
    { id: "nav:approval", label: "Approval Queue", icon: ClipboardCheck, group: "Pages", onSelect: go("/approval") },
    { id: "nav:inbox", label: "Comment Inbox", hint: "AI", icon: InboxIcon, group: "Pages", onSelect: go("/inbox") },
    { id: "nav:posts", label: "Post History", icon: FileText, group: "Pages", onSelect: go("/posts") },
    { id: "nav:analytics", label: "Analytics", icon: LineChart, group: "Pages", onSelect: go("/analytics") },
    { id: "nav:accounts", label: "Social Accounts", icon: Share2, group: "Pages", onSelect: go("/accounts") },
    { id: "nav:affiliate", label: "Affiliate", icon: DollarSign, group: "Pages", onSelect: go("/affiliate") },
    { id: "nav:team", label: "Team", icon: Users, group: "Pages", onSelect: go("/team") },
    { id: "nav:billing", label: "Billing", icon: CreditCard, group: "Pages", onSelect: go("/billing") },
    { id: "nav:settings", label: "Settings", icon: Settings, group: "Pages", onSelect: go("/settings") },
  ];

  const actions: Item[] = [
    { id: "act:new-brand", label: "New brand", hint: "Create", icon: Plus, group: "Quick actions", onSelect: go("/brands/new") },
    { id: "act:generate", label: "Generate a post", hint: "AI", icon: Sparkles, group: "Quick actions", onSelect: go("/generate") },
    { id: "act:bulk-generate", label: "Generate a month of posts", hint: "Bulk", icon: Wand2, group: "Quick actions", onSelect: go("/approval?batch=1") },
    { id: "act:reply-drafter", label: "Draft a comment reply", hint: "AI", icon: MessageSquare, group: "Quick actions", onSelect: go("/reply-drafter") },
  ];

  const brandItems: Item[] = (brands ?? []).map((b: any) => ({
    id: `brand:${b.id}`,
    label: b.name,
    hint: b.industry ?? undefined,
    icon: Building2,
    group: "Brands",
    onSelect: go(`/brands/${b.id}`),
    keywords: `${b.industry ?? ""} ${b.keywords ?? ""}`,
  }));

  const themeItems: Item[] = [
    { id: "theme:light", label: "Switch to light mode", icon: Sun, group: "Theme", onSelect: () => { setTheme("light"); setOpen(false); } },
    { id: "theme:dark", label: "Switch to dark mode", icon: Moon, group: "Theme", onSelect: () => { setTheme("dark"); setOpen(false); } },
    { id: "theme:system", label: "Follow system theme", icon: Monitor, group: "Theme", onSelect: () => { setTheme("system"); setOpen(false); } },
  ];

  const all = [...actions, ...brandItems, ...pages, ...themeItems];
  const grouped = all.reduce<Record<string, Item[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center pt-[20vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Menu" className="flex flex-col max-h-[60vh]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <SearchIcon className="w-4 h-4 text-muted-foreground" />
            <Command.Input
              placeholder="Type a page, brand, or action…"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
            <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">esc</span>
          </div>
          <Command.List className="flex-1 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-sm text-muted-foreground text-center">
              No matches.
            </Command.Empty>
            {Object.entries(grouped).map(([group, items]) => (
              <Command.Group
                key={group}
                heading={
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2">
                    {group}
                  </span>
                }
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`}
                      onSelect={item.onSelect}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer text-foreground data-[selected=true]:bg-secondary"
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      {item.hint && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                          {item.hint}
                        </span>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <kbd className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> navigate
              {" · "}
              <kbd className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">↵</kbd> select
            </span>
            <span>
              <kbd className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd> toggle
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
