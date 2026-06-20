import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  Lightbulb,
  X,
  Clock,
  Hash,
  Layers,
  Edit3,
  AlertCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspaceContext";

// AI Insights inbox — dashboard card that surfaces data-driven, actionable
// insights generated from the brand's last-30-day analytics. Each row is
// dismissible (soft-delete server-side). Lazy-generated on first read per
// workspace per day, so empty / new accounts don't see noise.

interface Insight {
  id: number;
  brandId: number;
  brandName?: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  createdAt: string;
}

// Dark-mode-aware kind tints — translucent fill + brighter text in dark.
const KIND_META: Record<string, { icon: LucideIcon; tint: string }> = {
  best_time: { icon: Clock, tint: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15" },
  hashtag_swap: { icon: Hash, tint: "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/15" },
  content_mix: { icon: Layers, tint: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15" },
  caption_rewrite: { icon: Edit3, tint: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15" },
  general: { icon: Lightbulb, tint: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-500/15" },
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-rose-500 dark:border-l-rose-400",
  suggestion: "border-l-primary",
  info: "border-l-slate-300 dark:border-l-slate-600",
};

export default function InsightsInbox() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/insights", {
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
        },
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setInsights(json.insights ?? []);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  async function dismiss(id: number) {
    setDismissing(id);
    // Optimistic — drop from view before the server confirms.
    setInsights((cur) => cur.filter((i) => i.id !== id));
    try {
      const token = await getToken();
      await fetch(`/api/insights/${id}/dismiss`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
        },
      });
    } catch {
      // ignore — the local optimistic state is correct enough; refresh on
      // next page load.
    } finally {
      setDismissing(null);
    }
  }

  if (loading && insights.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Lightbulb className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI insights</h2>
        </div>
        <div className="p-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Looking at your data…
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Lightbulb className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI insights</h2>
          <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Auto-generated</span>
        </div>
        <div className="p-5 text-xs text-muted-foreground leading-relaxed">
          Publish a few more posts and we'll surface specific, actionable insights here — like best posting hours, hashtags that are landing, and content mix tweaks. Insights refresh once per day.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI insights</h2>
          <span className="text-[10px] text-muted-foreground">· {insights.length} active</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">From your data</span>
      </div>
      <div className="divide-y divide-border">
        {insights.slice(0, 4).map((insight) => {
          const meta = KIND_META[insight.kind] ?? KIND_META.general;
          const Icon = meta.icon;
          return (
            <div
              key={insight.id}
              className={`relative pl-4 pr-3 py-3 border-l-4 ${SEVERITY_BORDER[insight.severity] ?? SEVERITY_BORDER.info}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${meta.tint}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground leading-tight">{insight.title}</p>
                    {insight.brandName && (
                      <span className="text-[10px] text-muted-foreground truncate">· {insight.brandName}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                </div>
                <button
                  onClick={() => dismiss(insight.id)}
                  disabled={dismissing === insight.id}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  aria-label="Dismiss insight"
                >
                  {dismissing === insight.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
