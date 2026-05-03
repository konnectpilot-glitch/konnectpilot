import Layout from "@/components/layout";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users, UserPlus, Trash2, Crown, Loader2, Mail, Copy, LogOut,
  AlertTriangle, Save, Check,
} from "lucide-react";
import { useWorkspace, hasRoleAtLeast, type WorkspaceRole } from "@/lib/workspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

type Member = {
  id: number;
  userId: number;
  role: WorkspaceRole;
  email: string;
  name: string | null;
  createdAt: string;
};

type Invite = {
  id: number;
  email: string;
  role: WorkspaceRole;
  status: string;
  expiresAt: string;
  createdAt: string;
  token?: string;
};

const ROLES: WorkspaceRole[] = ["admin", "editor", "viewer"];

export default function TeamPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, workspaces, switchWorkspace, refresh } = useWorkspace();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const role = activeWorkspace?.role;
  const isOwner = role === "owner";
  const canManage = hasRoleAtLeast(role, "admin");

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken().catch(() => null);
    return fetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
      },
    });
  }, [getToken, activeWorkspace]);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [transferTo, setTransferTo] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name);
      setRequireApproval(activeWorkspace.requireApproval);
    }
  }, [activeWorkspace]);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        authedFetch("/api/workspaces/current/members"),
        canManage ? authedFetch("/api/workspaces/current/invites") : Promise.resolve(null),
      ]);
      if (m.ok) setMembers(await m.json());
      if (i && i.ok) setInvites(await i.json()); else setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, activeWorkspace, canManage]);

  useEffect(() => { void load(); }, [load]);

  async function saveSettings() {
    if (!canManage) return;
    setSavingSettings(true);
    try {
      const res = await authedFetch("/api/workspaces/current", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), requireApproval }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save");
      }
      await refresh();
      toast.success("Workspace updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function changeRole(memberId: number, newRole: WorkspaceRole) {
    const res = await authedFetch(`/api/workspaces/current/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Failed");
      return;
    }
    toast.success("Role updated");
    void load();
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.email} from this workspace?`)) return;
    const res = await authedFetch(`/api/workspaces/current/members/${m.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Failed");
      return;
    }
    toast.success("Member removed");
    void load();
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setSendingInvite(true);
    setShareLink(null);
    try {
      const res = await authedFetch("/api/workspaces/current/invites", {
        method: "POST",
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setInviteEmail("");
      if (data.kind === "member") {
        toast.success(`${email} added directly`);
      } else if (data.kind === "invite") {
        const link = `${window.location.origin}${import.meta.env.BASE_URL}invite/${data.invite.token}`;
        setShareLink(link);
        toast.success("Invite created — share the link below");
      }
      void load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingInvite(false);
    }
  }

  async function cancelInvite(id: number) {
    const res = await authedFetch(`/api/workspaces/current/invites/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) { toast.error("Failed"); return; }
    toast.success("Invite cancelled");
    void load();
  }

  async function transferOwnership() {
    if (!transferTo) return;
    const res = await authedFetch("/api/workspaces/current/transfer", {
      method: "POST",
      body: JSON.stringify({ memberId: transferTo.id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Failed");
      return;
    }
    toast.success(`Ownership transferred to ${transferTo.email}`);
    setTransferTo(null);
    await refresh();
    void load();
  }

  async function leaveWorkspace() {
    const res = await authedFetch("/api/workspaces/current/leave", { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Failed");
      return;
    }
    toast.success("You left the workspace");
    setConfirmLeave(false);
    qc.clear();
    // Switch active to whichever workspace remains (if any) BEFORE redirect
    // so the dashboard doesn't try to load the workspace we just left.
    const remaining = workspaces.filter((w) => w.id !== activeWorkspace?.id);
    if (remaining[0]) await switchWorkspace(remaining[0].id);
    await refresh();
    setLocation("/dashboard");
  }

  async function deleteWorkspace() {
    const res = await authedFetch("/api/workspaces/current", { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Failed");
      return;
    }
    toast.success("Workspace deleted");
    setConfirmDelete(false);
    qc.clear();
    // Switch to any remaining workspace BEFORE redirect so the dashboard
    // doesn't briefly try to load the deleted workspace.
    const remaining = workspaces.filter((w) => w.id !== activeWorkspace?.id);
    if (remaining[0]) await switchWorkspace(remaining[0].id);
    await refresh();
    setLocation("/dashboard");
  }

  if (!activeWorkspace) {
    return (
      <Layout>
        <div className="p-6 text-muted-foreground">No active workspace.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Team & Workspace</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage members, invitations and settings for <span className="font-medium text-foreground">{activeWorkspace.name}</span>.
            Your role: <span className="capitalize font-medium text-foreground">{role}</span>
            {activeWorkspace.isPersonal ? " · personal workspace" : ""}
          </p>
        </div>

        {/* Settings */}
        <section className="border border-border rounded-xl bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">Workspace settings</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                className="mt-1"
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                disabled={!canManage}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-foreground">Require approval before publishing</div>
                <div className="text-xs text-muted-foreground">When on, all generated posts go to the Approval Queue first.</div>
              </div>
            </label>
            {canManage && (
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save changes
              </Button>
            )}
          </div>
        </section>

        {/* Invite */}
        {canManage && (
          <section className="border border-border rounded-xl bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-3">Invite teammates</h2>
            <p className="text-xs text-muted-foreground mb-3">
              If they already have an account, they're added immediately. Otherwise we create an invite link they can use after signing up — or it auto-applies the moment they sign up with this email.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={sendInvite} disabled={sendingInvite || !inviteEmail.trim()}>
                {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Invite
              </Button>
            </div>
            {shareLink && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-secondary/50 border border-border rounded-lg">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <code className="text-xs flex-1 truncate text-foreground">{shareLink}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {invites.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pending invites</div>
                <div className="space-y-1">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{inv.email}</div>
                        <div className="text-[11px] text-muted-foreground capitalize">
                          {inv.role} · expires {format(new Date(inv.expiresAt), "MMM d")}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => cancelInvite(inv.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Members */}
        <section className="border border-border rounded-xl bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Members ({members.length})</h2>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 border border-border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                  {(m.name?.[0] ?? m.email[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    {m.name || m.email}
                    {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {m.role === "owner" || !canManage ? (
                    <span className="text-xs uppercase tracking-wide text-muted-foreground capitalize px-2">
                      {m.role}
                    </span>
                  ) : (
                    <Select
                      value={m.role}
                      onValueChange={(v: WorkspaceRole) => changeRole(m.id, v)}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Transfer ownership to this member"
                      onClick={() => setTransferTo(m)}
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                    </Button>
                  )}
                  {canManage && m.role !== "owner" && (
                    <Button size="sm" variant="ghost" onClick={() => removeMember(m)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Danger zone */}
        <section className="border border-destructive/30 rounded-xl bg-destructive/5 p-5">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Danger zone
          </h2>
          <div className="space-y-3">
            {!isOwner && !activeWorkspace.isPersonal && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-medium text-foreground">Leave workspace</div>
                  <div className="text-xs text-muted-foreground">You will lose access to all brands and posts here.</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmLeave(true)}>
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Leave
                </Button>
              </div>
            )}
            {isOwner && !activeWorkspace.isPersonal && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-medium text-foreground">Delete workspace</div>
                  <div className="text-xs text-muted-foreground">Permanently removes this workspace and all of its brands, posts, schedules, and members.</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </Button>
              </div>
            )}
            {activeWorkspace.isPersonal && (
              <div className="text-xs text-muted-foreground">
                This is your Personal workspace. It can't be deleted or left.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Transfer dialog */}
      <Dialog open={!!transferTo} onOpenChange={(o) => !o && setTransferTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              You will become an admin. <span className="font-medium text-foreground">{transferTo?.email}</span> will become the new owner. This cannot be undone without the new owner's cooperation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTo(null)}>Cancel</Button>
            <Button onClick={transferOwnership}>
              <Check className="w-4 h-4 mr-2" /> Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave dialog */}
      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this workspace?</DialogTitle>
            <DialogDescription>
              You will immediately lose access to {activeWorkspace.name}. Re-joining requires a new invite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>Cancel</Button>
            <Button variant="destructive" onClick={leaveWorkspace}>Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {activeWorkspace.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the workspace and every brand, post, schedule, and member inside it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteWorkspace}>Delete forever</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
