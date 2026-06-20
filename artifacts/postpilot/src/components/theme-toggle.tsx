import { useTheme } from "@/lib/theme";
import { Moon, Sun, Monitor } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Theme toggle. Click flips light/dark (the 99% case). Long-press / menu
 * opens a 3-way picker that includes "Follow system".
 *
 * Placed in the layout header, also exposed inline for the settings page.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click. We listen on document, so anything
  // outside the wrapping div collapses the popover.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const Icon = theme === "dark"
    ? Moon
    : theme === "light"
    ? Sun
    : Monitor;

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <button
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
        title="Toggle theme (right-click for more)"
        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Toggle theme"
      >
        <Icon className="w-4 h-4" />
      </button>
      {/* Caret to expose 3-way picker — small, doesn't compete with main button */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="absolute -right-1 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-card border border-border text-[8px] text-muted-foreground hover:text-foreground flex items-center justify-center leading-none"
        aria-label="Theme options"
      >
        ▾
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {([
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "System", icon: Monitor },
          ] as const).map(({ id, label, icon: I }) => (
            <button
              key={id}
              onClick={() => { setTheme(id); setMenuOpen(false); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-secondary",
                theme === id ? "text-primary font-medium" : "text-foreground",
              )}
            >
              <I className="w-3.5 h-3.5" />
              {label}
              {theme === id && <span className="ml-auto text-xs">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
