import Layout from "@/components/layout";
import { useState } from "react";
import { useListBrands, useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useWorkspace } from "@/lib/workspaceContext";
import {
  MessageSquare,
  Wand2,
  Loader2,
  Copy,
  Check,
  Heart,
  ShoppingBag,
  Smile,
  Sparkles,
  Facebook,
  Instagram,
  Linkedin,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";

// AI Reply Drafter — paste a comment + the post it's on, get 3 brand-voice
// reply drafts back. Each in a distinct tone (supportive, sales-leaning,
// playful) so the user picks the one that fits the moment.
//
// We pass `brandId` so the backend can pull voice + brand memory + few-shot
// example posts into the prompt. Without that signal we'd get the same
// generic GPT reply every other tool produces.

interface Draft {
  tone: string;
  reply: string;
}

// Dark-mode-aware reply tone tints.
const TONE_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  supportive: { icon: Heart, color: "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15", label: "Supportive" },
  sales: { icon: ShoppingBag, color: "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15", label: "Sales-leaning" },
  playful: { icon: Smile, color: "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15", label: "Playful" },
  neutral: { icon: MessageSquare, color: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-500/15", label: "Neutral" },
};

const PLATFORMS = ["facebook", "instagram", "linkedin"] as const;
type Platform = (typeof PLATFORMS)[number];

export default function ReplyDrafterPage() {
  const { data: brands } = useListBrands();
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [brandId, setBrandId] = useState<number | "">("");
  const [postContent, setPostContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commenterName, setCommenterName] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Recently-published posts for the picked brand. Server-filtered (brandId
  // + status=published + limit=5) so we never pull every post for the
  // workspace just to show 5 thumbnails. The hook re-fetches on brand
  // switch — `enabled` gates against running before a brand is picked.
  const recentPostsParams = {
    brandId: brandId === "" ? undefined : (brandId as number),
    status: "published",
    limit: 5,
  } as any;
  const { data: recentPosts = [] } = useListPosts(
    recentPostsParams,
    { query: { enabled: !!brandId, queryKey: getListPostsQueryKey(recentPostsParams) } },
  );

  function platformIcon(p: string) {
    if (p === "facebook") return <Facebook className="w-3.5 h-3.5 text-blue-600" />;
    if (p === "instagram") return <Instagram className="w-3.5 h-3.5 text-pink-600" />;
    if (p === "linkedin") return <Linkedin className="w-3.5 h-3.5 text-blue-700" />;
    return null;
  }

  function preFillFromPost(post: any) {
    setPostContent(post.content ?? "");
    if (post.platform === "facebook" || post.platform === "instagram" || post.platform === "linkedin") {
      setPlatform(post.platform);
    }
    // Scroll to the comment box for a smooth flow.
    setTimeout(() => {
      const el = document.getElementById("comment-textarea");
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  async function handleDraft() {
    if (!brandId) {
      toast.error("Pick a brand first");
      return;
    }
    if (!postContent.trim()) {
      toast.error("Paste the original post");
      return;
    }
    if (!commentText.trim()) {
      toast.error("Paste the comment to reply to");
      return;
    }
    setLoading(true);
    setDrafts([]);
    try {
      // Fresh Clerk token on each call so we never send a stale one. Same
      // pattern as every other auth'd fetch in the app — cookie alone won't
      // work in production behind the Clerk bearer-token middleware.
      const token = await getToken();
      const res = await fetch("/api/reply-drafter/draft", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
        },
        body: JSON.stringify({
          brandId: Number(brandId),
          postContent: postContent.trim(),
          commentText: commentText.trim(),
          commenterName: commenterName.trim() || null,
          platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Drafting failed (${res.status})`);
      }
      setDrafts(data.drafts ?? []);
      toast.success(`${data.drafts?.length ?? 0} drafts ready`);
    } catch (err: any) {
      toast.error(friendlyError(err, "Couldn't draft replies. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(idx: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Reply Drafter</h1>
            <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick one of your recent posts (or paste any caption) — AI drafts three on-brand replies in different tones.
          </p>
        </div>

        {/* Recent-posts inbox — populated when a brand is selected. */}
        {brandId && recentPosts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Recent published posts</span>
              <span className="text-xs text-muted-foreground">— tap to draft a reply</span>
            </div>
            <div className="space-y-2">
              {recentPosts.map((post: any) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => preFillFromPost(post)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/40 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {platformIcon(post.platform)}
                    <span className="text-[11px] font-medium text-muted-foreground capitalize">{post.platform}</span>
                    {post.publishedAt && (
                      <span className="text-[11px] text-muted-foreground">· {new Date(post.publishedAt).toLocaleDateString()}</span>
                    )}
                    <ArrowDown className="w-3 h-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 leading-snug">{post.content}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Brand *</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select a brand</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Platform <span className="text-muted-foreground font-normal">(tunes tone slightly)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`text-sm font-medium border rounded-lg px-3 py-2 capitalize transition-colors ${
                    platform === p
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Original post *</label>
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              rows={4}
              placeholder="Paste the caption / post your audience is commenting on…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">The comment *</label>
              <textarea
                id="comment-textarea"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder="Paste the audience comment…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Commenter's name <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <button
            onClick={handleDraft}
            disabled={loading || !brandId || !postContent.trim() || !commentText.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Drafting replies…" : "Draft 3 replies"}
          </button>
        </div>

        {/* Drafts */}
        {drafts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Pick a draft to copy</h2>
            </div>
            {drafts.map((d, i) => {
              const meta = TONE_META[d.tone?.toLowerCase()] ?? TONE_META.neutral;
              const Icon = meta.icon;
              return (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </div>
                    <button
                      onClick={() => handleCopy(i, d.reply)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {copiedIdx === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === i ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{d.reply}</p>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              The more posts you approve, the better these drafts get — every approval feeds your brand memory.
            </p>
          </div>
        )}

        {/* Empty hint */}
        {drafts.length === 0 && !loading && (
          <div className="bg-secondary/30 border border-dashed border-border rounded-xl p-6 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Fill in the form above and hit <strong>Draft 3 replies</strong>. The AI uses your brand voice + everything it's learned to write three on-brand options.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
