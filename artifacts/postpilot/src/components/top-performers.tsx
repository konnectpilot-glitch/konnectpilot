import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import {
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  Facebook,
  Instagram,
  Linkedin,
  Eye,
  Brain,
  ArrowRight,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspaceContext";

// "What's working" widget — surfaces the top 3 posts by engagement in the
// last 30 days across all workspace brands. Visible proof that the
// performance-memory loop is doing something: the user can SEE which posts
// are landing and the AI is already feeding those insights back into new
// generations via brand_performance_memory.

interface TopPost {
  postId: number;
  brandId: number;
  brandName: string;
  platform: string;
  content: string;
  imageUrl: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  engagementRate: number;
  publishedAt: string | null;
}

interface Resp {
  posts: TopPost[];
  totalEngagement: number;
  sampleSize: number;
}

function PlatformIcon({ p }: { p: string }) {
  if (p === "facebook") return <Facebook className="w-3 h-3 text-blue-600" />;
  if (p === "instagram") return <Instagram className="w-3 h-3 text-pink-600" />;
  if (p === "linkedin") return <Linkedin className="w-3 h-3 text-blue-700" />;
  return null;
}

function fmtNumber(n: number): string {
  // Drop the decimal at 10k+ where it adds no useful precision (e.g.
  // 12.3k → 12k). Keep one decimal in the 1-10k range where it does.
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function TopPerformersWidget() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/dashboard/top-performers", {
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
    return () => { cancelled = true; };
  }, [getToken, activeWorkspace?.id]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-5 bg-muted/60 rounded w-40 animate-pulse" />
        </div>
        <div className="p-5 grid sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // No data yet — explain the loop instead of hiding the widget. Makes the
  // value prop visible even pre-data: "we'll show you what's working".
  if (!data || data.posts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            What's working
          </h2>
          <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">AI loop</span>
        </div>
        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-foreground font-medium mb-1">Your top posts will land here</p>
            <p className="text-xs text-muted-foreground">
              Once posts publish and accumulate engagement, KonnectPilot ranks them and feeds the winners back into your brand's AI memory. Your next drafts get sharper automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            What's working
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Top {data.posts.length} posts by engagement · last 30 days · feeding the AI
          </p>
        </div>
        <Link href="/analytics" className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0">
          Analytics <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-5 grid sm:grid-cols-3 gap-3">
        {data.posts.map((p, i) => (
          <Link
            key={p.postId}
            href={`/brands/${p.brandId}?tab=posts`}
            className="border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all group bg-background"
          >
            {p.imageUrl ? (
              <div className="aspect-video bg-muted overflow-hidden">
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
            ) : (
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary/40">#{i + 1}</span>
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
                <PlatformIcon p={p.platform} />
                <span className="capitalize">{p.platform}</span>
                <span>·</span>
                <span className="truncate">{p.brandName}</span>
              </div>
              <p className="text-xs text-foreground leading-snug line-clamp-2 mb-2">{p.content}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5"><Heart className="w-3 h-3" />{fmtNumber(p.likes)}</span>
                <span className="inline-flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{fmtNumber(p.comments)}</span>
                <span className="inline-flex items-center gap-0.5"><Share2 className="w-3 h-3" />{fmtNumber(p.shares)}</span>
                {p.impressions > 0 && (
                  <span className="inline-flex items-center gap-0.5 ml-auto"><Eye className="w-3 h-3" />{fmtNumber(p.impressions)}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
