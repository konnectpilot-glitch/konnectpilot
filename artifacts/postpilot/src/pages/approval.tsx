import Layout from "@/components/layout";
import { useMemo, useState } from "react";
import {
  useListPosts,
  useListBrands,
  useUpdateBrand,
  getListPostsQueryKey,
  getListBrandsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ClipboardCheck, Sparkles, Check, X as XIcon, Calendar as CalIcon, Pencil,
  Loader2, Trash2, Brain, Wand2, Facebook, Instagram, Linkedin, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { format, formatDistanceToNow } from "date-fns";
import EmptyState from "@/components/empty-state";
import { useWorkspace, hasRoleAtLeast } from "@/lib/workspaceContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type PostRow = {
  id: number;
  brandId: number;
  brandName?: string | null;
  platform: string;
  content: string;
  imageUrl?: string | null;
  status: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  aiApproved?: string | null;
  aiReviewReason?: string | null;
  aiReviewedAt?: string | null;
  createdAt: string;
};

type Tab = "pending" | "approved" | "rejected" | "scheduled";
const TABS: { key: Tab; label: string; statuses: string[] }[] = [
  { key: "pending", label: "Pending", statuses: ["pending_approval"] },
  { key: "approved", label: "Approved", statuses: ["generated", "published"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled"] },
];

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "facebook") return <Facebook className="w-4 h-4 text-blue-600" />;
  if (platform === "instagram") return <Instagram className="w-4 h-4 text-pink-600" />;
  if (platform === "linkedin") return <Linkedin className="w-4 h-4 text-blue-700" />;
  return null;
}

const PLAN_BATCH_DAYS: Record<string, number> = {
  free: 7, starter: 15, pro: 30, agency: 30,
};

