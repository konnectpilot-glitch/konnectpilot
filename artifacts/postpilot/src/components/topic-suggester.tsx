import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useListBrands } from "@workspace/api-client-react";
import { Sparkles, ArrowRight, RefreshCw, Loader2, GraduationCap, ShoppingBag, MessageCircle, Camera, Tag, type LucideIcon } from "lucide-react";
import { useWorkspace } from "@/lib/workspaceContext";

// Daily topic suggester — Dashboard side-panel widget that pulls 5 timely,
// brand-specific topics from /api/topic-suggester/:brandId. Click a topic
// to jump straight to Generate with it pre-filled. Pillar-tagged so the
// user sees variety (educate vs spotlight vs bts, etc).
//
// Auto-picks the user's first brand. The brand picker is a small selector
// at the top of the widget so multi-brand users can rotate.

interface Suggestion {
  topic: string;
  pillar: string;
  reason: string;
}

// Pillar tints — dark-mode-aware (translucent fill + brighter text).
const PILLAR_META: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
  educate: { label: "Educate", icon: GraduationCap, tint: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  spotlight: { label: "Spotlight", icon: ShoppingBag, tint: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  reviews: { label: "Reviews", icon: MessageCircle, tint: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  bts: { label: "BTS", icon: Camera, tint: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  promo: { label: "Promo", icon: Tag, tint: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

export default function TopicSuggesterWidget() {
  const { data: brands } = useListBrands();
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [brandId, setBrandId] = useState<number | null>(null);
  const [topics, setTopics] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  // Default the picker to the first brand once they load.
  useEffect(() => {
    if (brandId === null && brands && brands.length > 0) {
      setBrandId(brands[0].id);
    }
  }, [brands, brandId]);

  async function load(force = false) {
    if (!brandId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const url = `/api/topic-suggester/${brandId}${force ? `?t=${Date.now()}` : ""}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
        },
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setTopics(json.topics ?? []);
      setDay(json.day ?? null);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on first brand or brand switch.
  useEffect(() => {
    if (brandId) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  if (!brands || brands.length === 0) {
    return null; // brand-less workspaces don't need this widget
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">What to post today</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">AI</span>
      </div>
      {brands.length > 1 && (
        <select
          value={brandId ?? ""}
          onChange={(e) => setBrandId(Number(e.target.value))}
          className="w-full text-xs border border-border rounded-md px-2 py-1 mb-3 bg-background"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
      {loading && topics.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted/60 rounded animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">
          Couldn't generate ideas right now.
          <button onClick={() => load(true)} className="block mx-auto mt-2 text-primary hover:underline">Try again</button>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {topics.map((t, i) => {
              const meta = PILLAR_META[t.pillar] ?? PILLAR_META.spotlight;
              const Icon = meta.icon;
              const href = `/generate?brandId=${brandId}&topic=${encodeURIComponent(t.topic)}`;
              return (
                <Link
                  key={i}
                  href={href}
                  className="group flex items-start gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors"
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${meta.tint}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{t.topic}</p>
                    {t.reason && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.reason}</p>
                    )}
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                </Link>
              );
            })}
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="w-full mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-secondary/40 transition-colors"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? "Generating…" : "Get fresh ideas"}
          </button>
        </>
      )}
    </div>
  );
}
