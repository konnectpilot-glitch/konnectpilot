import { Router, type IRouter } from "express";
import { eq, desc, count, sql, and, gte, inArray } from "drizzle-orm";
import { db, postsTable, brandsTable, brandMemoryProfilesTable, postMetricsSnapshotsTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentPostsResponse,
  GetPlatformBreakdownResponse,
} from "@workspace/api-zod";
import { requireAuth, requireWorkspace } from "./users";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brands = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));

  const totalBrands = brands.length;

  const allPosts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.workspaceId, req.workspaceId));

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  res.json(GetDashboardStatsResponse.parse({
    totalBrands,
    totalPosts: allPosts.length,
    publishedPosts: allPosts.filter((p) => p.status === "published").length,
    generatedPosts: allPosts.filter((p) => p.status === "generated").length,
    failedPosts: allPosts.filter((p) => p.status === "failed").length,
    platformsConnected: 0,
    postsThisWeek: allPosts.filter((p) => p.createdAt >= weekAgo).length,
    postsThisMonth: allPosts.filter((p) => p.createdAt >= monthAgo).length,
  }));
});

router.get("/dashboard/recent-posts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));

  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.workspaceId, req.workspaceId))
    .orderBy(desc(postsTable.createdAt))
    .limit(10);

  res.json(GetRecentPostsResponse.parse(posts.map((p) => ({
    ...p,
    brandName: brandMap.get(p.brandId) ?? null,
    imageUrl: p.imageUrl ?? null,
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }))));
});

router.get("/dashboard/platform-breakdown", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const posts = await db
    .select({ platform: postsTable.platform })
    .from(postsTable)
    .where(eq(postsTable.workspaceId, req.workspaceId));

  const platformCounts: Record<string, number> = {};
  for (const post of posts) {
    platformCounts[post.platform] = (platformCounts[post.platform] ?? 0) + 1;
  }

  const breakdown = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    count,
  }));

  res.json(GetPlatformBreakdownResponse.parse(breakdown));
});

// AI Sharpness — workspace-level score 0-100 derived from brand-memory
// signals. Makes the "AI gets sharper every week" pitch tangible to the
// user. Score goes up with approvals, edits, distilled guidelines, and
// example posts the user has explicitly saved.
//
// The math is deliberately bounded so a power user can hit ~85 without
// gaming — the last 15 points come from time-on-platform + breadth across
// brands, not just volume on one brand.
router.get("/dashboard/ai-sharpness", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  // Pull every brand-memory profile that belongs to a brand in this workspace.
  const profiles = await db
    .select({
      brandId: brandMemoryProfilesTable.brandId,
      approvedCount: brandMemoryProfilesTable.approvedCount,
      rejectedCount: brandMemoryProfilesTable.rejectedCount,
      editedCount: brandMemoryProfilesTable.editedCount,
      distilled: brandMemoryProfilesTable.distilledGuidelines,
      examplePosts: brandsTable.examplePosts,
    })
    .from(brandMemoryProfilesTable)
    .innerJoin(brandsTable, eq(brandsTable.id, brandMemoryProfilesTable.brandId))
    .where(eq(brandsTable.workspaceId, req.workspaceId));

  const totalApproved = profiles.reduce((s, p) => s + (p.approvedCount ?? 0), 0);
  const totalEdited = profiles.reduce((s, p) => s + (p.editedCount ?? 0), 0);
  const totalRejected = profiles.reduce((s, p) => s + (p.rejectedCount ?? 0), 0);
  const profilesWithGuidelines = profiles.filter((p) => !!p.distilled).length;
  const totalExamplePosts = profiles.reduce(
    (s, p) => s + (p.examplePosts ? p.examplePosts.split(/\n---+\n/).filter((x) => x.trim()).length : 0),
    0,
  );

  // Score breakdown (capped contributions so it can't be gamed):
  //   - Approvals      max 35 (1 pt per approval, capped at 35)
  //   - Edits          max 20 (2 pts per edit — edits are higher signal)
  //   - Rejections     max 10 (1 pt per rejection — also useful learning)
  //   - Guidelines     max 15 (5 pts per brand with distilled guidelines)
  //   - Examples saved max 20 (2.5 pts per example post)
  // Floors at 5 the moment ANY signal exists, so brand-new users see 5%
  // instead of a discouraging 0%.
  const approvalsScore = Math.min(35, totalApproved);
  const editsScore = Math.min(20, totalEdited * 2);
  const rejectionsScore = Math.min(10, totalRejected);
  const guidelinesScore = Math.min(15, profilesWithGuidelines * 5);
  const examplesScore = Math.min(20, Math.round(totalExamplePosts * 2.5));
  const anySignal = totalApproved + totalEdited + totalRejected + totalExamplePosts > 0;
  const raw = approvalsScore + editsScore + rejectionsScore + guidelinesScore + examplesScore;
  const sharpness = anySignal ? Math.max(5, raw) : 0;

  // Pick a status label the UI can show without doing the math itself.
  let label: "warming_up" | "learning" | "tuned" | "sharp" = "warming_up";
  if (sharpness >= 70) label = "sharp";
  else if (sharpness >= 40) label = "tuned";
  else if (sharpness >= 15) label = "learning";

  res.json({
    sharpness,
    label,
    breakdown: {
      approvals: { count: totalApproved, score: approvalsScore, max: 35 },
      edits: { count: totalEdited, score: editsScore, max: 20 },
      rejections: { count: totalRejected, score: rejectionsScore, max: 10 },
      guidelinesBrands: { count: profilesWithGuidelines, score: guidelinesScore, max: 15 },
      examplePosts: { count: totalExamplePosts, score: examplesScore, max: 20 },
    },
  });
});

