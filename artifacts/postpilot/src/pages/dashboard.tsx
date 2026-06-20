import Layout from "@/components/layout";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import {
  useGetDashboardStats,
  useGetRecentPosts,
  useGetPlatformBreakdown,
  useListBrands,
} from "@workspace/api-client-react";
import { Building2, FileText, Sparkles, TrendingUp, Plus, ArrowRight, Wand2 } from "lucide-react";
import UsageWidget from "@/components/usage-widget";
import AISharpnessMeter from "@/components/ai-sharpness-meter";
import TopicSuggesterWidget from "@/components/topic-suggester";
import TopPerformersWidget from "@/components/top-performers";
import InsightsInbox from "@/components/insights-inbox";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "w-4 h-4";
  if (platform === "facebook") return <Facebook className={`${cls} text-blue-600`} />;
  if (platform === "instagram") return <Instagram className={`${cls} text-pink-600`} />;
  if (platform === "linkedin") return <Linkedin className={`${cls} text-blue-700`} />;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generated: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300",
    published: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300",
    failed: "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300",
    scheduled: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

import OnboardingWizard, { shouldShowOnboarding } from "@/components/onboarding-wizard";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentPosts, isLoading: postsLoading } = useGetRecentPosts();
  const { data: platformBreakdown } = useGetPlatformBreakdown();
  const { data: brands } = useListBrands();

  // First-time-user onboarding wizard. Shows when the workspace has zero
  // brands AND the user hasn't explicitly dismissed it before (persisted
  // in localStorage). Audit Problem #2: first-time flow is broken — this
  // collapses the 14-click activation path to a 3-step modal.
  const [showWizard, setShowWizard] = useState(false);
  useEffect(() => {
    if (brands === undefined) return; // wait until query resolves
    if (shouldShowOnboarding(brands.length)) setShowWizard(true);
  }, [brands]);

  const statCards = [
    { label: "Total Brands", value: stats?.totalBrands ?? 0, icon: Building2, color: "text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15" },
    { label: "Posts Generated", value: stats?.totalPosts ?? 0, icon: FileText, color: "text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/15" },
    { label: "Posts This Month", value: stats?.postsThisMonth ?? 0, icon: TrendingUp, color: "text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-500/15" },
    { label: "Posts This Week", value: stats?.postsThisWeek ?? 0, icon: Sparkles, color: "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15" },
  ];

  return (
    <Layout>
      {showWizard && <OnboardingWizard onClose={() => setShowWizard(false)} />}
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header — stacks vertically on mobile so the 3 CTAs don't overflow. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Overview of your KonnectPilot activity</p>
          </div>
          {/* Button row scrolls horizontally on the narrowest screens if needed,
              but `flex-wrap` keeps them on multiple lines first. */}
          <div className="flex gap-2 flex-wrap">
            <Link href="/approval?batch=1" className="flex items-center gap-1.5 text-sm font-medium border border-primary/30 text-primary px-3 py-2 rounded-lg hover:bg-primary/5 transition-colors">
              <Wand2 className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">Generate a month</span>
              <span className="xs:hidden sm:hidden">Month</span>
            </Link>
            <Link href="/brands/new" className="flex items-center gap-1.5 text-sm font-medium border border-border px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
              <Plus className="w-4 h-4" />
              New Brand
            </Link>
            <Link href="/generate" className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              <Sparkles className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">Generate Post</span>
              <span className="xs:hidden sm:hidden">Generate</span>
            </Link>
          </div>
        </div>

        {/* Zero-state focus: brand-new accounts (no brands yet) see a single
            big "Set up your first brand" card instead of a wall of empty
            widgets. The audit called out widget-overload on first paint —
            this collapses 11 things into one obvious next step. */}
        {(brands?.length ?? 0) === 0 ? (
          <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-background border border-primary/30 rounded-2xl p-8 text-center">
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold text-foreground mb-2">Get your first post live in 90 seconds</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              Paste your store URL and KonnectPilot fills in your brand voice, audience, and keywords automatically. Then it's one click to a publishable draft.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/brands/new" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-colors text-sm shadow-md">
                <Plus className="w-4 h-4" />
                Set up your first brand
              </Link>
              <Link href="/features" className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm">
                See how it works
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Your AI Sharpness meter, top performers, and AI Insights will start filling in as soon as you create a brand and approve a few posts.
            </p>
          </div>
        ) : (
          <>
            {/* AI insights — data-derived, actionable recommendations. Lazy
                generated server-side. Only shown when there's at least 1 brand. */}
            <InsightsInbox />

            {/* What's working — top posts by engagement, makes the performance
                memory loop visible. */}
            <TopPerformersWidget />
          </>
        )}

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
            <TopicSuggesterWidget />
            <AISharpnessMeter />
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
                <Link href="/approval?batch=1" className="flex items-center gap-2 w-full text-sm font-medium text-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary">
                  <Wand2 className="w-4 h-4 text-primary" />
                  Generate a month of posts
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
