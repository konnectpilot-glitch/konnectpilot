import Layout from "@/components/layout";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Loader2,
  Plus,
  Pause,
  Play,
  Trash2,
  Clock,
  Hash,
  CheckCircle2,
  XCircle,
  ImageIcon,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLATFORM_OPTIONS = [
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
];

type Schedule = {
  id: number;
  brandId: number;
  brandName: string;
  name: string;
  isActive: boolean;
  platforms: string[];
  postTimes: string[];
  timezone: string;
  contentPrompt: string | null;
  imageStyle: string | null;
  lastRunAt: string | null;
  createdAt: string;
};

type Brand = {
  id: number;
  name: string;
};

type SchedulePost = {
  id: number;
  platform: string;
  content: string;
  imageUrl: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useBrands(token: string | null) {
  return useQuery<Brand[]>({
    queryKey: ["brands"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/brands`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load brands");
      return res.json();
    },
  });
}

function useSchedules(token: string | null) {
  return useQuery<Schedule[]>({
    queryKey: ["schedules"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/schedules`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load schedules");
      return res.json();
    },
  });
}

function useSchedulePosts(scheduleId: number | null, token: string | null) {
  return useQuery<SchedulePost[]>({
    queryKey: ["schedule-posts", scheduleId],
    enabled: !!scheduleId && !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/schedules/${scheduleId}/posts`, {
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
  });
}

function ScheduleForm({
  brands,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  brands: Brand[];
  initial?: Partial<Schedule>;
  onSubmit: (values: any) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brandId, setBrandId] = useState<number | "">(
    initial?.brandId ?? brands[0]?.id ?? "",
  );
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? ["facebook"]);
  const [postsPerDay, setPostsPerDay] = useState(initial?.postTimes?.length ?? 1);
  const [postTimes, setPostTimes] = useState<string[]>(initial?.postTimes ?? ["09:00"]);
  const [contentPrompt, setContentPrompt] = useState(initial?.contentPrompt ?? "");
  const [imageStyle, setImageStyle] = useState(initial?.imageStyle ?? "");

  const togglePlatform = (id: string) => {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const updatePostsPerDay = (n: number) => {
    const clamped = Math.max(1, Math.min(12, n));
    setPostsPerDay(clamped);
    setPostTimes((prev) => {
      const next = [...prev];
      while (next.length < clamped) {
        const last = next[next.length - 1] ?? "09:00";
        const [h, m] = last.split(":").map(Number);
        const newH = Math.min(23, h + 4);
        next.push(`${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
      while (next.length > clamped) next.pop();
      return next;
    });
  };

  const updateTime = (i: number, val: string) => {
    setPostTimes((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give your schedule a name");
      return;
    }
    if (!brandId) {
      toast.error("Pick a brand");
      return;
    }
    if (platforms.length === 0) {
      toast.error("Pick at least one platform");
      return;
    }
    onSubmit({
      name: name.trim(),
      brandId: Number(brandId),
      platforms,
      postTimes,
      timezone: "UTC",
      contentPrompt: contentPrompt.trim() || null,
      imageStyle: imageStyle.trim() || null,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">Schedule name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily morning posts"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Brand</label>
        <select
          value={brandId}
          onChange={(e) => setBrandId(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background"
        >
          {brands.length === 0 ? (
            <option value="">No brands — create one first</option>
          ) : (
            brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Platforms</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const on = platforms.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition",
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {on && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Posts per day</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => updatePostsPerDay(postsPerDay - 1)}
            className="w-8 h-8 rounded-lg border border-border hover:bg-secondary"
          >
            −
          </button>
          <span className="text-lg font-semibold w-8 text-center">{postsPerDay}</span>
          <button
            type="button"
            onClick={() => updatePostsPerDay(postsPerDay + 1)}
            className="w-8 h-8 rounded-lg border border-border hover:bg-secondary"
          >
            +
          </button>
          <span className="text-xs text-muted-foreground ml-2">Up to 12 per day</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Post times (UTC, 24-hour)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {postTimes.map((t, i) => (
            <input
              key={i}
              type="time"
              value={t}
              onChange={(e) => updateTime(i, e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Times are in UTC. Add your local offset to convert.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Content theme <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </label>
        <textarea
          value={contentPrompt}
          onChange={(e) => setContentPrompt(e.target.value)}
          placeholder="e.g. Highlight customer testimonials, behind-the-scenes content, weekly tips"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Image style <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </label>
        <input
          value={imageStyle}
          onChange={(e) => setImageStyle(e.target.value)}
          placeholder="e.g. clean minimalist, bold colorful, lifestyle photography"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={submit} disabled={submitting} className="flex-1">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save schedule
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ScheduleHistory({ scheduleId, token }: { scheduleId: number; token: string | null }) {
  const { data: posts = [], isLoading } = useSchedulePosts(scheduleId, token);
  const queryClient = useQueryClient();

  const retry = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/posts/${id}/retry`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Retry failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-posts", scheduleId] });
      toast.success("Post published");
    },
    onError: (e: any) => toast.error(e?.message ?? "Retry failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No posts yet. The next scheduled time will trigger a post automatically.
      </p>
    );
  }
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
      {posts.map((p) => (
        <div key={p.id} className="border border-border rounded-lg p-3 flex gap-3 text-sm">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium capitalize">{p.platform}</span>
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-medium",
                  p.status === "published"
                    ? "bg-green-50 text-green-700"
                    : p.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700",
                )}
              >
                {p.status}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(p.scheduledFor ?? p.createdAt).toLocaleString()}
              </span>
              {p.status === "failed" && (
                <button
                  onClick={() => retry.mutate(p.id)}
                  disabled={retry.isPending && retry.variables === p.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  title="Retry publishing"
                >
                  {retry.isPending && retry.variables === p.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Retry
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {p.content || p.errorMessage || "—"}
            </p>
            {p.errorMessage && p.status === "failed" && (
              <p className="text-xs text-red-600 mt-1 line-clamp-2">{p.errorMessage}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SchedulesPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getToken().then((t) => { if (!cancelled) setToken(t); });
    return () => { cancelled = true; };
  }, [getToken]);

  const { data: brands = [] } = useBrands(token);
  const { data: schedules = [], isLoading } = useSchedules(token);

  const createMut = useMutation({
    mutationFn: async (values: any) => {
      const t = await getToken();
      const res = await fetch(`${BASE_URL}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(t) },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule created");
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: any }) => {
      const t = await getToken();
      const res = await fetch(`${BASE_URL}/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(t) },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule updated");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const t = await getToken();
      const res = await fetch(`${BASE_URL}/api/schedules/${id}`, {
        method: "DELETE",
        headers: authHeaders(t),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted");
    },
  });

  const togglePause = (s: Schedule) =>
    updateMut.mutate({ id: s.id, values: { isActive: !s.isActive } });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Auto Post Schedules</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              KonnectPilot generates an image and caption at each scheduled time, then publishes to your connected accounts.
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} disabled={brands.length === 0}>
            <Plus className="w-4 h-4 mr-1.5" /> New schedule
          </Button>
        </div>

        {brands.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <CalendarClock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">Create a brand first</p>
            <p className="text-sm text-muted-foreground mt-1">
              Schedules need a brand to generate on-brand content.
            </p>
            <Button className="mt-4" onClick={() => (window.location.href = `${BASE_URL}/brands/new`)}>
              Create your first brand
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading schedules…
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <CalendarClock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">No schedules yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create one to start auto-posting at the times you choose.
            </p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create schedule
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {schedules.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl border bg-card p-5",
                  s.isActive ? "border-border" : "border-border opacity-60",
                )}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {s.brandName}
                      </span>
                      {!s.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Paused
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        {s.postTimes.length} post{s.postTimes.length === 1 ? "" : "s"}/day
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {s.postTimes.join(", ")} UTC
                      </span>
                      <span className="flex items-center gap-1">
                        {s.platforms.map((p) => {
                          const opt = PLATFORM_OPTIONS.find((o) => o.id === p);
                          return (
                            <span
                              key={p}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: `${opt?.color}20`, color: opt?.color }}
                            >
                              {opt?.label ?? p}
                            </span>
                          );
                        })}
                      </span>
                    </div>

                    {s.contentPrompt && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                        Theme: {s.contentPrompt}
                      </p>
                    )}
                    {s.lastRunAt && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Last run: {new Date(s.lastRunAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistoryId(s.id)}
                      title="View history"
                    >
                      History
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(s)}
                      title="Edit"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePause(s)}
                      title={s.isActive ? "Pause" : "Resume"}
                    >
                      {s.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(s.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm || editing !== null} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit schedule" : "New auto-post schedule"}</DialogTitle>
            <DialogDescription>
              KonnectPilot will generate AI content and publish at these times every day.
            </DialogDescription>
          </DialogHeader>
          <ScheduleForm
            brands={brands}
            initial={editing ?? undefined}
            submitting={createMut.isPending || updateMut.isPending}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onSubmit={(values) => {
              if (editing) {
                updateMut.mutate({ id: editing.id, values });
              } else {
                createMut.mutate(values);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={historyId !== null} onOpenChange={(o) => { if (!o) setHistoryId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule history</DialogTitle>
            <DialogDescription>Recent posts created by this schedule.</DialogDescription>
          </DialogHeader>
          {historyId !== null && <ScheduleHistory scheduleId={historyId} token={token} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              The schedule will stop running. Posts already published won't be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId !== null) {
                  deleteMut.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
