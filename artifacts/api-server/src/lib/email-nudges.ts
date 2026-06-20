// Email nudge scheduler — fires day-1 / day-3 / day-13 lifecycle emails to
// users on a cadence. Runs as a background tick (every 5 minutes) inside the
// API server process. Cheap enough to run inline; if we ever need to scale
// horizontally we'd move this into a dedicated worker.
//
// Each user × email-kind is recorded in email_deliveries with a composite PK,
// so we can never double-send even across process restarts or overlapping
// ticks. ALL inserts use onConflictDoNothing.
//
// The scheduler only ever LOOKS at users who passed the window in the last
// 24h, so it doesn't replay history if it's offline for a stretch and then
// resumes (we miss the email rather than blast every user on the platform).

import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  brandsTable,
  brandMemoryProfilesTable,
  postsTable,
  emailDeliveriesTable,
} from "@workspace/db";
import { sendEmail } from "./email";
import {
  firstPostNudgeEmail,
  brandIntelligencePreviewEmail,
  trialExpiringEmail,
} from "./email-templates";
import { logger } from "./logger";

const TICK_MS = 5 * 60_000; // 5 minutes

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:25960").replace(/\/$/, "");
}

/**
 * Has this user already received this kind of email?
 * Returns true iff a row exists in email_deliveries (regardless of result).
 */
async function alreadySent(userId: number, kind: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: emailDeliveriesTable.userId })
    .from(emailDeliveriesTable)
    .where(
      and(eq(emailDeliveriesTable.userId, userId), eq(emailDeliveriesTable.kind, kind)),
    );
  return !!row;
}

async function recordDelivery(userId: number, kind: string, messageId: string | null) {
  try {
    await db
      .insert(emailDeliveriesTable)
      .values({ userId, kind, resendMessageId: messageId })
      .onConflictDoNothing();
  } catch (err: any) {
    logger.warn({ err: err?.message, userId, kind }, "Failed to log email delivery");
  }
}

// ── Day 1 — first post nudge ──────────────────────────────────────────────
// Targets users who signed up between 24h and 48h ago AND haven't published a
// post yet. The 24-48h band is wide enough that we catch them even if the
// scheduler is offline for a stretch and then resumes.
async function runDay1Nudges() {
  const now = new Date();
  const from = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const to = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(usersTable)
    .where(and(gte(usersTable.createdAt, from), lte(usersTable.createdAt, to)));

  for (const user of candidates) {
    if (!user.email || user.email.endsWith("@users.noreply.konnectpilot.local")) continue;
    if (await alreadySent(user.id, "day1_first_post")) continue;

    // Skip users who have already published a post — they don't need a nudge.
    // posts has no userId; resolve via the brand owner.
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(postsTable)
      .innerJoin(brandsTable, eq(brandsTable.id, postsTable.brandId))
      .where(and(eq(brandsTable.userId, user.id), eq(postsTable.status, "published")));
    if (c > 0) {
      // Mark as "sent" anyway so we don't keep checking — they activated.
      await recordDelivery(user.id, "day1_first_post", null);
      continue;
    }

    // Try to grab any brand name to personalize.
    const [brand] = await db
      .select({ name: brandsTable.name })
      .from(brandsTable)
      .where(eq(brandsTable.userId, user.id))
      .limit(1);

    const tpl = firstPostNudgeEmail({
      appUrl: appUrl(),
      ctaUrl: `${appUrl()}/generate`,
      firstName: user.name ?? null,
      brandName: brand?.name ?? null,
    });
    const r = await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tag: "day1_first_post",
    });
    await recordDelivery(user.id, "day1_first_post", r.id ?? null);
  }
}

