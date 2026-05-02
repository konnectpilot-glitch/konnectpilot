import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  affiliatesTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
} from "@workspace/db";
import { requireAuth, ensureUser, requireSuperadmin } from "./users";
import {
  ensureAffiliate,
  findAffiliateByCode,
  AFFILIATE_CONFIG,
} from "../lib/affiliate";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const TrackClickBody = z.object({
  code: z.string().min(3).max(64),
  visitorId: z.string().max(128).optional(),
});

const AttributeSignupBody = z.object({
  code: z.string().min(3).max(64),
});

const UpdatePayoutBody = z.object({
  payoutMethod: z.enum(["paypal", "stripe_connect"]),
  paypalEmail: z.string().email().nullable().optional(),
  stripeConnectAccountId: z.string().max(128).nullable().optional(),
});

router.post("/affiliate/track-click", async (req: any, res): Promise<void> => {
  const parsed = TrackClickBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const aff = await findAffiliateByCode(parsed.data.code);
  if (!aff) {
    res.json({ ok: false });
    return;
  }
  await db.insert(affiliateReferralsTable).values({
    affiliateId: aff.id,
    code: aff.code,
    visitorId: parsed.data.visitorId ?? null,
    status: "clicked",
  });
  res.json({ ok: true });
});

router.post(
  "/affiliate/attribute-signup",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const parsed = AttributeSignupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await ensureUser(req.clerkUserId, req.clerkEmail);
    const aff = await findAffiliateByCode(parsed.data.code);
    if (!aff) {
      res.status(404).json({ error: "Unknown referral code" });
      return;
    }
    if (aff.userId === user.id) {
      res.status(400).json({ error: "Self-referrals are not allowed" });
      return;
    }
    // Already attributed?
    const [existing] = await db
      .select()
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.referredUserId, user.id));
    if (existing) {
      res.json({ ok: true, alreadyAttributed: true });
      return;
    }
    await db.insert(affiliateReferralsTable).values({
      affiliateId: aff.id,
      code: aff.code,
      referredUserId: user.id,
      signupAt: new Date(),
      status: "signed_up",
    });
    req.log.info({ affiliateId: aff.id, referredUserId: user.id }, "Affiliate signup attributed");
    res.json({ ok: true, alreadyAttributed: false });
  },
);

router.get("/affiliate/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const aff = await ensureAffiliate(user.id);

  const [agg] = await db
    .select({
      clicks: sql<number>`count(*) filter (where ${affiliateReferralsTable.referredUserId} is null)::int`,
      signups: sql<number>`count(*) filter (where ${affiliateReferralsTable.referredUserId} is not null)::int`,
      conversions: sql<number>`count(*) filter (where ${affiliateReferralsTable.convertedAt} is not null)::int`,
    })
    .from(affiliateReferralsTable)
    .where(eq(affiliateReferralsTable.affiliateId, aff.id));

  const [bal] = await db
    .select({
      pendingCents: sql<number>`coalesce(sum(${affiliateCommissionsTable.amountCents}) filter (where ${affiliateCommissionsTable.status} = 'pending'), 0)::int`,
      paidCents: sql<number>`coalesce(sum(${affiliateCommissionsTable.amountCents}) filter (where ${affiliateCommissionsTable.status} = 'paid'), 0)::int`,
      lifetimeEarnedCents: sql<number>`coalesce(sum(${affiliateCommissionsTable.amountCents}) filter (where ${affiliateCommissionsTable.status} in ('pending','paid')), 0)::int`,
    })
    .from(affiliateCommissionsTable)
    .where(eq(affiliateCommissionsTable.affiliateId, aff.id));

  const recentReferrals = await db
    .select()
    .from(affiliateReferralsTable)
    .where(eq(affiliateReferralsTable.affiliateId, aff.id))
    .orderBy(desc(affiliateReferralsTable.clickAt))
    .limit(20);

  res.json({
    code: aff.code,
    payoutMethod: aff.payoutMethod,
    paypalEmail: aff.paypalEmail,
    stripeConnectAccountId: aff.stripeConnectAccountId,
    config: {
      ratePct: Math.round(AFFILIATE_CONFIG.rate * 100),
      months: AFFILIATE_CONFIG.months,
      minPayoutCents: AFFILIATE_CONFIG.minPayoutCents,
      cookieDays: AFFILIATE_CONFIG.cookieDays,
    },
    stats: {
      clicks: Number(agg?.clicks ?? 0),
      signups: Number(agg?.signups ?? 0),
      conversions: Number(agg?.conversions ?? 0),
      pendingCents: Number(bal?.pendingCents ?? 0),
      paidCents: Number(bal?.paidCents ?? 0),
      lifetimeEarnedCents: Number(bal?.lifetimeEarnedCents ?? 0),
    },
    recentReferrals: recentReferrals.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      clickAt: r.clickAt.toISOString(),
      signupAt: r.signupAt?.toISOString() ?? null,
      convertedAt: r.convertedAt?.toISOString() ?? null,
    })),
  });
});

