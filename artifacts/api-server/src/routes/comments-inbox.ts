import { Router, type IRouter } from "express";
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import {
  db,
  audienceCommentsTable,
  brandsTable,
  postsTable,
} from "@workspace/db";
import { requireAuth, requireWorkspace } from "./users";

// Audience comment inbox API
// ──────────────────────────
// Returns active comments (not replied, not dismissed) across all the
// workspace's brands, with the post each one is attached to so the UI can
// show context for the AI reply drafter.
//
// Three endpoints:
//   GET /comments/inbox             — list active comments
//   POST /comments/:id/dismiss      — soft-archive (spam / not relevant)
//   POST /comments/:id/mark-replied — mark handled; optionally record the
//                                     reply text so brand-memory can learn
//                                     from it later.

const router: IRouter = Router();

router.get("/comments/inbox", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  // Brands in this workspace.
  const brands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));
  if (brands.length === 0) {
    res.json({ comments: [], unrepliedCount: 0 });
    return;
  }
  const brandIds = brands.map((b) => b.id);
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));

  // Pull active comments + the post they're on (for context in the UI).
  const rows = await db
    .select({
      id: audienceCommentsTable.id,
      brandId: audienceCommentsTable.brandId,
      postId: audienceCommentsTable.postId,
      platform: audienceCommentsTable.platform,
      authorName: audienceCommentsTable.authorName,
      content: audienceCommentsTable.content,
      platformCreatedAt: audienceCommentsTable.platformCreatedAt,
      fetchedAt: audienceCommentsTable.fetchedAt,
      postContent: postsTable.content,
      postImageUrl: postsTable.imageUrl,
    })
    .from(audienceCommentsTable)
    .innerJoin(postsTable, eq(postsTable.id, audienceCommentsTable.postId))
    .where(
      and(
        inArray(audienceCommentsTable.brandId, brandIds),
        isNull(audienceCommentsTable.repliedAt),
        isNull(audienceCommentsTable.dismissedAt),
      ),
    )
    .orderBy(desc(audienceCommentsTable.platformCreatedAt))
    .limit(50);

  res.json({
    comments: rows.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      brandName: brandMap.get(r.brandId),
      postId: r.postId,
      platform: r.platform,
      authorName: r.authorName,
      content: r.content,
      platformCreatedAt: r.platformCreatedAt,
      fetchedAt: r.fetchedAt,
      postContent: r.postContent?.slice(0, 500) ?? null,
      postImageUrl: r.postImageUrl ?? null,
    })),
    unrepliedCount: rows.length,
  });
});

// Helper — confirms the comment exists AND belongs to the current workspace.
// Used by both action endpoints to keep tenancy honest.
async function loadCommentInWorkspace(commentId: number, workspaceId: number) {
  const [row] = await db
    .select({
      id: audienceCommentsTable.id,
      brandId: audienceCommentsTable.brandId,
      workspaceId: brandsTable.workspaceId,
    })
    .from(audienceCommentsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, audienceCommentsTable.brandId))
    .where(eq(audienceCommentsTable.id, commentId));
  if (!row || row.workspaceId !== workspaceId) return null;
  return row;
}

router.post("/comments/:id/dismiss", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }
  const row = await loadCommentInWorkspace(id, req.workspaceId);
  if (!row) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  await db
    .update(audienceCommentsTable)
    .set({ dismissedAt: new Date() })
    .where(eq(audienceCommentsTable.id, id));
  res.json({ dismissed: true });
});

router.post("/comments/:id/mark-replied", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }
  const row = await loadCommentInWorkspace(id, req.workspaceId);
  if (!row) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  const replyContent = typeof req.body?.replyContent === "string"
    ? req.body.replyContent.slice(0, 4000)
    : null;
  await db
    .update(audienceCommentsTable)
    .set({
      repliedAt: new Date(),
      repliedBy: req.user.id,
      replyContent,
    })
    .where(eq(audienceCommentsTable.id, id));
  res.json({ replied: true });
});

export default router;