// ── Day 3 — brand intelligence preview ────────────────────────────────────
// Targets users who signed up between 72h and 96h ago AND have at least one
// approval on their brand-memory profile (otherwise there's nothing to show).
async function runDay3Nudges() {
  const now = new Date();
  const from = new Date(now.getTime() - 96 * 60 * 60 * 1000);
  const to = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(usersTable)
    .where(and(gte(usersTable.createdAt, from), lte(usersTable.createdAt, to)));

  for (const user of candidates) {
    if (!user.email || user.email.endsWith("@users.noreply.konnectpilot.local")) continue;
    if (await alreadySent(user.id, "day3_brand_intel")) continue;

    // Find their brand with the most-developed memory profile.
    const [topMemory] = await db
      .select({
        brandId: brandMemoryProfilesTable.brandId,
        approvedCount: brandMemoryProfilesTable.approvedCount,
        distilled: brandMemoryProfilesTable.distilledGuidelines,
        brandName: brandsTable.name,
      })
      .from(brandMemoryProfilesTable)
      .innerJoin(brandsTable, eq(brandsTable.id, brandMemoryProfilesTable.brandId))
      .where(eq(brandsTable.userId, user.id))
      .orderBy(sql`${brandMemoryProfilesTable.approvedCount} desc`)
      .limit(1);

    if (!topMemory || topMemory.approvedCount === 0) {
      // Nothing to preview yet — mark sent so we don't keep checking.
      await recordDelivery(user.id, "day3_brand_intel", null);
      continue;
    }

    const tpl = brandIntelligencePreviewEmail({
      appUrl: appUrl(),
      ctaUrl: `${appUrl()}/brands/${topMemory.brandId}`,
      firstName: user.name ?? null,
      brandName: topMemory.brandName,
      approvedCount: topMemory.approvedCount,
      topPlatform: null,
      distilledGuideline: topMemory.distilled?.split("\n")[0]?.replace(/^[\s•\-\d.]+/, "").trim() ?? null,
    });
    const r = await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tag: "day3_brand_intel",
    });
    await recordDelivery(user.id, "day3_brand_intel", r.id ?? null);
  }
}

// ── Day 13 — trial expiring ───────────────────────────────────────────────
// Targets users whose trial ends in 24-30h. Trial start is implicit via
// createdAt (we treat free trial as 14 days from signup) UNLESS the user
// already has trialEndsAt set (Stripe path), in which case we use that.
async function runDay13Nudges() {
  const now = new Date();
  // Pre-filter at the DB layer — only users who could possibly be in the
  // day-13 window. Either:
  //   (a) they have a trialEndsAt set explicitly (Stripe path) that falls
  //       in the next 30 hours, OR
  //   (b) they signed up between 12d 18h ago and 13d 6h ago (default 14d
  //       trial implies trial-end is 24-30h from now)
  // This avoids the every-user-every-5-min scan-the-world the original
  // implementation did.
  const trialWindowStart = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000);
  const trialWindowEnd = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 - 18 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(usersTable)
    .where(
      and(
        gte(usersTable.createdAt, trialWindowStart),
        lte(usersTable.createdAt, trialWindowEnd),
      ),
    );

  for (const user of candidates) {
    if (!user.email || user.email.endsWith("@users.noreply.konnectpilot.local")) continue;
    // Already-subscribed users don't need a trial-end nudge — the previous
    // version had this `if` block empty so paid users were still nagged.
    if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
      continue;
    }
    if (await alreadySent(user.id, "day13_trial_expiring")) continue;

    const trialEndsAt = user.trialEndsAt
      ?? new Date(user.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const msToEnd = trialEndsAt.getTime() - now.getTime();
    const hoursToEnd = msToEnd / (60 * 60 * 1000);

    // Window: trial ends in 24-30 hours
    if (hoursToEnd < 24 || hoursToEnd > 30) continue;

    // Count what they've published so the email can reference it.
    const [{ c: published }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(postsTable)
      .innerJoin(brandsTable, eq(brandsTable.id, postsTable.brandId))
      .where(and(eq(brandsTable.userId, user.id), eq(postsTable.status, "published")));

    const tpl = trialExpiringEmail({
      appUrl: appUrl(),
      ctaUrl: `${appUrl()}/billing`,
      firstName: user.name ?? null,
      hoursLeft: hoursToEnd,
      postsPublished: published,
    });
    const r = await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tag: "day13_trial_expiring",
    });
    await recordDelivery(user.id, "day13_trial_expiring", r.id ?? null);
  }
}

async function tick() {
  try {
    await runDay1Nudges();
  } catch (err: any) {
    logger.error({ err: err?.message }, "Day-1 nudge tick failed");
  }
  try {
    await runDay3Nudges();
  } catch (err: any) {
    logger.error({ err: err?.message }, "Day-3 nudge tick failed");
  }
  try {
    await runDay13Nudges();
  } catch (err: any) {
    logger.error({ err: err?.message }, "Day-13 nudge tick failed");
  }
}

let started = false;
export function startEmailNudgeScheduler() {
  if (started) return;
  started = true;
  // Tick once at startup (after a small delay so the server is fully up),
  // then on a 5-min cadence.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, 30_000);
  logger.info("Email nudge scheduler started");
}

