import { Router, type IRouter } from "express";
import { eq, and, count, sql, desc } from "drizzle-orm";
import { db, postsTable, brandsTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentPostsResponse,
  GetPlatformBreakdownResponse,
} from "@workspace/api-zod";
import { requireAuth, ensureUser } from "./users";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);

  const brands = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(eq(brandsTable.userId, user.id));

  const brandIds = brands.map(b => b.id);
  const totalBrands = brands.length;

  if (brandIds.length === 0) {
    res.json(GetDashboardStatsResponse.parse({
      totalBrands: 0,
      totalPosts: 0,
      publishedPosts: 0,
      generatedPosts: 0,
      failedPosts: 0,
      platformsConnected: 0,
      postsThisWeek: 0,
      postsThisMonth: 0,
    }));
    return;
  }

  const brandIdArray = brandIds.join(",");

  const allPosts = await db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.brandId} = ANY(ARRAY[${sql.raw(brandIdArray)}]::int[])`);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const totalPosts = allPosts.length;
  const publishedPosts = allPosts.filter(p => p.status === "published").length;
  const generatedPosts = allPosts.filter(p => p.status === "generated").length;
  const failedPosts = allPosts.filter(p => p.status === "failed").length;
  const postsThisWeek = allPosts.filter(p => p.createdAt >= weekAgo).length;
  const postsThisMonth = allPosts.filter(p => p.createdAt >= monthAgo).length;

  // Count distinct platforms across all brands
  const allPlatforms = new Set(brands.flatMap(() => []));

  res.json(GetDashboardStatsResponse.parse({
    totalBrands,
    totalPosts,
    publishedPosts,
    generatedPosts,
    failedPosts,
    platformsConnected: 0,
    postsThisWeek,
    postsThisMonth,
  }));
});

router.get("/dashboard/recent-posts", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);

  const brands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.userId, user.id));

  if (brands.length === 0) {
    res.json([]);
    return;
  }

  const brandMap = new Map(brands.map(b => [b.id, b.name]));
  const brandIds = brands.map(b => b.id);
  const brandIdArray = brandIds.join(",");

  const posts = await db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.brandId} = ANY(ARRAY[${sql.raw(brandIdArray)}]::int[])`)
    .orderBy(desc(postsTable.createdAt))
    .limit(10);

  res.json(GetRecentPostsResponse.parse(posts.map(p => ({
    ...p,
    brandName: brandMap.get(p.brandId) ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }))));
});

router.get("/dashboard/platform-breakdown", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);

  const brands = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(eq(brandsTable.userId, user.id));

  if (brands.length === 0) {
    res.json([]);
    return;
  }

  const brandIds = brands.map(b => b.id);
  const brandIdArray = brandIds.join(",");

  const posts = await db
    .select({ platform: postsTable.platform })
    .from(postsTable)
    .where(sql`${postsTable.brandId} = ANY(ARRAY[${sql.raw(brandIdArray)}]::int[])`);

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