export default function ApprovalPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const role = activeWorkspace?.role;
  const canEdit = hasRoleAtLeast(role, "editor");
  const canApprove = hasRoleAtLeast(role, "admin");
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("pending");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<PostRow | null>(null);
  // Initialize batch-open from URL — `?batch=1` lets the Dashboard CTA and
  // Cmd+K action deep-link straight into the batch generator.
  const [batchOpen, setBatchOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("batch") === "1";
  });
  const [memoryFor, setMemoryFor] = useState<number | null>(null);

  const { data: brands } = useListBrands();
  const { data: posts, isLoading } = useListPosts({});

  async function authedFetch(path: string, init?: RequestInit) {
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
  }

  const filtered: PostRow[] = useMemo(() => {
    const tabDef = TABS.find((t) => t.key === tab)!;
    return ((posts as PostRow[] | undefined) ?? []).filter(
      (p) =>
        tabDef.statuses.includes(p.status) &&
        (brandFilter === "all" || String(p.brandId) === brandFilter),
    );
  }, [posts, tab, brandFilter]);

  function countFor(statuses: string[]): number {
    return ((posts as PostRow[] | undefined) ?? []).filter(
      (p) =>
        statuses.includes(p.status) &&
        (brandFilter === "all" || String(p.brandId) === brandFilter),
    ).length;
  }

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  }
  function toggleOne(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
    setSelected(new Set());
  };

  const bulk = useMutation({
    mutationFn: async (input: {
      action: "approve" | "reject" | "reschedule" | "delete";
      reason?: string;
      publish?: boolean;
      scheduledFor?: string;
    }) => {
      const res = await authedFetch("/api/approval/bulk", {
        method: "POST",
        body: JSON.stringify({ ...input, postIds: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Bulk action failed");
      return body as { succeeded: number[]; skipped: { id: number; reason: string }[] };
    },
    onSuccess: (r, vars) => {
      invalidate();
      const ok = r.succeeded.length;
      const skipped = r.skipped.length;
      toast.success(`${vars.action} complete: ${ok} ok${skipped ? `, ${skipped} skipped` : ""}`);
    },
    onError: (e: any) => toast.error(friendlyError(e, "The bulk action couldn't complete. Please try again.")),
  });

  const editPost = useMutation({
    mutationFn: async (input: { id: number; content?: string; scheduledFor?: string | null; imageUrl?: string | null }) => {
      const { id, ...patch } = input;
      const res = await authedFetch(`/api/approval/posts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Edit failed");
      return body;
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Post updated — your edit is feeding the brand AI memory");
    },
    onError: (e: any) => toast.error(friendlyError(e, "Couldn't save your edit. Please try again.")),
  });

  const generateBatch = useMutation({
    mutationFn: async (input: { brandId: number; days: number; platforms: string[] }) => {
      const res = await authedFetch("/api/approval/generate-batch", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Batch generation failed");
      return body as { created: number; autoApproved: number; autoRejected: number; failed: number; days: number };
    },
    onSuccess: (r) => {
      invalidate();
      setBatchOpen(false);
      const auto = r.autoApproved + r.autoRejected;
      toast.success(
        `Generated ${r.created} posts over ${r.days} days` +
          (auto ? ` — AI auto-approved ${r.autoApproved}, rejected ${r.autoRejected}` : ""),
      );
    },
    onError: (e: any) => toast.error(friendlyError(e, "Batch generation didn't complete. Please try again.")),
  });

  const updateBrand = useUpdateBrand();

  return (
    <Layout>
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-primary" />
              Approval Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review pre-generated posts before they publish. Every approval, edit, and rejection trains your brand's AI memory.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setBatchOpen(true)} className="gap-2">
              <Wand2 className="w-4 h-4" />
              Generate batch
            </Button>
          )}
        </div>

        {/* Brand approval-mode controls */}
        {brands && brands.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Brand approval modes
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.approvalMode === "auto" ? "AI auto-approves on-brand posts" : "You review every post"}
                    </p>
                  </div>
                  <Select
                    value={b.approvalMode ?? "manual"}
                    onValueChange={(v) => {
                      updateBrand.mutate(
                        { id: b.id, data: { approvalMode: v as "manual" | "auto" } },
                        {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
                            toast.success(`${b.name} → ${v} mode`);
                          },
                          onError: (e: any) => toast.error(friendlyError(e, "Couldn't update the post. Please try again.")),
                        },
                      );
                    }}
                    disabled={!canApprove}
                  >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="auto">AI auto</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setMemoryFor(b.id)} title="View brand memory">
                    <Brain className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brand filter */}
        {brands && brands.length > 0 && (
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Label className="text-xs text-muted-foreground">Filter by brand:</Label>
            <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setSelected(new Set()); }}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands ({((posts as PostRow[] | undefined) ?? []).length})</SelectItem>
                {brands.map((b: any) => {
                  const c = ((posts as PostRow[] | undefined) ?? []).filter((p) => p.brandId === b.id).length;
                  return (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name} ({c})</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {brandFilter !== "all" && (
              <Button size="sm" variant="ghost" onClick={() => setBrandFilter("all")}>Clear</Button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
          {TABS.map((t) => {
            const count = countFor(t.statuses);
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelected(new Set()); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label} <span className="ml-1 text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="flex-1" />
            {tab === "pending" && canApprove && (
              <>
                <Button size="sm" onClick={() => bulk.mutate({ action: "approve", publish: false })} disabled={bulk.isPending}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="default" onClick={() => bulk.mutate({ action: "approve", publish: true })} disabled={bulk.isPending}>
                  <Check className="w-4 h-4 mr-1" /> Approve & publish
                </Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  const reason = window.prompt("Rejection reason (optional)") ?? undefined;
                  bulk.mutate({ action: "reject", reason });
                }} disabled={bulk.isPending}>
                  <XIcon className="w-4 h-4 mr-1" /> Reject
                </Button>
              </>
            )}
            {(tab === "pending" || tab === "scheduled") && canEdit && (
              <Button size="sm" variant="outline" onClick={() => {
                const when = window.prompt("New schedule (ISO date, e.g. 2026-05-10T14:00:00Z)");
                if (when) bulk.mutate({ action: "reschedule", scheduledFor: when });
              }} disabled={bulk.isPending}>
                <CalIcon className="w-4 h-4 mr-1" /> Reschedule
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => {
                if (window.confirm(`Delete ${selected.size} post(s)? This cannot be undone.`)) {
                  bulk.mutate({ action: "delete" });
                }
              }} disabled={bulk.isPending}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl">
            <EmptyState
              icon={ClipboardCheck}
              title={tab === "pending" ? "All caught up" : "Nothing here yet"}
              description={
                tab === "pending"
                  ? "No posts are waiting on your approval. Generate a batch to fill the queue, or come back after your next round of drafts."
                  : tab === "approved"
                  ? "Approved drafts will land here. Approve one from the Pending tab and watch it appear."
                  : "Rejected drafts get archived here so the AI can learn from what didn't work."
              }
              primaryCta={
                tab === "pending" && canEdit
                  ? { label: "Generate a batch", onClick: () => setBatchOpen(true), icon: Wand2 }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-secondary/40 text-xs font-medium text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              <span>Select all on this tab</span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/30">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                    className="mt-1.5"
                    aria-label={`Select post ${p.id}`}
                  />
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-md object-cover flex-shrink-0 bg-secondary" />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-secondary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
                      <PlatformIcon platform={p.platform} />
                      <span className="font-medium text-foreground">{p.brandName ?? `Brand ${p.brandId}`}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</span>
                      {p.scheduledFor && (
                        <>
                          <span>·</span>
                          <span>scheduled {format(new Date(p.scheduledFor), "MMM d, HH:mm")}</span>
                        </>
                      )}
                      {p.aiApproved === "yes" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                          AI ✓
                        </span>
                      )}
                      {p.aiApproved === "no" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 inline-flex items-center gap-1" title={p.aiReviewReason ?? ""}>
                          <AlertCircle className="w-3 h-3" /> AI ✗
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">{p.content || <em className="text-muted-foreground">(no content)</em>}</p>
                    {p.aiReviewReason && p.aiApproved === "no" && (
                      <p className="text-xs text-red-700 mt-1 italic">AI: {p.aiReviewReason}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {canEdit && (p.status === "pending_approval" || p.status === "scheduled") && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editing && (
        <EditPostDialog
          post={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => editPost.mutate({ id: editing.id, ...patch })}
          saving={editPost.isPending}
        />
      )}
      {batchOpen && (
        <BatchGenerateDialog
          brands={(brands as any[]) ?? []}
          plan={(activeWorkspace as any)?.plan ?? "free"}
          onClose={() => setBatchOpen(false)}
          onGenerate={(input) => generateBatch.mutate(input)}
          generating={generateBatch.isPending}
        />
      )}
      {memoryFor !== null && (
        <BrandMemoryDialog brandId={memoryFor} onClose={() => setMemoryFor(null)} authedFetch={authedFetch} />
      )}
    </Layout>
  );
}

function EditPostDialog({
  post,
  onClose,
  onSave,
  saving,
}: {
  post: PostRow;
  onClose: () => void;
  onSave: (patch: { content?: string; scheduledFor?: string | null; imageUrl?: string | null }) => void;
  saving: boolean;
}) {
  const [content, setContent] = useState(post.content);
  const [scheduledFor, setScheduledFor] = useState(
    post.scheduledFor ? new Date(post.scheduledFor).toISOString().slice(0, 16) : "",
  );
  const [imageUrl, setImageUrl] = useState(post.imageUrl ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>
            Your edits teach the AI your preferred voice — future generations will mimic this style.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="content">Caption</Label>
            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="schedule">Scheduled for</Label>
              <Input id="schedule" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="img">Image URL</Label>
              <Input id="img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={() =>
              onSave({
                content,
                scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
                imageUrl: imageUrl || null,
              })
            }
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchGenerateDialog({
  brands, plan, onClose, onGenerate, generating,
}: {
  brands: any[];
  plan: string;
  onClose: () => void;
  onGenerate: (input: { brandId: number; days: number; platforms: string[] }) => void;
  generating: boolean;
}) {
  const maxDays = PLAN_BATCH_DAYS[plan] ?? 7;
  const [brandId, setBrandId] = useState<number | null>(brands[0]?.id ?? null);
  const [days, setDays] = useState(maxDays);
  const brand = brands.find((b) => b.id === brandId);
  const [platforms, setPlatforms] = useState<string[]>(brand?.platforms ?? []);

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-primary" /> Generate post batch</DialogTitle>
          <DialogDescription>
            Pre-generate up to {maxDays} days of posts on your <span className="font-medium">{plan}</span> plan.
            {brand?.approvalMode === "auto" && " AI will auto-approve on-brand posts and reject the rest."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Brand</Label>
            <Select value={brandId ? String(brandId) : ""} onValueChange={(v) => {
              const id = Number(v);
              setBrandId(id);
              const b = brands.find((x) => x.id === id);
              setPlatforms(b?.platforms ?? []);
            }}>
              <SelectTrigger><SelectValue placeholder="Pick a brand" /></SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Days ({days})</Label>
            <Input type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(Math.min(maxDays, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <Label className="block mb-2">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {(brand?.platforms ?? ["instagram", "facebook", "linkedin"]).map((p: string) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    platforms.includes(p) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button
            onClick={() => brandId && onGenerate({ brandId, days, platforms })}
            disabled={generating || !brandId || platforms.length === 0}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate {days * platforms.length} posts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandMemoryDialog({
  brandId, onClose, authedFetch,
}: {
  brandId: number;
  onClose: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  useMemo(() => {
    (async () => {
      setLoading(true);
      const r = await authedFetch(`/api/brands/${brandId}/memory`).catch(() => null);
      const body = r ? await r.json().catch(() => null) : null;
      setData(body);
      setLoading(false);
    })();
  }, [brandId]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> Brand AI memory</DialogTitle>
          <DialogDescription>
            What the AI has learned about your brand voice from your approvals, edits, and rejections.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-6 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data ? (
          <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 p-2"><div className="text-lg font-bold text-green-700">{data.approvedCount ?? 0}</div><div className="text-[11px] text-green-700">Approved</div></div>
              <div className="rounded-lg bg-blue-50 p-2"><div className="text-lg font-bold text-blue-700">{data.editedCount ?? 0}</div><div className="text-[11px] text-blue-700">Edited</div></div>
              <div className="rounded-lg bg-rose-50 p-2"><div className="text-lg font-bold text-rose-700">{data.rejectedCount ?? 0}</div><div className="text-[11px] text-rose-700">Rejected</div></div>
            </div>
            {data.distilledGuidelines ? (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Learned style guide</h3>
                <pre className="text-xs whitespace-pre-wrap rounded-lg bg-secondary p-3">{data.distilledGuidelines}</pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Approve or edit a few more posts to unlock the AI's distilled style guide.</p>
            )}
            {(data.approvedSamples ?? []).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Recent approved examples</h3>
                <ul className="space-y-1">
                  {data.approvedSamples.slice(0, 5).map((s: string, i: number) => (
                    <li key={i} className="text-xs rounded border border-border px-2 py-1">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {(data.editPatterns ?? []).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Your edit patterns</h3>
                <ul className="space-y-1">
                  {data.editPatterns.slice(0, 5).map((p: any, i: number) => (
                    <li key={i} className="text-xs rounded border border-border px-2 py-1">
                      <div className="text-muted-foreground line-through">{p.from}</div>
                      <div>{p.to}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load memory.</p>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
