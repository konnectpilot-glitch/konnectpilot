import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { Loader2, Send, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useWorkspace, hasRoleAtLeast } from "@/lib/workspaceContext";

interface Comment {
  id: number;
  postId: number;
  userId: string;
  parentId: number | null;
  content: string;
  createdAt: string;
  authorName?: string | null;
  authorEmail?: string | null;
}

interface Props {
  postId: number;
  onClose: () => void;
  onAfterAction?: () => void;
}

export default function PostCommentsPanel({ postId, onClose, onAfterAction }: Props) {
  const { getToken, userId } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const auth = useCallback(
    async (init?: RequestInit) => {
      const token = await getToken().catch(() => null);
      return {
        ...init,
        headers: {
          ...(init?.headers || {}),
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
        },
      };
    },
    [getToken, activeWorkspace],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const init = await auth();
      const res = await fetch(`/api/posts/${postId}/comments`, init);
      if (!res.ok) throw new Error("Failed to load comments");
      const data = await res.json();
      const list: Comment[] = Array.isArray(data) ? data : data.comments ?? [];
      setComments(list);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [auth, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const content = input.trim();
    if (!content) return;
    setBusy(true);
    try {
      const init = await auth({
        method: "POST",
        body: JSON.stringify({ content, parentId: replyTo }),
      });
      const res = await fetch(`/api/posts/${postId}/comments`, init);
      if (!res.ok) throw new Error("Failed to comment");
      setInput("");
      setReplyTo(null);
      await load();
      onAfterAction?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to comment");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this comment?")) return;
    try {
      const init = await auth({ method: "DELETE" });
      const res = await fetch(`/api/posts/${postId}/comments/${id}`, init);
      if (!res.ok) throw new Error("Failed to delete");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  const role = activeWorkspace?.role;
  const canDelete = (c: Comment) => c.userId === userId || hasRoleAtLeast(role, "admin");

  // Group threaded
  const top = comments.filter((c) => c.parentId == null);
  const repliesOf = (id: number) => comments.filter((c) => c.parentId === id);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Comments</h3>
            <span className="text-xs text-muted-foreground">({comments.length})</span>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : top.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No comments yet.</div>
          ) : (
            top.map((c) => (
              <div key={c.id} className="space-y-2">
                <CommentItem c={c} canDelete={canDelete(c)} onReply={() => setReplyTo(c.id)} onDelete={() => remove(c.id)} />
                {repliesOf(c.id).length > 0 && (
                  <div className="ml-6 pl-3 border-l border-border space-y-2">
                    {repliesOf(c.id).map((r) => (
                      <CommentItem key={r.id} c={r} canDelete={canDelete(r)} onDelete={() => remove(r.id)} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-3 space-y-2">
          {replyTo != null && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Replying to comment #{replyTo}</span>
              <button onClick={() => setReplyTo(null)} className="text-primary hover:underline">
                cancel
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasRoleAtLeast(role, "viewer") ? "Add a comment..." : "Sign in to comment"}
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <button
              onClick={submit}
              disabled={busy || !input.trim()}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  c,
  canDelete,
  onReply,
  onDelete,
}: {
  c: Comment;
  canDelete: boolean;
  onReply?: () => void;
  onDelete: () => void;
}) {
  const author = c.authorName || c.authorEmail || "User";
  return (
    <div className="bg-secondary/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{author}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
          </span>
        </div>
        {canDelete && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.content}</p>
      {onReply && (
        <button onClick={onReply} className="mt-1 text-xs text-primary hover:underline">
          Reply
        </button>
      )}
    </div>
  );
}
