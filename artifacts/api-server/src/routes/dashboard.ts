import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, postsTable, brandsTable } from "@workspace/db";
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

export default router;
