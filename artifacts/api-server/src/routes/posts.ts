import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, postsTable, brandsTable } from "@workspace/db";
import {
  ListPostsResponse,
  ListPostsQueryParams,
  DeletePostParams,
} from "@workspace/api-zod";
import { requireAuth, ensureUser } from "./users";
import { retryPost } from "../lib/scheduler";

const router: IRouter = Router();

router.get("/posts", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const params = ListPostsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Get brand IDs belonging to this user
  const userBrands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.userId, user.id));

  if (userBrands.length === 0) {
    res.json([]);
    return;
  }

  const brandMap = new Map(userBrands.map(b => [b.id, b.name]));
  const brandIds = userBrands.map(b => b.id);

  let query = db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.brandId} = ANY(${brandIds})`)
    .orderBy(desc(postsTable.createdAt))
    .$dynamic();

  if (params.data.brandId) {
    query = query.where(eq(postsTable.brandId, params.data.brandId));
  }
  if (params.data.platform) {
    query = query.where(eq(postsTable.platform, params.data.platform));
  }
  if (params.data.status) {
    query = query.where(eq(postsTable.status, params.data.status));
  }
  if (params.data.limit) {
    query = query.limit(params.data.limit);
  }
  if (params.data.offset) {
    query = query.offset(params.data.offset);
  }

  const posts = await db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.brandId} = ANY(ARRAY[${sql.raw(brandIds.join(","))}]::int[])`)
    .orderBy(desc(postsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  const filteredPosts = posts
    .filter(p => !params.data.brandId || p.brandId === params.data.brandId)
    .filter(p => !params.data.platform || p.platform === params.data.platform)
    .filter(p => !params.data.status || p.status === params.data.status);

  res.json(ListPostsResponse.parse(filteredPosts.map(p => ({
    ...p,
    brandName: brandMap.get(p.brandId) ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }))));
});

router.delete("/posts/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const params = DeletePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify post belongs to user's brand
  const [post] = await db
    .select({ postId: postsTable.id, brandUserId: brandsTable.userId })
    .from(postsTable)
    .innerJoin(brandsTable, eq(postsTable.brandId, brandsTable.id))
    .where(and(eq(postsTable.id, params.data.id), eq(brandsTable.userId, user.id)));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await db.delete(postsTable).where(eq(postsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/posts/:id/retry", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  // Look up the post first so we can return 404 vs 409 cleanly.
  const [existing] = await db
    .select({ id: postsTable.id, status: postsTable.status })
    .from(postsTable)
    .innerJoin(brandsTable, eq(postsTable.brandId, brandsTable.id))
    .where(and(eq(postsTable.id, id), eq(brandsTable.userId, user.id)));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (existing.status !== "failed") {
    res.status(409).json({ error: `Cannot retry a post with status "${existing.status}".` });
    return;
  }

  const result = await retryPost(id, user.id);
  if (result.ok) {
    res.json({ ok: true, status: result.status, platformPostId: result.platformPostId });
    return;
  }
  res.status(502).json({ ok: false, status: result.status, error: result.error });
});

export default router;