router.patch(
  "/affiliate/me/payout",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const parsed = UpdatePayoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await ensureUser(req.clerkUserId, req.clerkEmail);
    const aff = await ensureAffiliate(user.id);
    const updates: Partial<typeof affiliatesTable.$inferInsert> = {
      payoutMethod: parsed.data.payoutMethod,
    };
    if (parsed.data.paypalEmail !== undefined) {
      updates.paypalEmail = parsed.data.paypalEmail;
    }
    if (parsed.data.stripeConnectAccountId !== undefined) {
      updates.stripeConnectAccountId = parsed.data.stripeConnectAccountId;
    }
    await db.update(affiliatesTable).set(updates).where(eq(affiliatesTable.id, aff.id));
    res.json({ ok: true });
  },
);

// Admin: list affiliates with pending balances and trigger payouts
router.get(
  "/admin/affiliates",
  requireAuth,
  requireSuperadmin,
  async (_req: any, res): Promise<void> => {
    const rows = await db
      .select({
        affiliate: affiliatesTable,
        pendingCents: sql<number>`coalesce(sum(${affiliateCommissionsTable.amountCents}) filter (where ${affiliateCommissionsTable.status} = 'pending'), 0)::int`,
        paidCents: sql<number>`coalesce(sum(${affiliateCommissionsTable.amountCents}) filter (where ${affiliateCommissionsTable.status} = 'paid'), 0)::int`,
      })
      .from(affiliatesTable)
      .leftJoin(
        affiliateCommissionsTable,
        eq(affiliateCommissionsTable.affiliateId, affiliatesTable.id),
      )
      .groupBy(affiliatesTable.id);

    res.json(
      rows.map((r) => ({
        id: r.affiliate.id,
        userId: r.affiliate.userId,
        code: r.affiliate.code,
        payoutMethod: r.affiliate.payoutMethod,
        paypalEmail: r.affiliate.paypalEmail,
        stripeConnectAccountId: r.affiliate.stripeConnectAccountId,
        pendingCents: Number(r.pendingCents ?? 0),
        paidCents: Number(r.paidCents ?? 0),
        lifetimePaidCents: r.affiliate.lifetimePaidCents,
      })),
    );
  },
);

router.post(
  "/admin/affiliates/:id/pay",
  requireAuth,
  requireSuperadmin,
  async (req: any, res): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [aff] = await db
      .select()
      .from(affiliatesTable)
      .where(eq(affiliatesTable.id, id));
    if (!aff) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const force = req.body?.force === true;

    // Pre-aggregate the pending balance so we can enforce the minimum payout
    // threshold before mutating any rows.
    const [pending] = await db
      .select({
        total: sql<number>`coalesce(sum(${affiliateCommissionsTable.amountCents}), 0)::int`,
      })
      .from(affiliateCommissionsTable)
      .where(
        and(
          eq(affiliateCommissionsTable.affiliateId, aff.id),
          eq(affiliateCommissionsTable.status, "pending"),
        ),
      );
    const pendingCents = Number(pending?.total ?? 0);
    if (pendingCents < AFFILIATE_CONFIG.minPayoutCents && !force) {
      res.status(400).json({
        error: "Pending balance is below the minimum payout threshold",
        code: "below_minimum",
        pendingCents,
        minPayoutCents: AFFILIATE_CONFIG.minPayoutCents,
      });
      return;
    }

    const now = new Date();
    const updated = await db
      .update(affiliateCommissionsTable)
      .set({ status: "paid", paidAt: now })
      .where(
        and(
          eq(affiliateCommissionsTable.affiliateId, aff.id),
          eq(affiliateCommissionsTable.status, "pending"),
        ),
      )
      .returning({ amountCents: affiliateCommissionsTable.amountCents });

    const totalCents = updated.reduce((s, r) => s + r.amountCents, 0);
    if (totalCents > 0) {
      await db
        .update(affiliatesTable)
        .set({ lifetimePaidCents: aff.lifetimePaidCents + totalCents })
        .where(eq(affiliatesTable.id, aff.id));
    }
    logger.info(
      { affiliateId: aff.id, totalCents, count: updated.length, adminId: req.adminUser.id },
      "Affiliate payout processed",
    );
    res.json({ ok: true, paidCents: totalCents, commissionCount: updated.length });
  },
);

export default router;