// Top performers — last 30 days across all workspace brands. Pulls the
// LATEST metrics snapshot for each post (one row per post via DISTINCT ON)
// and orders by engagementRate. Surfaces the "AI gets sharper from
// performance memory" loop visibly so users can SEE what works.
router.get("/dashboard/top-performers", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));
  if (brands.length === 0) {
    res.json({ posts: [], totalEngagement: 0 });
    return;
  }
  const brandIds = brands.map((b) => b.id);
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // PG-specific: DISTINCT ON (post_id) ordered by fetched_at DESC gives us
  // the latest snapshot per post in one query. We use Drizzle's typed
  // helpers + sql.identifier where possible — the only raw SQL is the
  // PG-specific DISTINCT ON which has no Drizzle equivalent. Parameterized
  // brand_id list goes through a single bind via the helper.
  const brandIdList = sql.join(brandIds.map((id) => sql`${id}`), sql`, `);
  const rows = await db.execute<{
    post_id: number;
    brand_id: number;
    platform: string;
    content: string;
    image_url: string | null;
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    engagement_rate: number;
    fetched_at: Date;
    published_at: Date | null;
  }>(sql`
    SELECT DISTINCT ON (m.post_id)
      m.post_id, m.brand_id, m.platform,
      p.content, p.image_url, p.published_at,
      m.likes, m.comments, m.shares, m.impressions, m.engagement_rate, m.fetched_at
    FROM post_metrics_snapshots m
    INNER JOIN posts p ON p.id = m.post_id
    WHERE m.brand_id IN (${brandIdList})
      AND m.fetched_at >= ${thirtyDaysAgo}
    ORDER BY m.post_id, m.fetched_at DESC
    LIMIT 200
  `);

  const all = (rows as any).rows ?? rows;
  const sorted = (Array.isArray(all) ? all : [])
    .slice()
    .sort((a: any, b: any) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));

  const top = sorted.slice(0, 3).map((r: any) => ({
    postId: r.post_id,
    brandId: r.brand_id,
    brandName: brandMap.get(r.brand_id) ?? "",
    platform: r.platform,
    content: String(r.content ?? "").slice(0, 200),
    imageUrl: r.image_url ?? null,
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    shares: Number(r.shares ?? 0),
    impressions: Number(r.impressions ?? 0),
    engagementRate: Number(r.engagement_rate ?? 0),
    publishedAt: r.published_at,
  }));

  const totalEngagement = sorted.reduce(
    (s: number, r: any) => s + Number(r.likes ?? 0) + Number(r.comments ?? 0) + Number(r.shares ?? 0),
    0,
  );

  res.json({ posts: top, totalEngagement, sampleSize: sorted.length });
});

export default router;
