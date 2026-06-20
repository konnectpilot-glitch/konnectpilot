import Layout from "@/components/layout";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrands,
  useGetAnalyticsSummary,
  useGetAnalyticsTimeseries,
  useGetAnalyticsTopPosts,
  useListAiInsights,
  useGetPerformanceMemory,
  useRefreshAiInsights,
  useDismissAiInsight,
  useApplyAiInsight,
  useUndoAiInsight,
  useGenerateAnalyticsReport,
  useCompareAnalyticsPosts,
  getListAiInsightsQueryKey,
  getGetPerformanceMemoryQueryKey,
  getGetAnalyticsSummaryQueryKey,
  getGetAnalyticsTimeseriesQueryKey,
  getGetAnalyticsTopPostsQueryKey,
  getCompareAnalyticsPostsQueryKey,
} from "@workspace/api-client-react";
import {
  LineChart as LineIcon,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Download,
  X,
  Lightbulb,
  Brain,
  Trophy,
  Check,
  GitCompare,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Range = "7d" | "30d" | "90d";

function StatCard({
  label,
  value,
  prev,
  format = (v: number) => v.toLocaleString(),
}: {
  label: string;
  value: number;
  prev?: number;
  format?: (v: number) => string;
}) {
  const delta = prev !== undefined && prev > 0 ? ((value - prev) / prev) * 100 : null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{format(value)}</p>
      {delta !== null && (
        <p
          className={`text-xs mt-1 flex items-center gap-1 ${
            delta >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {delta >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

function ContentTypeBreakdown({
  byPlatform,
}: {
  byPlatform: Record<string, string[]>;
}) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const list of Object.values(byPlatform || {})) {
      for (const t of list) counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([type, score]) => ({ type, score }))
      .sort((a, b) => b.score - a.score);
  }, [byPlatform]);
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Not enough data yet — content type breakdown appears once posts gather engagement.
      </p>
    );
  }
  return (
    <div className="h-48" data-testid="content-type-breakdown">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={90} />
          <Tooltip />
          <Bar dataKey="score" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompareDrawer({
  ids,
  onClose,
}: {
  ids: [number, number] | null;
  onClose: () => void;
}) {
  const enabled = ids !== null;
  const compareParams = { a: ids?.[0] ?? 0, b: ids?.[1] ?? 0 };
  const compare = useCompareAnalyticsPosts(compareParams, {
    query: { enabled, queryKey: getCompareAnalyticsPostsQueryKey(compareParams) },
  });
  if (!enabled) return null;
  const a = compare.data?.a;
  const b = compare.data?.b;
  const renderSide = (side: typeof a | undefined, label: string) => {
    const m = (side?.metrics ?? {}) as Record<string, number>;
    const post = (side?.post ?? {}) as Record<string, unknown>;
    return (
      <div className="flex-1 border border-border rounded-lg p-3 bg-card" data-testid={`compare-${label}`}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Post {label.toUpperCase()}
        </p>
        <p className="text-sm mt-1 line-clamp-3">
          {String(post.content ?? "(no content)")}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div><span className="text-muted-foreground">Reach</span><br /><b>{Number(m.reach ?? 0).toLocaleString()}</b></div>
          <div><span className="text-muted-foreground">Impressions</span><br /><b>{Number(m.impressions ?? 0).toLocaleString()}</b></div>
          <div><span className="text-muted-foreground">Likes</span><br /><b>{Number(m.likes ?? 0).toLocaleString()}</b></div>
          <div><span className="text-muted-foreground">Comments</span><br /><b>{Number(m.comments ?? 0).toLocaleString()}</b></div>
          <div><span className="text-muted-foreground">Shares</span><br /><b>{Number(m.shares ?? 0).toLocaleString()}</b></div>
          <div><span className="text-muted-foreground">Eng. rate</span><br /><b>{((Number(m.engagementRate ?? 0)) * 100).toFixed(2)}%</b></div>
        </div>
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-background w-full md:max-w-3xl md:rounded-xl p-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="compare-drawer"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <GitCompare className="w-4 h-4" /> Compare posts
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {compare.isLoading ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Loading…</p>
        ) : (
          <div className="flex flex-col md:flex-row gap-3">
            {renderSide(a, "a")}
            {renderSide(b, "b")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: brands } = useListBrands();
  const [brandId, setBrandId] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("30d");
  const [platform, setPlatform] = useState<string>("");
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  const [compareIds, setCompareIds] = useState<[number, number] | null>(null);
  const queryClient = useQueryClient();

  const activeBrandId = brandId ?? brands?.[0]?.id ?? null;
  const enabled = !!activeBrandId;

  const summaryParams = { range, platform: platform || undefined };
  const topParams = { range, platform: platform || undefined, limit: 8 };
  const summary = useGetAnalyticsSummary(activeBrandId ?? 0, summaryParams, {
    query: { enabled, queryKey: getGetAnalyticsSummaryQueryKey(activeBrandId ?? 0, summaryParams) },
  });
  const series = useGetAnalyticsTimeseries(activeBrandId ?? 0, summaryParams, {
    query: { enabled, queryKey: getGetAnalyticsTimeseriesQueryKey(activeBrandId ?? 0, summaryParams) },
  });
  const top = useGetAnalyticsTopPosts(activeBrandId ?? 0, topParams, {
    query: { enabled, queryKey: getGetAnalyticsTopPostsQueryKey(activeBrandId ?? 0, topParams) },
  });
  const insights = useListAiInsights(activeBrandId ?? 0, {
    query: { enabled, queryKey: getListAiInsightsQueryKey(activeBrandId ?? 0) },
  });
  const memory = useGetPerformanceMemory(activeBrandId ?? 0, {
    query: { enabled, queryKey: getGetPerformanceMemoryQueryKey(activeBrandId ?? 0) },
  });

  const refresh = useRefreshAiInsights({
    mutation: {
      onSuccess: (r) => {
        toast.success(`Generated ${r.created} new insights`);
        if (activeBrandId) {
          queryClient.invalidateQueries({ queryKey: getListAiInsightsQueryKey(activeBrandId) });
          queryClient.invalidateQueries({ queryKey: getGetPerformanceMemoryQueryKey(activeBrandId) });
        }
      },
      onError: (err: Error) => toast.error(err?.message ?? "Failed to refresh"),
    },
  });
  const dismiss = useDismissAiInsight({
    mutation: {
      onSuccess: () => {
        if (activeBrandId)
          queryClient.invalidateQueries({ queryKey: getListAiInsightsQueryKey(activeBrandId) });
      },
    },
  });
  const [recentlyApplied, setRecentlyApplied] = useState<Record<number, number>>({});
  const apply = useApplyAiInsight({
    mutation: {
      onSuccess: (r, vars) => {
        toast.success(r.applied?.summary ?? "Recommendation applied.");
        setRecentlyApplied((m) => ({ ...m, [vars.id]: Date.now() }));
        if (activeBrandId) {
          queryClient.invalidateQueries({ queryKey: getListAiInsightsQueryKey(activeBrandId) });
          queryClient.invalidateQueries({ queryKey: getGetPerformanceMemoryQueryKey(activeBrandId) });
        }
      },
      onError: (err: Error) => toast.error(err?.message ?? "Failed to apply"),
    },
  });
  const undo = useUndoAiInsight({
    mutation: {
      onSuccess: (_r, vars) => {
        toast.success("Reverted.");
        setRecentlyApplied((m) => {
          const n = { ...m };
          delete n[vars.id];
          return n;
        });
        if (activeBrandId)
          queryClient.invalidateQueries({ queryKey: getListAiInsightsQueryKey(activeBrandId) });
      },
      onError: (err: Error) => toast.error(err?.message ?? "Failed to undo"),
    },
  });
  const report = useGenerateAnalyticsReport({
    mutation: {
      onSuccess: (r) => {
        toast.success(`${r.period} report generated`);
        const w = window.open();
        if (w && r.html) {
          w.document.open();
          w.document.write(r.html);
          w.document.close();
        }
      },
      onError: (err: Error) => toast.error(err?.message ?? "Failed to generate report"),
    },
  });

  const heatmap = useMemo(() => {
    if (!memory.data?.bestHoursByPlatform) return null;
    return Object.entries(memory.data.bestHoursByPlatform).map(([p, hours]) => ({
      platform: p,
      hours: hours as number[],
    }));
  }, [memory.data]);

  function togglePostForCompare(id: number) {
    setSelectedForCompare((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      const next = [...cur, id].slice(-2);
      if (next.length === 2) {
        setCompareIds([next[0], next[1]]);
        return [];
      }
      return next;
    });
  }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="analytics-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LineIcon className="w-6 h-6 text-primary" /> Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track performance and let AI improve your content over time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeBrandId && refresh.mutate({ id: activeBrandId })}
              disabled={!activeBrandId || refresh.isPending}
              data-testid="btn-refresh-insights"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refresh.isPending ? "animate-spin" : ""}`} />
              Refresh insights
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeBrandId && report.mutate({ id: activeBrandId, data: { period: "weekly" } })}
              disabled={!activeBrandId || report.isPending}
              data-testid="btn-weekly-report"
            >
              <Download className="w-4 h-4 mr-1.5" /> Weekly
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeBrandId && report.mutate({ id: activeBrandId, data: { period: "monthly" } })}
              disabled={!activeBrandId || report.isPending}
              data-testid="btn-monthly-report"
            >
              <Download className="w-4 h-4 mr-1.5" /> Monthly
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center bg-card border border-border rounded-xl p-3">
          <Select
            value={String(activeBrandId ?? "")}
            onValueChange={(v) => setBrandId(Number(v))}
          >
            <SelectTrigger className="w-56" data-testid="select-brand">
              <SelectValue placeholder="Select a brand" />
            </SelectTrigger>
            <SelectContent>
              {(brands ?? []).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-32" data-testid="select-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform || "all"} onValueChange={(v) => setPlatform(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40" data-testid="select-platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          {selectedForCompare.length > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              Pick {2 - selectedForCompare.length} more post to compare
            </span>
          )}
        </div>

        {!activeBrandId ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Create a brand and connect a social account to start collecting analytics.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="kpi-cards">
              <StatCard label="Reach" value={summary.data?.reach ?? 0} prev={summary.data?.prev.reach} />
              <StatCard label="Impressions" value={summary.data?.impressions ?? 0} prev={summary.data?.prev.impressions} />
              <StatCard
                label="Engagement"
                value={(summary.data?.likes ?? 0) + (summary.data?.comments ?? 0) + (summary.data?.shares ?? 0)}
              />
              <StatCard
                label="Engagement rate"
                value={(summary.data?.engagementRate ?? 0) * 100}
                prev={(summary.data?.prev.engagementRate ?? 0) * 100}
                format={(v) => `${v.toFixed(2)}%`}
              />
              <StatCard
                label="CTR"
                value={(summary.data?.ctr ?? 0) * 100}
                prev={(summary.data?.prev.ctr ?? 0) * 100}
                format={(v) => `${v.toFixed(2)}%`}
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
                <h2 className="font-semibold text-sm mb-3">Engagement over time</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.data?.points ?? []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="reach" stroke="#3b82f6" name="Reach" />
                      <Line type="monotone" dataKey="likes" stroke="#ec4899" name="Likes" />
                      <Line type="monotone" dataKey="comments" stroke="#10b981" name="Comments" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="font-semibold text-sm mb-3">Followers</h2>
                <p className="text-3xl font-bold">
                  {summary.data?.followers.latest.toLocaleString() ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(summary.data?.followers.delta ?? 0) > 0 ? "+" : ""}
                  {summary.data?.followers.delta ?? 0} in {range}
                </p>
                <div className="h-32 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.data?.followers ?? []}>
                      <Line type="monotone" dataKey="followers" stroke="#8b5cf6" dot={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" /> Top posts
                </h2>
                {(top.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No data yet — publish some posts and analytics will appear once your social platforms return insights.
                  </p>
                ) : (
                  <ul className="divide-y divide-border" data-testid="top-posts">
                    {top.data?.map((p) => {
                      const checked = selectedForCompare.includes(p.postId);
                      return (
                        <li
                          key={p.postId}
                          className="py-2 flex gap-2 text-sm items-center"
                          data-testid={`top-post-${p.postId}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePostForCompare(p.postId)}
                            className="cursor-pointer"
                            data-testid={`compare-check-${p.postId}`}
                            aria-label="Select for comparison"
                          />
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              loading="lazy"
                              className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border"
                              data-testid={`top-post-thumb-${p.postId}`}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex-shrink-0" />
                          )}
                          <span className="text-xs text-muted-foreground w-12 flex-shrink-0 capitalize">
                            {p.platform}
                          </span>
                          <span className="flex-1 truncate">{p.content.slice(0, 80)}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.likes}♥ · {p.comments}💬
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="font-semibold text-sm mb-3">Best posting times (UTC)</h2>
                {!heatmap || heatmap.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Not enough data yet.</p>
                ) : (
                  <div className="space-y-3" data-testid="best-times">
                    {heatmap.map(({ platform: p, hours }) => (
                      <div key={p}>
                        <p className="text-xs font-medium text-muted-foreground mb-1 capitalize">{p}</p>
                        <div
                          className="grid gap-px"
                          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                        >
                          {Array.from({ length: 24 }).map((_, h) => (
                            <div
                              key={h}
                              className={`h-5 rounded-sm ${
                                hours.includes(h) ? "bg-primary" : "bg-secondary"
                              }`}
                              title={`${h}:00`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-sm mb-3">Content type performance</h2>
              <ContentTypeBreakdown byPlatform={(memory.data?.bestContentTypesByPlatform ?? {}) as Record<string, string[]>} />
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" /> AI Recommendations
              </h2>
              {(insights.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active recommendations. Click "Refresh insights" to generate suggestions from your latest performance data.
                </p>
              ) : (
                <ul className="space-y-2" data-testid="insights-list">
                  {insights.data?.map((i) => (
                    <li
                      key={i.id}
                      className="border border-border rounded-lg p-3"
                      data-testid={`insight-${i.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{i.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{i.body}</p>
                          {(() => {
                            const payload =
                              i.payload && typeof i.payload === "object"
                                ? (i.payload as Record<string, unknown>)
                                : null;
                            const suggested =
                              payload && typeof payload.suggestedContent === "string"
                                ? payload.suggestedContent
                                : null;
                            return suggested ? (
                              <p className="text-xs mt-2 p-2 bg-secondary rounded whitespace-pre-wrap">
                                {suggested.slice(0, 400)}
                              </p>
                            ) : null;
                          })()}
                          {i.appliedAt && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Applied
                            </p>
                          )}
                        </div>
                        {(() => {
                          const appliedAtMs = i.appliedAt
                            ? new Date(i.appliedAt).getTime()
                            : recentlyApplied[i.id] ?? null;
                          const withinUndoWindow =
                            appliedAtMs !== null && Date.now() - appliedAtMs < 24 * 60 * 60 * 1000;
                          if (appliedAtMs && withinUndoWindow) {
                            return (
                              <button
                                onClick={() => undo.mutate({ id: i.id })}
                                disabled={undo.isPending}
                                className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary"
                                data-testid={`undo-${i.id}`}
                              >
                                Undo
                              </button>
                            );
                          }
                          if (!appliedAtMs) {
                            return (
                              <button
                                onClick={() => apply.mutate({ id: i.id })}
                                disabled={apply.isPending}
                                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
                                data-testid={`apply-${i.id}`}
                              >
                                Apply
                              </button>
                            );
                          }
                          return null;
                        })()}
                        <button
                          onClick={() => dismiss.mutate({ id: i.id })}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Dismiss"
                          data-testid={`dismiss-${i.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-purple-500" /> Performance Memory
              </h2>
              {memory.data?.distilledStrategy ? (
                <pre
                  className="text-xs whitespace-pre-wrap bg-secondary p-3 rounded"
                  data-testid="performance-memory"
                >
                  {memory.data.distilledStrategy}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Performance Memory builds up automatically as your posts gather engagement. The generator will use these patterns to write better content over time.
                </p>
              )}
              {memory.data?.winningHashtags && memory.data.winningHashtags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Winning hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {memory.data.winningHashtags.map((h) => (
                      <span key={h} className="text-xs bg-secondary px-2 py-0.5 rounded">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <CompareDrawer ids={compareIds} onClose={() => setCompareIds(null)} />
      </div>
    </Layout>
  );
}
