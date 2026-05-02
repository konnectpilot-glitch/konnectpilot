import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandsTable } from "@workspace/db";
import {
  ListBrandsResponse,
  GetBrandResponse,
  CreateBrandBody,
  UpdateBrandBody,
  GetBrandParams,
  UpdateBrandParams,
  DeleteBrandParams,
} from "@workspace/api-zod";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";

const router: IRouter = Router();

const PLAN_BRAND_LIMITS: Record<string, number | null> = {
  free: 1,
  starter: 1,
  pro: 5,
  agency: null, // unlimited
};

router.get("/brands", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brands = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId))
    .orderBy(brandsTable.createdAt);

  res.json(ListBrandsResponse.parse(brands.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }))));
});

router.post("/brands", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Plan limits scoped per workspace
  const limit = PLAN_BRAND_LIMITS[req.user.plan] ?? null;
  if (limit !== null) {
    const existing = await db.select().from(brandsTable).where(eq(brandsTable.workspaceId, req.workspaceId));
    if (existing.length >= limit) {
      res.status(403).json({ error: `Your plan allows a maximum of ${limit} brand(s). Please upgrade.` });
      return;
    }
  }

  const [brand] = await db
    .insert(brandsTable)
    .values({
      userId: req.user.id,
      workspaceId: req.workspaceId,
      name: parsed.data.name,
      industry: parsed.data.industry,
      tone: parsed.data.tone,
      targetAudience: parsed.data.targetAudience,
      keywords: parsed.data.keywords,
      platforms: parsed.data.platforms,
      postTime: parsed.data.postTime ?? "09:00",
    })
    .returning();

  res.status(201).json(GetBrandResponse.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  }));
});

router.get("/brands/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const params = GetBrandParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.json(GetBrandResponse.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  }));
});

router.patch("/brands/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const params = UpdateBrandParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof brandsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.industry != null) updates.industry = parsed.data.industry;
  if (parsed.data.tone != null) updates.tone = parsed.data.tone;
  if (parsed.data.targetAudience != null) updates.targetAudience = parsed.data.targetAudience;
  if (parsed.data.keywords != null) updates.keywords = parsed.data.keywords;
  if (parsed.data.platforms != null) updates.platforms = parsed.data.platforms;
  if (parsed.data.postTime != null) updates.postTime = parsed.data.postTime;
  if (parsed.data.active != null) updates.active = parsed.data.active;

  const [brand] = await db
    .update(brandsTable)
    .set(updates)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)))
    .returning();

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.json(GetBrandResponse.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  }));
});

router.delete("/brands/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const params = DeleteBrandParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(brandsTable)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
