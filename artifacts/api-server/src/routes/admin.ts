import { Router, type IRouter } from "express";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  brandsTable,
  postsTable,
  aiUsageTable,
} from "@workspace/db";
import { requireAuth, requireSuperadmin } from "./users";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PLAN_MRR_CENTS: Record<string, number> = {
  free: 0,
  starter: 1900,
  pro: 4900,
  agency: 9900,
};

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function serializeAdminUser(row: {
  user: typeof usersTable.$inferSelect;
  brandCount: number;
  postCount: number;
  creditsUsed: number;
  lastActivityAt: Date | string | null;
}) {
  const lastActivity =
    row.lastActivityAt == null
      ? null
      : row.lastActivityAt instanceof Date
        ? row.lastActivityAt
        : new Date(row.lastActivityAt);
  const plan = row.user.plan;
  const status = row.user.subscriptionStatus;
  const mrrCents =
    status && status !== "active" && status !== "trialing"
      ? 0
      : PLAN_MRR_CENTS[plan] ?? 0;
  return {
    id: row.user.id,
    clerkId: row.user.clerkId,
    email: row.user.email,
    name: row.user.name,
    plan,
    isSuperadmin: row.user.isSuperadmin,
    subscriptionStatus: status ?? null,
    trialEndsAt: row.user.trialEndsAt?.toISOString() ?? null,
    brandCount: row.brandCount,
    postCount: row.postCount,
    creditsUsed: row.creditsUsed,
    bonusCredits: Number(row.user.bonusCredits ?? 0),
    mrrCents,
    lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
    createdAt: row.user.createdAt.toISOString(),
  };
}

async function loadSummary(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const [{ brandCount }] = await db
    .select({ brandCount: sql<number>`count(*)::int` })
    .from(brandsTable)
    .where(eq(brandsTable.userId, userId));
  const [{ postCount, lastActivityAt }] = await db
    .select({
      postCount: sql<number>`count(${postsTable.id})::int`,
      lastActivityAt: sql<Date | null>`max(${postsTable.createdAt})`,
    })
    .from(postsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, postsTable.brandId))
    .where(eq(brandsTable.userId, userId));
  const since = startOfMonthUtc();
  const [usage] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsageTable.creditCost}), 0)::float` })
    .from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, userId), gte(aiUsageTable.createdAt, since)));
  return serializeAdminUser({
    user,
    brandCount: Number(brandCount) || 0,
    postCount: Number(postCount) || 0,
    creditsUsed: Number(usage?.total ?? 0),
    lastActivityAt: lastActivityAt ?? null,
  });
}

router.get("/admin/users", requireAuth, requireSuperadmin, async (_req, res): Promise<void> => {
  const since = startOfMonthUtc();

  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

  const brandRows = await db
    .select({ userId: brandsTable.userId, n: sql<number>`count(*)::int` })
    .from(brandsTable)
    .groupBy(brandsTable.userId);
  const brandByUser = new Map(brandRows.map((r) => [r.userId, Number(r.n)]));

  const postRows = await db
    .select({
      userId: brandsTable.userId,
      n: sql<number>`count(${postsTable.id})::int`,
      last: sql<Date | null>`max(${postsTable.createdAt})`,
    })
    .from(postsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, postsTable.brandId))
    .groupBy(brandsTable.userId);
  const postByUser = new Map(
    postRows.map((r) => [r.userId, { n: Number(r.n), last: r.last ?? null }]),
  );

  const usageRows = await db
    .select({
      userId: aiUsageTable.userId,
      total: sql<number>`coalesce(sum(${aiUsageTable.creditCost}), 0)::float`,
    })
    .from(aiUsageTable)
    .where(gte(aiUsageTable.createdAt, since))
    .groupBy(aiUsageTable.userId);
  const usageByUser = new Map(usageRows.map((r) => [r.userId, Number(r.total)]));

  const result = users.map((u) => {
    const post = postByUser.get(u.id);
    return serializeAdminUser({
      user: u,
      brandCount: brandByUser.get(u.id) ?? 0,
      postCount: post?.n ?? 0,
      creditsUsed: usageByUser.get(u.id) ?? 0,
      lastActivityAt: post?.last ?? null,
    });
  });

  res.json(result);
});

router.post(
  "/admin/users/:id/reset-trial",
  requireAuth,
  requireSuperadmin,
  async (req: any, res): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [updated] = await db
      .update(usersTable)
      .set({ trialEndsAt })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info({ adminId: req.adminUser.id, userId: id }, "Trial reset by admin");
    const summary = await loadSummary(id);
    res.json(summary);
  },
);

router.patch(
  "/admin/users/:id/plan",
  requireAuth,
  requireSuperadmin,
  async (req: any, res): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const plan = req.body?.plan;
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!["free", "starter", "pro", "agency"].includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ plan })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info({ adminId: req.adminUser.id, userId: id, plan }, "Plan changed by admin");
    const summary = await loadSummary(id);
    res.json(summary);
  },
);

router.post(
  "/admin/users/:id/impersonate",
  requireAuth,
  requireSuperadmin,
  async (req: any, res): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (id === req.adminUser.id) {
      res.status(400).json({ error: "Cannot impersonate yourself" });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info(
      { adminId: req.adminUser.id, targetUserId: target.id, targetEmail: target.email },
      "Impersonation session started",
    );
    res.json({
      userId: target.id,
      clerkId: target.clerkId,
      email: target.email,
      name: target.name,
      plan: target.plan,
    });
  },
);

router.patch(
  "/admin/users/:id/superadmin",
  requireAuth,
  requireSuperadmin,
  async (req: any, res): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const isSuperadmin = req.body?.isSuperadmin;
    if (Number.isNaN(id) || typeof isSuperadmin !== "boolean") {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    if (id === req.adminUser.id && isSuperadmin === false) {
      res.status(400).json({ error: "Cannot remove superadmin from yourself" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ isSuperadmin })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.info(
      { adminId: req.adminUser.id, userId: id, isSuperadmin },
      "Superadmin flag changed",
    );
    const summary = await loadSummary(id);
    res.json(summary);
  },
);

export default router;
