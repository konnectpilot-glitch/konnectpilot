import Layout from "@/components/layout";
import { Link, useRoute, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetBrand,
  useUpdateBrand,
  useDeleteBrand,
  useListPosts,
  getListBrandsQueryKey,
  getGetBrandQueryKey,
  getListPostsQueryKey,
} from "@workspace/api-client-react";
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
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Sparkles,
  Plus,
  Pause,
  Play,
  Clock,
  Hash,
  CheckCircle2,
  ImageIcon,
  RotateCcw,
  Zap,
  FileText,
  Link2,
  ExternalLink,
  CalendarClock,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLATFORM_OPTIONS = [
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
];

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "fun", label: "Fun" },
  { id: "inspirational", label: "Inspirational" },
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

// ──────────────────────────────────────────────────────────────────────────────
// Schedule form (pre-scoped to one brand — no brand picker)
// ──────────────────────────────────────────────────────────────────────────────

function ScheduleForm({
  brandId,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  brandId: number;
  initial?: Partial<Schedule>;
  onSubmit: (values: any) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? ["facebook"]);
  const [postsPerDay, setPostsPerDay] = useState(initial?.postTimes?.length ?? 1);
  const [postTimes, setPostTimes] = useState<string[]>(initial?.postTimes ?? ["09:00"]);
  const [contentPrompt, setContentPrompt] = useState(initial?.contentPrompt ?? "");
  const [imageStyle, setImageStyle] = useState(initial?.imageStyle ?? "");

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
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
    if (platforms.length === 0) {
      toast.error("Pick at least one platform");
      return;
    }
    onSubmit({
      name: name.trim(),
      brandId,
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
        <p className="text-xs text-muted-foreground mt-1">Times are in UTC. Add your local offset to convert.</p>
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
        <p className="text-xs text-muted-foreground mt-1">
          A clear theme gives the AI direction and produces sharper, more on-brand posts.
        </p>
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

// ──────────────────────────────────────────────────────────────────────────────
// Schedule history (per-schedule recent posts)
// ──────────────────────────────────────────────────────────────────────────────

function ScheduleHistory({ scheduleId, token }: { scheduleId: number; token: string | null }) {
  const queryClient = useQueryClient();
  const { data: posts = [], isLoading } = useQuery<SchedulePost[]>({
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

// ──────────────────────────────────────────────────────────────────────────────
// Tabs
// ──────────────────────────────────────────────────────────────────────────────

type TabId = "overview" | "schedules" | "posts" | "connections";

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {count != null && (
        <span
          className={cn(
            "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full",
            active ? "bg-primary/10 text-primary" : "bg-secondary",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Overview tab — inline edit identity
// ──────────────────────────────────────────────────────────────────────────────

function OverviewTab({ brand, brandId }: { brand: any; brandId: number }) {
  const queryClient = useQueryClient();
  const updateBrand = useUpdateBrand();
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: brand.name,
      industry: brand.industry,
      tone: brand.tone,
      targetAudience: brand.targetAudience,
      keywords: brand.keywords,
    },
  });

  useEffect(() => {
    reset({
      name: brand.name,
      industry: brand.industry,
      tone: brand.tone,
      targetAudience: brand.targetAudience,
      keywords: brand.keywords,
    });
  }, [brand, reset]);

  function onSubmit(data: any) {
    updateBrand.mutate(
      { id: brandId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBrandQueryKey(brandId) });
          toast.success("Brand updated");
          setEditing(false);
        },
        onError: (err: any) => toast.error(err?.data?.error ?? "Failed to update"),
      },
    );
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Brand identity</h2>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Name</dt>
              <dd className="font-medium">{brand.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Industry</dt>
              <dd className="font-medium capitalize">{brand.industry}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Tone</dt>
              <dd className="font-medium capitalize">{brand.tone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Target audience</dt>
              <dd className="font-medium">{brand.targetAudience}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground mb-0.5">Keywords</dt>
              <dd className="font-medium">{brand.keywords}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Tip — for the best AI posts:</span> a
          specific target audience, vivid keywords, and a per-schedule content theme produce
          dramatically better captions and images. Edit the schedule to set its theme.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-sm">Edit brand identity</h2>

      <div>
        <label className="block text-sm font-medium mb-1.5">Brand name *</label>
        <input
          {...register("name", { required: "Brand name is required" })}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message as string}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Industry *</label>
        <input
          {...register("industry", { required: "Industry is required" })}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        {errors.industry && <p className="text-destructive text-xs mt-1">{errors.industry.message as string}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Tone of voice *</label>
        <Controller
          name="tone"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => field.onChange(id)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                    field.value === id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-secondary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Target audience *</label>
        <input
          {...register("targetAudience", { required: "Target audience is required" })}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        {errors.targetAudience && <p className="text-destructive text-xs mt-1">{errors.targetAudience.message as string}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Keywords *</label>
        <input
          {...register("keywords", { required: "Keywords are required" })}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || updateBrand.isPending} className="flex-1">
          {(isSubmitting || updateBrand.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Schedules tab — pre-filtered to this brand
// ──────────────────────────────────────────────────────────────────────────────

function SchedulesTab({ brandId, token }: { brandId: number; token: string | null }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/schedules`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load schedules");
      return res.json();
    },
  });

  const brandSchedules = useMemo(
    () => schedules.filter((s) => s.brandId === brandId),
    [schedules, brandId],
  );

  const createMut = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch(`${BASE_URL}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
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
      const res = await fetch(`${BASE_URL}/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
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
      const res = await fetch(`${BASE_URL}/api/schedules/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted");
    },
  });

  const togglePause = (s: Schedule) => updateMut.mutate({ id: s.id, values: { isActive: !s.isActive } });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Auto-post schedules
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            KonnectPilot generates an image and caption for this brand at each scheduled time, then publishes.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1" /> New schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : brandSchedules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <CalendarClock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-sm">No schedules for this brand yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            A schedule defines when, where, and what theme — the AI handles the rest.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create schedule
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          {brandSchedules.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-card p-4",
                s.isActive ? "border-border" : "border-border opacity-70",
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{s.name}</h3>
                    {s.isActive ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {s.postTimes.length} post{s.postTimes.length === 1 ? "" : "s"}/day
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.postTimes.join(", ")} UTC
                    </span>
                    <span className="flex items-center gap-1">
                      {s.platforms.map((p) => {
                        const opt = PLATFORM_OPTIONS.find((o) => o.id === p);
                        return (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: `${opt?.color}20`, color: opt?.color }}
                          >
                            {opt?.label ?? p}
                          </span>
                        );
                      })}
                    </span>
                  </div>

                  {s.contentPrompt && (
                    <p className="text-[11px] text-muted-foreground mt-2 italic">
                      Theme: {s.contentPrompt}
                    </p>
                  )}
                  {s.lastRunAt && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Last run: {new Date(s.lastRunAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => setHistoryId(s.id)} title="History">
                    <HistoryIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => togglePause(s)} title={s.isActive ? "Pause" : "Resume"}>
                    {s.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(s.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm || editing !== null} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit schedule" : "New auto-post schedule"}</DialogTitle>
            <DialogDescription>
              KonnectPilot will generate AI content for this brand and publish at these times every day.
            </DialogDescription>
          </DialogHeader>
          <ScheduleForm
            brandId={brandId}
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Posts tab — recent posts for this brand
// ──────────────────────────────────────────────────────────────────────────────

function PostsTab({ brandId }: { brandId: number }) {
  const { data: posts = [], isLoading } = useListPosts();
  const brandPosts = useMemo(() => posts.filter((p: any) => p.brandId === brandId), [posts, brandId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading posts…
      </div>
    );
  }
  if (brandPosts.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium text-sm">No posts yet for this brand</p>
        <p className="text-xs text-muted-foreground mt-1">
          Posts will appear here as schedules run, or when you manually generate.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {brandPosts.slice(0, 30).map((p: any) => (
        <div key={p.id} className="border border-border rounded-lg p-3 flex gap-3 text-sm bg-card">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded bg-secondary flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium capitalize text-xs">{p.platform}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  p.status === "published"
                    ? "bg-green-50 text-green-700"
                    : p.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : p.status === "scheduled"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-secondary text-muted-foreground",
                )}
              >
                {p.status}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {new Date(p.scheduledFor ?? p.publishedAt ?? p.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{p.content || "—"}</p>
          </div>
        </div>
      ))}
      {brandPosts.length > 30 && (
        <Link
          href="/posts"
          className="block text-center text-xs text-primary hover:underline py-2"
        >
          View all {brandPosts.length} posts →
        </Link>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Connections tab
// ──────────────────────────────────────────────────────────────────────────────

function ConnectionsTab({ token }: { token: string | null }) {
  const { data: accounts = [], isLoading } = useQuery<any[]>({
    queryKey: ["social-accounts"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/social-accounts`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Connected accounts</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Social accounts are connected at the workspace level and shared across all brands.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Link2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-sm">No social accounts connected</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Without a connected account, schedules will generate posts but can't publish.
          </p>
          <Link href="/accounts">
            <Button size="sm">
              Connect an account <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            {accounts.map((a: any) => {
              const opt = PLATFORM_OPTIONS.find((o) => o.id === a.platform);
              return (
                <div key={a.id} className="border border-border rounded-lg p-3 flex items-center gap-3 bg-card">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: `${opt?.color ?? "#888"}20`, color: opt?.color ?? "#888" }}
                  >
                    {(opt?.label ?? a.platform).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.accountName ?? opt?.label ?? a.platform}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{a.platform}</p>
                  </div>
                  {a.isActive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                      Inactive
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Link href="/accounts" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
            Manage connections <ExternalLink className="w-3 h-3" />
          </Link>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default function BrandDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/brands/:id");
  const brandId = Number(params?.id);
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("schedules");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken().then((t) => { if (!cancelled) setToken(t); });
    return () => { cancelled = true; };
  }, [getToken]);

  const { data: brand, isLoading } = useGetBrand(brandId, {
    query: { enabled: Number.isFinite(brandId) && brandId > 0, queryKey: getGetBrandQueryKey(brandId) },
  });

  const { data: allSchedules = [] } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/schedules`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const scheduleCount = allSchedules.filter((s) => s.brandId === brandId).length;

  const { data: allPosts = [] } = useListPosts();
  const postCount = (allPosts as any[]).filter((p) => p.brandId === brandId).length;

  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["social-accounts"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/social-accounts`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const deleteBrand = useDeleteBrand();

  if (!Number.isFinite(brandId) || brandId <= 0) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground">Invalid brand id.</p>
          <Link href="/brands" className="text-sm text-primary hover:underline">← Back to brands</Link>
        </div>
      </Layout>
    );
  }

  if (isLoading || !brand) {
    return (
      <Layout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading brand…
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/brands" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Brands
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{brand.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{brand.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                {brand.industry} · {brand.tone} tone
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border flex items-center gap-1">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabButton>
          <TabButton active={tab === "schedules"} count={scheduleCount} onClick={() => setTab("schedules")}>Schedules</TabButton>
          <TabButton active={tab === "posts"} count={postCount} onClick={() => setTab("posts")}>Posts</TabButton>
          <TabButton active={tab === "connections"} count={accounts.length} onClick={() => setTab("connections")}>Connections</TabButton>
        </div>

        {/* Tab content */}
        <div className="pt-1">
          {tab === "overview" && <OverviewTab brand={brand} brandId={brandId} />}
          {tab === "schedules" && <SchedulesTab brandId={brandId} token={token} />}
          {tab === "posts" && <PostsTab brandId={brandId} />}
          {tab === "connections" && <ConnectionsTab token={token} />}
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete brand?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{brand.name}" along with all its schedules and post history.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  deleteBrand.mutate(
                    { id: brandId },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
                        toast.success(`Brand "${brand.name}" deleted`);
                        setLocation("/brands");
                      },
                      onError: () => toast.error("Failed to delete brand"),
                    },
                  );
                }}
              >
                Delete brand
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
