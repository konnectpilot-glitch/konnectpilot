import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Brain, TrendingUp, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { useWorkspace } from "@/lib/workspaceContext";

// AI Sharpness — workspace-level meter that visualizes how much the brand
// memory loop has compounded. The pitch ("AI gets sharper every week") goes
// from invisible to a tangible number the user watches climb.
//
// Calls /api/dashboard/ai-sharpness which aggregates approvals + edits +
// rejections + distilled guidelines + saved example posts into a 0-100
// score. We re-fetch when the workspace switches.

interface SharpnessData {
  sharpness: number;
  label: "warming_up" | "learning" | "tuned" | "sharp";
  breakdown: {
    approvals: { count: number; score: number; max: number };
    edits: { count: number; score: number; max: number };
    rejections: { count: number; score: number; max: number };
    guidelinesBrands: { count: number; score: number; max: number };
    examplePosts: { count: number; score: number; max: number };
  };
}

const LABEL_TEXT: Record<SharpnessData["label"], { headline: string; sub: string; tint: string }> = {
  warming_up: {
    headline: "Warming up",
    sub: "Approve a few posts to start training your AI on your voice.",
    tint: "from-slate-500/20 to-slate-400/10",
  },
  learning: {
    headline: "Learning your voice",
    sub: "Every approval, edit, and saved example sharpens the next draft.",
    tint: "from-blue-500/20 to-indigo-500/10",
  },
  tuned: {
    headline: "Tuned to your brand",
    sub: "Your drafts read close to your own voice now. Keep promoting your best posts.",
    tint: "from-emerald-500/20 to-teal-500/10",
  },
  sharp: {
    headline: "Sharp",
    sub: "Your AI is genuinely brand-aware. Most drafts will land first-try.",
    tint: "from-primary/30 to-purple-500/20",
  },
};

export default function AISharpnessMeter() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<SharpnessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/dashboard/ai-sharpness", {
          credentials: "include",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
          },
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, activeWorkspace?.id]);

  if (loading || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI sharpness</h2>
        </div>
        <div className="h-12 bg-muted/60 rounded animate-pulse" />
      </div>
    );
  }

  const meta = LABEL_TEXT[data.label];
  const pct = Math.max(0, Math.min(100, data.sharpness));

  return (
    <div className={`relative bg-card border border-border rounded-xl p-5 overflow-hidden`}>
      <div
        aria-hidden
        className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${meta.tint} blur-2xl opacity-70`}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI sharpness</h2>
          <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            {meta.headline}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-foreground">{pct}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{meta.sub}</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <SignalRow label="Approved posts" count={data.breakdown.approvals.count} icon={Sparkles} />
          <SignalRow label="Edits made" count={data.breakdown.edits.count} icon={TrendingUp} />
          <SignalRow label="Saved examples" count={data.breakdown.examplePosts.count} icon={Brain} />
          <SignalRow label="Distilled brands" count={data.breakdown.guidelinesBrands.count} icon={Zap} />
        </div>
      </div>
    </div>
  );
}

function SignalRow({ label, count, icon: Icon }: { label: string; count: number; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="w-3 h-3 text-primary/70 flex-shrink-0" />
      <span className="truncate">{label}</span>
      <span className="ml-auto font-semibold text-foreground">{count}</span>
    </div>
  );
}
