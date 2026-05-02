import Layout from "@/components/layout";
import { Link } from "wouter";
import {
  useGetDashboardStats,
  useGetRecentPosts,
  useGetPlatformBreakdown,
  useListBrands,
} from "@workspace/api-client-react";
import { Building2, FileText, Sparkles, TrendingUp, Plus, ArrowRight } from "lucide-react";
import UsageWidget from "@/components/usage-widget";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "w-4 h-4";
  if (platform === "facebook") return <Facebook className={`${cls} text-blue-600`} />;
  if (platform === "instagram") return <Instagram className={`${cls} text-pink-600`} />;
  if (platform === "linkedin") return <Linkedin className={`${cls} text-blue-700`} />;
  if (platform === "tiktok") return <FaTiktok className={`${cls} text-foreground`} />;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generated: "bg-blue-50 text-blue-700",
    published: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    scheduled: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentPosts, isLoading: postsLoading } = useGetRecentPosts();
  const { data: platformBreakdown } = useGetPlatformBreakdown();
  const { data: brands } = useListBrands();

  const statCards = [
    { label: "Total Brands", value: stats?.totalBrands ?? 0, icon: Building2, color: "text-blue-600 bg-blue-50" },
    { label: "Posts Generated", value: stats?.totalPosts ?? 0, icon: FileText, color: "text-purple-600 bg-purple-50" },
    { label: "Posts This Month", value: stats?.postsThisMonth ?? 0, icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "Posts This Week", value: stats?.postsThisWeek ?? 0, icon: Sparkles, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Overview of your KonnectPilot activity</p>
          </div>
          <div className="flex gap-2">
            <Link href="/brands/new" className="flex items-center gap-1.5 text-sm font-medium border border-border px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
              <Plus className="w-4 h-4" />
              New Brand
            </Link>
            <Link href="/generate" className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              <Sparkles className="w-4 h-4" />
              Generate Post
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-foreground">{statsLoading ? "—" : value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent posts */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Recent Posts</h2>
              <Link href="/posts" className="text-sm text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {postsLoading ? (
              <div className="p-5 text-sm text-muted-foreground">Loading...</div>
            ) : (recentPosts?.length ?? 0) === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No posts yet. Start generating!</p>
                <Link href="/generate" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                  Generate your first post <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentPosts?.slice(0, 5).map((post) => (
                  <div key={post.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <PlatformIcon platform={post.platform} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{post.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {post.brandName && <span className="font-medium">{post.brandName} · </span>}
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <StatusBadge status={post.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <UsageWidget />
            {/* Platform breakdown */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">By Platform</h2>
              </div>
              {(platformBreakdown?.length ?? 0) === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No data yet</div>
              ) : (
                <div className="p-4 space-y-3">
                  {platformBreakdown?.map(({ platform, count }) => (
                    <div key={platform} className="flex items-center gap-2">
                      <PlatformIcon platform={platform} />
                      <span className="text-sm text-foreground capitalize flex-1">{platform}</span>
                      <span className="text-sm font-medium text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/generate" className="flex items-center gap-2 w-full text-sm font-medium text-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Generate a post
                </Link>
                <Link href="/brands/new" className="flex items-center gap-2 w-full text-sm font-medium text-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary">
                  <Plus className="w-4 h-4 text-primary" />
                  Add a brand
                </Link>
                <Link href="/posts" className="flex items-center gap-2 w-full text-sm font-medium text-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary">
                  <FileText className="w-4 h-4 text-primary" />
                  View post history
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
