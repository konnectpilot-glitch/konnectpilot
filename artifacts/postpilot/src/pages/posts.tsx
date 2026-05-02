import Layout from "@/components/layout";
import { useState } from "react";
import {
  useListPosts,
  useDeletePost,
  getListPostsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  FileText, Trash2, Copy, Check, Facebook, Instagram, Linkedin, Search, RotateCcw,
  Loader2, MessageSquare, Send, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import PostCommentsPanel from "@/components/post-comments-panel";
import { useWorkspace, hasRoleAtLeast } from "@/lib/workspaceContext";

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "facebook") return <Facebook className="w-4 h-4 text-blue-600" />;
  if (platform === "instagram") return <Instagram className="w-4 h-4 text-pink-600" />;
  if (platform === "linkedin") return <Linkedin className="w-4 h-4 text-blue-700" />;
  if (platform === "tiktok") return <FaTiktok className="w-3.5 h-3.5 text-foreground" />;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generated: "bg-blue-50 text-blue-700",
    published: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    scheduled: "bg-amber-50 text-amber-700",
    pending_approval: "bg-purple-50 text-purple-700",
    rejected: "bg-rose-50 text-rose-700",
    pending: "bg-gray-100 text-gray-600",
  };
  const label = status === "pending_approval" ? "Pending approval" : status;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

export default function PostsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const role = activeWorkspace?.role;
  const canEdit = hasRoleAtLeast(role, "editor");
  const canApprove = hasRoleAtLeast(role, "admin");

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [commentsForPost, setCommentsForPost] = useState<number | null>(null);

  const { data: posts, isLoading } = useListPosts({
    platform: platformFilter !== "all" ? platformFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const deletePost = useDeletePost();
  const queryClient = useQueryClient();

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

  const retryPost = useMutation({
    mutationFn: async (id: number) => {
      const res = await authedFetch(`/api/posts/${id}/retry`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Retry failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      toast.success("Post published");
    },
    onError: (e: any) => toast.error(e?.message ?? "Retry failed"),
  });

  const submitPost = useMutation({
    mutationFn: async (id: number) => {
      const res = await authedFetch(`/api/posts/${id}/submit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Submit failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      toast.success("Submitted for approval");
    },
    onError: (e: any) => toast.error(e?.message ?? "Submit failed"),
  });

  const approvePost = useMutation({
    mutationFn: async ({ id, publish }: { id: number; publish?: boolean }) => {
      const res = await authedFetch(`/api/posts/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ publish: !!publish }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Approve failed");
      return body;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      toast.success(vars.publish ? "Approved & published" : "Approved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Approve failed"),
  });

  const rejectPost = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const res = await authedFetch(`/api/posts/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Reject failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      toast.success("Post rejected");
    },
    onError: (e: any) => toast.error(e?.message ?? "Reject failed"),
  });

  const filtered = posts?.filter(p =>
    !search || p.content.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCopy(id: number, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard");
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this post?")) return;
    deletePost.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast.success("Post deleted");
      },
      onError: () => toast.error("Failed to delete post"),
    });
  }

  function handleReject(id: number) {
    const reason = prompt("Reason for rejection (optional):") ?? undefined;
    if (reason === null) return;
    rejectPost.mutate({ id, reason });
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Post History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All your generated and published posts
            {activeWorkspace?.requireApproval && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                Approval required
              </span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Search posts..."
            />
          </div>
          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Platforms</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Status</option>
            <option value="generated">Generated</option>
            <option value="pending_approval">Pending approval</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (filtered?.length ?? 0) === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No posts found</h2>
            <p className="text-sm text-muted-foreground">
              {search || platformFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Generate your first post to see it here"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered?.map((post) => {
              const isPending = post.status === "pending_approval";
              const canSubmit = canEdit && (post.status === "generated" || post.status === "rejected");
              return (
                <div key={post.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlatformIcon platform={post.platform} />
                      <span className="text-sm font-medium text-foreground capitalize">{post.platform}</span>
                      {post.brandName && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-sm text-muted-foreground">{post.brandName}</span>
                        </>
                      )}
                      <StatusBadge status={post.status} />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canSubmit && activeWorkspace?.requireApproval && (
                        <button
                          onClick={() => submitPost.mutate(post.id)}
                          disabled={submitPost.isPending && submitPost.variables === post.id}
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                          title="Submit for approval"
                        >
                          <Send className="w-3 h-3" />
                          Submit
                        </button>
                      )}
                      {isPending && canApprove && (
                        <>
                          <button
                            onClick={() => approvePost.mutate({ id: post.id, publish: true })}
                            disabled={approvePost.isPending && approvePost.variables?.id === post.id}
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                            title={post.scheduledFor ? "Approve" : "Approve & publish"}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(post.id)}
                            disabled={rejectPost.isPending && rejectPost.variables?.id === post.id}
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                            title="Reject"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setCommentsForPost(post.id)}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                        title="Comments"
                      >
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {post.status === "failed" && canEdit && (
                        <button
                          onClick={() => retryPost.mutate(post.id)}
                          disabled={retryPost.isPending && retryPost.variables === post.id}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                          title="Retry publishing"
                        >
                          {retryPost.isPending && retryPost.variables === post.id
                            ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                            : <RotateCcw className="w-4 h-4 text-muted-foreground" />
                          }
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(post.id, post.content)}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                        title="Copy"
                      >
                        {copiedId === post.id
                          ? <Check className="w-4 h-4 text-green-600" />
                          : <Copy className="w-4 h-4 text-muted-foreground" />
                        }
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-3 line-clamp-4">
                    {post.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    {post.publishedAt && ` · Published ${format(new Date(post.publishedAt), "MMM d, yyyy")}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {commentsForPost != null && (
        <PostCommentsPanel
          postId={commentsForPost}
          onClose={() => setCommentsForPost(null)}
        />
      )}
    </Layout>
  );
}
