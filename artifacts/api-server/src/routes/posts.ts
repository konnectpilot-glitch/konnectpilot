import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, postsTable, brandsTable } from "@workspace/db";
import {
  ListPostsResponse,
  ListPostsQueryParams,
  DeletePostParams,
} from "@workspace/api-zod";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import { retryPost } from "../lib/scheduler";

const router: IRouter = Router();

router.get("/posts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const params = ListPostsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Brand name lookup
  const wsBrands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));
  const brandMap = new Map(wsBrands.map((b) => [b.id, b.name]));

  const conditions = [eq(postsTable.workspaceId, req.workspaceId)];
  if (params.data.brandId) conditions.push(eq(postsTable.brandId, params.data.brandId));
  if (params.data.platform) conditions.push(eq(postsTable.platform, params.data.platform));
  if (params.data.status) conditions.push(eq(postsTable.status, params.data.status));

  const posts = await db
    .select()
    .from(postsTable)
    .where(and(...conditions))
    .orderBy(desc(postsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListPostsResponse.parse(posts.map((p) => ({
    ...p,
    brandName: brandMap.get(p.brandId) ?? null,
    imageUrl: p.imageUrl ?? null,
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }))));
});

router.delete("/posts/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const params = DeletePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.workspaceId, req.workspaceId)));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await db.delete(postsTable).where(eq(postsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/posts/:id/retry", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const [existing] = await db
    .select({ id: postsTable.id, status: postsTable.status })
    .from(postsTable)
    .where(and(eq(postsTable.id, id), eq(postsTable.workspaceId, req.workspaceId)));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (existing.status !== "failed") {
    res.status(409).json({ error: `Cannot retry a post with status "${existing.status}".` });
    return;
  }

  const result = await retryPost(id, req.workspaceId);
  if (result.ok) {
    res.json({ ok: true, status: result.status, platformPostId: result.platformPostId });
    return;
  }
  res.status(502).json({ ok: false, status: result.status, error: result.error });
});

export default router;
