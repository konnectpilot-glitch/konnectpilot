import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Users, Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspaceContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, switchWorkspace, createWorkspace, isLoading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleSwitch(id: number) {
    if (id === activeWorkspace?.id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await switchWorkspace(id);
      toast.success("Workspace switched");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to switch");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createWorkspace(name);
      toast.success("Workspace created");
      setNewName("");
      setCreating(false);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading && !activeWorkspace) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium text-foreground min-w-[180px]"
      >
        <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {activeWorkspace?.name ?? "Select workspace"}
        </span>
        {activeWorkspace && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {activeWorkspace.role}
          </span>
        )}
        <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
            Workspaces
          </div>
          <div className="max-h-72 overflow-y-auto">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => handleSwitch(w.id)}
                disabled={busy}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left disabled:opacity-50",
                  w.id === activeWorkspace?.id && "bg-primary/5",
                )}
              >
                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-foreground">{w.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {w.role}{w.isPersonal ? " · personal" : ""}{w.requireApproval ? " · approval required" : ""}
                  </div>
                </div>
                {w.id === activeWorkspace?.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2">
            {creating ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Workspace name"
                  className="flex-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleCreate}
                  disabled={busy || !newName.trim()}
                  className="px-2 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary rounded-md text-foreground"
              >
                <Plus className="w-4 h-4" />
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
