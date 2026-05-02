import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { db, postsTable, postCommentsTable, usersTable } from "@workspace/db";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import { retryPost } from "../lib/scheduler";

const router: IRouter = Router();

async function loadPostInWorkspace(postId: number, workspaceId: number) {
  const [post] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.workspaceId, workspaceId)));
  return post ?? null;
}

router.get("/posts/:id/comments", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const post = await loadPostInWorkspace(id, req.workspaceId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const rows = await db
    .select({
      id: postCommentsTable.id,
      postId: postCommentsTable.postId,
      parentId: postCommentsTable.parentId,
      content: postCommentsTable.content,
      createdAt: postCommentsTable.createdAt,
      userId: postCommentsTable.userId,
      authorEmail: usersTable.email,
      authorName: usersTable.name,
    })
    .from(postCommentsTable)
    .innerJoin(usersTable, eq(usersTable.id, postCommentsTable.userId))
    .where(eq(postCommentsTable.postId, id))
    .orderBy(asc(postCommentsTable.createdAt));
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/posts/:id/comments", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = z
    .object({ content: z.string().min(1).max(4000), parentId: z.number().int().positive().nullable().optional() })
    .safeParse(req.body);
  if (!body.success || !Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  if (!hasRoleAtLeast(req.workspaceRole, "viewer")) {
    res.status(403).json({ error: "No access" });
    return;
  }
  const post = await loadPostInWorkspace(id, req.workspaceId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (body.data.parentId) {
    const [parent] = await db
      .select({ id: postCommentsTable.id })
      .from(postCommentsTable)
      .where(and(eq(postCommentsTable.id, body.data.parentId), eq(postCommentsTable.postId, id)));
    if (!parent) {
      res.status(400).json({ error: "Parent comment not found on this post" });
      return;
    }
  }
  const [created] = await db
    .insert(postCommentsTable)
    .values({
      postId: id,
      userId: req.user.id,
      parentId: body.data.parentId ?? null,
      content: body.data.content,
    })
    .returning();
  res.status(201).json({
    ...created,
    authorEmail: req.user.email,
    authorName: req.user.name,
    createdAt: created.createdAt.toISOString(),
  });
});

router.delete("/posts/:postId/comments/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const postId = Number(req.params.postId);
  const id = Number(req.params.id);
  if (!Number.isInteger(postId) || !Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const post = await loadPostInWorkspace(postId, req.workspaceId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const [comment] = await db
    .select()
    .from(postCommentsTable)
    .where(and(eq(postCommentsTable.id, id), eq(postCommentsTable.postId, postId)));
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  // Author or admin can delete
  if (comment.userId !== req.user.id && !hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Cannot delete others' comments" });
    return;
  }
  await db.delete(postCommentsTable).where(eq(postCommentsTable.id, id));
  res.sendStatus(204);
});

// Editor submits a post for approval
router.post("/posts/:id/submit", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const post = await loadPostInWorkspace(id, req.workspaceId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.status !== "generated" && post.status !== "rejected") {
    res.status(409).json({ error: `Cannot submit a post with status "${post.status}"` });
    return;
  }
  const [updated] = await db
    .update(postsTable)
    .set({
      status: "pending_approval",
      submittedById: req.user.id,
      approvedById: null,
      approvedAt: null,
      errorMessage: null,
    })
    .where(eq(postsTable.id, id))
    .returning();
  res.json(updated);
});

// Admin approves; if `publish` is true and post is not already scheduled, publish immediately
router.post("/posts/:id/approve", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const body = z.object({ publish: z.boolean().optional() }).safeParse(req.body ?? {});
  const post = await loadPostInWorkspace(id, req.workspaceId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.status !== "pending_approval") {
    res.status(409).json({ error: `Cannot approve a post with status "${post.status}"` });
    return;
  }

  // Default: publish on approve. Caller can pass {publish:false} to leave a
  // scheduled post in "scheduled" state without publishing now.
  const shouldPublish = body.success && body.data.publish === false ? false : true;

  // Mark approved first so audit fields are persisted regardless of publish outcome.
  await db
    .update(postsTable)
    .set({
      status: post.scheduledFor ? "scheduled" : "generated",
      approvedById: req.user.id,
      approvedAt: new Date(),
    })
    .where(eq(postsTable.id, id));

  if (shouldPublish) {
    // retryPost expects a non-pending status — flip to "failed" briefly so it
    // re-uses the already-generated caption/image and publishes.
    await db.update(postsTable).set({ status: "failed" }).where(eq(postsTable.id, id));
    const result = await retryPost(id, req.workspaceId);
    const [updated] = await db.select().from(postsTable).where(eq(postsTable.id, id));
    res.json({ ...updated, publishResult: result });
    return;
  }

  const [updated] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  res.json(updated);
});

router.post("/posts/:id/reject", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const body = z.object({ reason: z.string().max(500).optional() }).safeParse(req.body ?? {});
  const post = await loadPostInWorkspace(id, req.workspaceId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.status !== "pending_approval") {
    res.status(409).json({ error: `Cannot reject a post with status "${post.status}"` });
    return;
  }
  const [updated] = await db
    .update(postsTable)
    .set({
      status: "rejected",
      approvedById: req.user.id,
      approvedAt: new Date(),
      errorMessage: body.success ? body.data.reason ?? null : null,
    })
    .where(eq(postsTable.id, id))
    .returning();
  res.json(updated);
});

export default router;
