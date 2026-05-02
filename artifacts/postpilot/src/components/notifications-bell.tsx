import { useState } from "react";
import { Bell, CheckCircle2, AlertCircle, Sparkles, X } from "lucide-react";
import { useListPosts } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  ts: Date;
  iconClass: string;
};

function buildNotifications(posts: Post[] | undefined): Notification[] {
  if (!posts) return [];
  const recent = [...posts]
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime(),
    )
    .slice(0, 8);

  return recent.map((p) => {
    if (p.status === "published") {
      return {
        id: `pub-${p.id}`,
        icon: CheckCircle2,
        title: "Post published",
        body: `${p.platform} · ${p.content.slice(0, 60)}…`,
        ts: new Date(p.publishedAt ?? p.createdAt),
        iconClass: "text-green-600 bg-green-50",
      };
    }
    if (p.status === "failed") {
      return {
        id: `fail-${p.id}`,
        icon: AlertCircle,
        title: "Post failed to publish",
        body: `${p.platform} · ${p.content.slice(0, 60)}…`,
        ts: new Date(p.createdAt),
        iconClass: "text-rose-600 bg-rose-50",
      };
    }
    return {
      id: `gen-${p.id}`,
      icon: Sparkles,
      title: "Post generated",
      body: `${p.platform} · ${p.content.slice(0, 60)}…`,
      ts: new Date(p.createdAt),
      iconClass: "text-blue-600 bg-blue-50",
    };
  });
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data: posts } = useListPosts();
  const notifications = buildNotifications(posts);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-secondary"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All caught up</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/50">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.iconClass}`}>
                        <n.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(n.ts, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
