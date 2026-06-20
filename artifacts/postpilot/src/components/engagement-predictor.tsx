import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Sparkles, TrendingUp, Activity, AlertCircle, Flame, type LucideIcon } from "lucide-react";
import { useWorkspace } from "@/lib/workspaceContext";

// Engagement Predictor badge — small inline component that fetches a
// quality score for a draft caption against the brand's performance memory.
// Renders nothing while loading (lazy mount); shows a tinted badge once the
// score lands. Cached server-side per content+brand, so re-mounting (e.g.
// when the user picks a different variant) doesn't re-charge Claude.

interface Prediction {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
  reasoning: string;
  hasMemory: boolean;
}

// Dark-mode-aware tints — light pastel in light mode, translucent 15% fill
// + light text in dark mode. Same hue family in both so the score color
// still reads consistently.
const SCORE_META: Record<number, { icon: LucideIcon; tint: string; ring: string }> = {
  5: { icon: Flame, tint: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15", ring: "ring-emerald-200 dark:ring-emerald-500/30" },
  4: { icon: TrendingUp, tint: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15", ring: "ring-emerald-200 dark:ring-emerald-500/30" },
  3: { icon: Activity, tint: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-500/15", ring: "ring-slate-200 dark:ring-slate-500/30" },
  2: { icon: AlertCircle, tint: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15", ring: "ring-amber-200 dark:ring-amber-500/30" },
  1: { icon: AlertCircle, tint: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15", ring: "ring-rose-200 dark:ring-rose-500/30" },
};

interface Props {
  brandId: number;
  content: string;
  platform?: string;
}

export default function EngagementPredictor({ brandId, content, platform }: Props) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [pred, setPred] = useState<Prediction | null>(null);
  const [failed, setFailed] = useState(false);

  // Re-fetch when the content meaningfully changes. Slice the content to
  // build a stable key so trivial whitespace edits don't trigger re-runs.
  const contentKey = content.slice(0, 200);

  useEffect(() => {
    if (!brandId || !content || content.length < 10) return;
    // AbortController cancels in-flight fetches when the effect re-runs
    // (e.g. user rapidly clicks variant tabs). Without this, a slower
    // earlier request can resolve after a later one and paint a stale
    // score on the wrong content.
    const ctl = new AbortController();
    setPred(null);
    setFailed(false);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/predict/engagement", {
          method: "POST",
          credentials: "include",
          signal: ctl.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
          },
          body: JSON.stringify({ brandId, content, platform }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!ctl.signal.aborted) setPred(json);
      } catch (err: any) {
        // AbortError is expected (effect re-fired) — never paint failure for it.
        if (!ctl.signal.aborted && err?.name !== "AbortError") setFailed(true);
      }
    })();
    return () => { ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, contentKey, platform]);

  if (failed) return null;
  if (!pred) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Sparkles className="w-3 h-3 animate-pulse" />
        Scoring…
      </div>
    );
  }

  const meta = SCORE_META[pred.score];
  const Icon = meta.icon;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${meta.tint} ${meta.ring}`}
      title={pred.reasoning + (pred.hasMemory ? "" : " (scored vs industry — no brand performance data yet)")}
    >
      <Icon className="w-3 h-3" />
      <span>{pred.label}</span>
      <span className="font-bold ml-0.5">{pred.score}/5</span>
    </div>
  );
}
