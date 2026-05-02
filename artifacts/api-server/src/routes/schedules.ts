import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  postingSchedulesTable,
  brandsTable,
  postsTable,
} from "@workspace/db";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";

const router: IRouter = Router();

const ALLOWED_PLATFORMS = ["facebook", "instagram", "linkedin"] as const;
// Strict HH:MM, 00:00 to 23:59
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleBodySchema = z.object({
  brandId: z.number().int().positive(),
  name: z.string().min(1).max(120),
  platforms: z.array(z.enum(ALLOWED_PLATFORMS)).min(1),
  postTimes: z.array(z.string().regex(TIME_REGEX)).min(1).max(24),
  timezone: z.string().min(1).max(64).default("UTC"),
  contentPrompt: z.string().max(2000).nullable().optional(),
  imageStyle: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

router.get("/schedules", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const rows = await db
    .select({
      id: postingSchedulesTable.id,
      brandId: postingSchedulesTable.brandId,
      brandName: brandsTable.name,
      name: postingSchedulesTable.name,
      isActive: postingSchedulesTable.isActive,
      platforms: postingSchedulesTable.platforms,
      postTimes: postingSchedulesTable.postTimes,
      timezone: postingSchedulesTable.timezone,
      contentPrompt: postingSchedulesTable.contentPrompt,
      imageStyle: postingSchedulesTable.imageStyle,
      lastRunAt: postingSchedulesTable.lastRunAt,
      createdAt: postingSchedulesTable.createdAt,
    })
    .from(postingSchedulesTable)
    .innerJoin(brandsTable, eq(brandsTable.id, postingSchedulesTable.brandId))
    .where(eq(postingSchedulesTable.workspaceId, req.workspaceId))
    .orderBy(desc(postingSchedulesTable.createdAt));
  res.json(rows);
});

router.post("/schedules", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const parsed = scheduleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  const [row] = await db
    .insert(postingSchedulesTable)
    .values({
      userId: req.user.id,
      workspaceId: req.workspaceId,
      brandId: parsed.data.brandId,
      name: parsed.data.name,
      platforms: parsed.data.platforms,
      postTimes: parsed.data.postTimes,
      timezone: parsed.data.timezone,
      contentPrompt: parsed.data.contentPrompt ?? null,
      imageStyle: parsed.data.imageStyle ?? null,
      isActive: parsed.data.isActive ?? true,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/schedules/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = scheduleBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(postingSchedulesTable)
    .where(and(eq(postingSchedulesTable.id, id), eq(postingSchedulesTable.workspaceId, req.workspaceId)));
  if (!existing) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  // Tenant isolation: if brandId is being changed, verify it belongs to this workspace.
  if (parsed.data.brandId !== undefined && parsed.data.brandId !== existing.brandId) {
    const [brand] = await db
      .select({ id: brandsTable.id })
      .from(brandsTable)
      .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.workspaceId, req.workspaceId)));
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
  }

  const updates: Partial<typeof postingSchedulesTable.$inferInsert> = {};
  if (parsed.data.brandId !== undefined) updates.brandId = parsed.data.brandId;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.platforms !== undefined) updates.platforms = parsed.data.platforms;
  if (parsed.data.postTimes !== undefined) updates.postTimes = parsed.data.postTimes;
  if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
  if (parsed.data.contentPrompt !== undefined) updates.contentPrompt = parsed.data.contentPrompt;
  if (parsed.data.imageStyle !== undefined) updates.imageStyle = parsed.data.imageStyle;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [updated] = await db
    .update(postingSchedulesTable)
    .set(updates)
    .where(eq(postingSchedulesTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/schedules/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .delete(postingSchedulesTable)
    .where(and(eq(postingSchedulesTable.id, id), eq(postingSchedulesTable.workspaceId, req.workspaceId)));
  res.status(204).end();
});

router.get("/schedules/:id/posts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [schedule] = await db
    .select()
    .from(postingSchedulesTable)
    .where(and(eq(postingSchedulesTable.id, id), eq(postingSchedulesTable.workspaceId, req.workspaceId)));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  const rows = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.scheduleId, id))
    .orderBy(desc(postsTable.createdAt))
    .limit(50);
  res.json(rows);
});

export default router;
