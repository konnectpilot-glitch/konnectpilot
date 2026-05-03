import { and, eq, lte, isNull, sql, desc, gte } from "drizzle-orm";
import {
  db,
  postsTable,
  socialAccountsTable,
  brandsTable,
  postMetricsSnapshotsTable,
  brandDailyAggregatesTable,
  followerHistoryTable,
  metricFetchCursorsTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  fetchFacebookPostInsights,
  fetchFacebookPageFollowers,
  fetchInstagramMediaInsights,
  fetchInstagramFollowers,
  fetchLinkedInShareStats,
  fetchLinkedInOrgFollowers,
  computeEngagementRate,
  fetchJson,
  HttpAuthError,
  type NormalizedMetrics,
} from "./analytics-collectors";
import { ensureFreshAccessToken, forceRefreshAccessToken } from "./oauth-refresh";
import { recomputePerformanceMemory } from "./performance-memory";
import {
  emailReport,
  generateAndStoreReport,
  listActiveBrandsForPeriod,
  previousWeekRange,
} from "./reports";

// Per-platform concurrency caps to respect rate limits.
const CONCURRENCY: Record<string, number> = {
  facebook: 2,
  instagram: 2,
  linkedin: 1,
};
const ANALYTICS_TICK_MS = 60_000;
const FOLLOWER_TICK_MS = 30 * 60_000;
const WEEKLY_REPORT_TICK_MS = 60 * 60_000; // hourly; the tick gates itself by day-of-week
const RAW_RETENTION_DAYS = 90;

let analyticsTimer: NodeJS.Timeout | null = null;
let followerTimer: NodeJS.Timeout | null = null;
let pruneTimer: NodeJS.Timeout | null = null;
let weeklyReportTimer: NodeJS.Timeout | null = null;
// Track the most recent week (periodStart ISO date) for which the weekly report
// run completed inside this process, so the hourly tick is a true no-op for the
// rest of the week even though it keeps firing.
let lastWeeklyReportRun: string | null = null;

// ---------- Cursor schedule (decaying frequency) ----------

function nextCursorTime(publishedAt: Date | null, now: Date, failures: number): { next: Date; completed: Date | null } {
  const base = publishedAt ?? now;
  const ageH = (now.getTime() - base.getTime()) / 36e5;

  // Stop polling 90 days after publication.
  if (ageH > 24 * 90) return { next: new Date(now.getTime() + 30 * 24 * 3600_000), completed: now };

  let intervalMs: number;
  if (ageH < 48) intervalMs = 60 * 60_000; // hourly first 48h
  else if (ageH < 24 * 30) intervalMs = 24 * 60 * 60_000; // daily next 30d
  else intervalMs = 7 * 24 * 60 * 60_000; // weekly thereafter

  // Exponential backoff on failures (cap 6h).
  if (failures > 0) {
    intervalMs = Math.min(intervalMs * Math.pow(2, Math.min(failures, 5)), 6 * 60 * 60_000);
  }
  return { next: new Date(now.getTime() + intervalMs), completed: null };
}

/**
 * Idempotently ensure each published post has a cursor for its platform.
 */
async function ensureCursorsForRecentPosts() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  const PAGE = 500;
  let lastId = 0;
  // Paged scan over all published posts in the 90-day window so every
  // eligible FB/IG/LinkedIn post is enrolled, regardless of workspace size.
  // Bounded at 100 pages (50k posts/tick) as a safety belt.
  for (let page = 0; page < 100; page++) {
    const batch = await db
      .select({
        id: postsTable.id,
        platform: postsTable.platform,
        publishedAt: postsTable.publishedAt,
        platformPostId: postsTable.platformPostId,
      })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.status, "published"),
          gte(postsTable.publishedAt, since),
          sql`${postsTable.id} > ${lastId}`,
        ),
      )
      .orderBy(postsTable.id)
      .limit(PAGE);
    if (batch.length === 0) break;
    for (const p of batch) {
      lastId = Math.max(lastId, p.id);
      if (!p.platformPostId) continue;
      if (!["facebook", "instagram", "linkedin"].includes(p.platform)) continue;
      await db
        .insert(metricFetchCursorsTable)
        .values({ postId: p.id, platform: p.platform, nextFetchAt: new Date() })
        .onConflictDoNothing();
    }
    if (batch.length < PAGE) break;
  }
}

// ---------- Per-post fetch ----------

async function findActiveAccount(workspaceId: number | null | undefined, platform: string) {
  // Match the publisher pattern: pick the most-recently active account on the workspace.
  const where = workspaceId
    ? and(
        eq(socialAccountsTable.platform, platform),
        eq(socialAccountsTable.workspaceId, workspaceId),
        eq(socialAccountsTable.isActive, true),
      )
    : and(eq(socialAccountsTable.platform, platform), eq(socialAccountsTable.isActive, true));
  const [acct] = await db
    .select()
    .from(socialAccountsTable)
    .where(where)
    .orderBy(desc(socialAccountsTable.updatedAt))
    .limit(1);
  return acct ?? null;
}

async function resolveFacebookPageContext(userAccessToken: string): Promise<{ pageId: string; pageAccessToken: string } | null> {
  // Errors (including HttpAuthError) propagate so the scheduler can refresh tokens / back off.
  const data = await fetchJson(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`,
  );
  const page = (data?.data ?? [])[0];
  if (!page) return null;
  return { pageId: page.id, pageAccessToken: page.access_token };
}

async function resolveInstagramContext(userAccessToken: string): Promise<{ igUserId: string; pageAccessToken: string } | null> {
  const data = await fetchJson(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`,
  );
  for (const page of data?.data ?? []) {
    const igData = await fetchJson(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`,
    );
    if (igData?.instagram_business_account?.id) {
      return { igUserId: igData.instagram_business_account.id, pageAccessToken: page.access_token };
    }
  }
  return null;
}

async function fetchMetricsForPost(
  post: { id: number; brandId: number; platform: string; platformPostId: string | null; workspaceId: number | null },
): Promise<NormalizedMetrics | null> {
  if (!post.platformPostId) return null;
  const acct = await findActiveAccount(post.workspaceId, post.platform);
  if (!acct) return null;
  const token = (await ensureFreshAccessToken(acct)) ?? acct.accessToken;

  const tryFetch = async (accessToken: string): Promise<NormalizedMetrics | null> => {
    if (post.platform === "facebook") {
      const ctx = await resolveFacebookPageContext(accessToken);
      if (!ctx) return null;
      return fetchFacebookPostInsights({ pageAccessToken: ctx.pageAccessToken, platformPostId: post.platformPostId! });
    }
    if (post.platform === "instagram") {
      const ctx = await resolveInstagramContext(accessToken);
      if (!ctx) return null;
      return fetchInstagramMediaInsights({ igMediaId: post.platformPostId!, pageAccessToken: ctx.pageAccessToken });
    }
    if (post.platform === "linkedin") {
      return fetchLinkedInShareStats({
        accessToken,
        shareUrn: post.platformPostId!,
        organizationUrn: acct.platformUserId.startsWith("urn:") ? acct.platformUserId : undefined,
      });
    }
    return null;
  };

  try {
    return await tryFetch(token);
  } catch (err) {
    if (err instanceof HttpAuthError) {
      const refreshed = await forceRefreshAccessToken(acct);
      if (refreshed) return tryFetch(refreshed);
    }
    throw err;
  }
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function persistSnapshotAndAggregate(args: {
  postId: number;
  brandId: number;
  platform: string;
  platformPostId: string | null;
  metrics: NormalizedMetrics;
}) {
  const eng = computeEngagementRate(args.metrics);
  await db.insert(postMetricsSnapshotsTable).values({
    postId: args.postId,
    brandId: args.brandId,
    platform: args.platform,
    platformPostId: args.platformPostId,
    impressions: args.metrics.impressions,
    reach: args.metrics.reach,
    likes: args.metrics.likes,
    comments: args.metrics.comments,
    shares: args.metrics.shares,
    clicks: args.metrics.clicks,
    videoViews: args.metrics.videoViews,
    saves: args.metrics.saves,
    engagementRate: eng,
    raw: args.metrics.raw,
  });

  // Recompute the daily aggregate from the latest cumulative snapshot per post
  // for this (brand, platform, day). Platform metrics are cumulative counters,
  // so brand-level totals = SUM(latest-per-post). Using GREATEST or naive
  // increment-on-write would be wrong for multi-post brands.
  const day = dayKey(new Date());
  await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (post_id)
        post_id,
        impressions, reach, likes, comments, shares, clicks
      FROM post_metrics_snapshots
      WHERE brand_id = ${args.brandId}
        AND platform = ${args.platform}
        AND to_char(fetched_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = ${day}
      ORDER BY post_id, fetched_at DESC
    ),
    agg AS (
      SELECT
        COUNT(*)::int AS posts,
        COALESCE(SUM(impressions), 0)::int AS impressions,
        COALESCE(SUM(reach), 0)::int AS reach,
        COALESCE(SUM(likes), 0)::int AS likes,
        COALESCE(SUM(comments), 0)::int AS comments,
        COALESCE(SUM(shares), 0)::int AS shares,
        COALESCE(SUM(clicks), 0)::int AS clicks
      FROM latest
    )
    INSERT INTO brand_daily_aggregates (brand_id, platform, day, posts, impressions, reach, likes, comments, shares, clicks, engagement_rate)
    SELECT
      ${args.brandId}, ${args.platform}, ${day},
      agg.posts, agg.impressions, agg.reach, agg.likes, agg.comments, agg.shares, agg.clicks,
      CASE
        WHEN COALESCE(NULLIF(agg.reach, 0), agg.impressions) > 0
        THEN (agg.likes + agg.comments + agg.shares)::float / COALESCE(NULLIF(agg.reach, 0), agg.impressions)
        ELSE 0
      END
    FROM agg
    ON CONFLICT (brand_id, platform, day) DO UPDATE SET
      posts = EXCLUDED.posts,
      impressions = EXCLUDED.impressions,
      reach = EXCLUDED.reach,
      likes = EXCLUDED.likes,
      comments = EXCLUDED.comments,
      shares = EXCLUDED.shares,
      clicks = EXCLUDED.clicks,
      engagement_rate = EXCLUDED.engagement_rate,
      updated_at = now()
  `);
}

// ---------- Tick loops ----------

async function runAnalyticsTick() {
  try {
    await ensureCursorsForRecentPosts();

    const due = await db
      .select({
        cursor: metricFetchCursorsTable,
        post: postsTable,
      })
      .from(metricFetchCursorsTable)
      .innerJoin(postsTable, eq(postsTable.id, metricFetchCursorsTable.postId))
      .where(
        and(
          isNull(metricFetchCursorsTable.completedAt),
          lte(metricFetchCursorsTable.nextFetchAt, new Date()),
        ),
      )
      .limit(50);

    // Group by platform and respect concurrency.
    const byPlatform: Record<string, typeof due> = {};
    for (const d of due) {
      byPlatform[d.post.platform] ??= [];
      byPlatform[d.post.platform].push(d);
    }
    for (const [platform, items] of Object.entries(byPlatform)) {
      const cap = CONCURRENCY[platform] ?? 1;
      for (let i = 0; i < items.length; i += cap) {
        const slice = items.slice(i, i + cap);
        await Promise.all(slice.map((it) => processOneCursor(it)));
      }
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "Analytics tick failed");
  }
}

async function processOneCursor(it: { cursor: typeof metricFetchCursorsTable.$inferSelect; post: typeof postsTable.$inferSelect }) {
  const now = new Date();
  try {
    const metrics = await fetchMetricsForPost({
      id: it.post.id,
      brandId: it.post.brandId,
      platform: it.post.platform,
      platformPostId: it.post.platformPostId,
      workspaceId: it.post.workspaceId ?? null,
    });
    if (!metrics) {
      const { next } = nextCursorTime(it.post.publishedAt, now, it.cursor.failures + 1);
      await db
        .update(metricFetchCursorsTable)
        .set({ nextFetchAt: next, failures: it.cursor.failures + 1, lastError: "no metrics returned" })
        .where(eq(metricFetchCursorsTable.id, it.cursor.id));
      return;
    }
    await persistSnapshotAndAggregate({
      postId: it.post.id,
      brandId: it.post.brandId,
      platform: it.post.platform,
      platformPostId: it.post.platformPostId,
      metrics,
    });
    const { next, completed } = nextCursorTime(it.post.publishedAt, now, 0);
    await db
      .update(metricFetchCursorsTable)
      .set({ nextFetchAt: next, lastFetchedAt: now, failures: 0, lastError: null, completedAt: completed })
      .where(eq(metricFetchCursorsTable.id, it.cursor.id));

    // Recompute performance memory cheaply (it is itself throttled internally on distillation).
    void recomputePerformanceMemory(it.post.brandId).catch((err) =>
      logger.warn({ err: err?.message }, "recomputePerformanceMemory failed"),
    );
  } catch (err: any) {
    const { next } = nextCursorTime(it.post.publishedAt, now, it.cursor.failures + 1);
    await db
      .update(metricFetchCursorsTable)
      .set({ nextFetchAt: next, failures: it.cursor.failures + 1, lastError: String(err?.message ?? err).slice(0, 500) })
      .where(eq(metricFetchCursorsTable.id, it.cursor.id));
  }
}

// ---------- Follower history ----------

async function runFollowerTick() {
  try {
    const accounts = await db
      .select()
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.isActive, true))
      .limit(200);
    const today = dayKey(new Date());
    for (const acct of accounts) {
      try {
        const token = (await ensureFreshAccessToken(acct)) ?? acct.accessToken;
        let followers = 0;
        if (acct.platform === "facebook") {
          const ctx = await resolveFacebookPageContext(token);
          if (ctx) followers = await fetchFacebookPageFollowers(ctx);
        } else if (acct.platform === "instagram") {
          const ctx = await resolveInstagramContext(token);
          if (ctx) followers = await fetchInstagramFollowers(ctx);
        } else if (acct.platform === "linkedin") {
          const orgUrn = acct.platformUserId.startsWith("urn:") ? acct.platformUserId : `urn:li:organization:${acct.platformUserId}`;
          followers = await fetchLinkedInOrgFollowers({ accessToken: token, organizationUrn: orgUrn });
        }
        if (followers > 0) {
          // Find a brand on the same workspace that uses this platform (best effort).
          const [brand] = acct.workspaceId
            ? await db
                .select({ id: brandsTable.id })
                .from(brandsTable)
                .where(eq(brandsTable.workspaceId, acct.workspaceId))
                .limit(1)
            : [undefined];
          await db
            .insert(followerHistoryTable)
            .values({
              socialAccountId: acct.id,
              brandId: brand?.id ?? null,
              platform: acct.platform,
              day: today,
              followers,
            })
            .onConflictDoUpdate({
              target: [followerHistoryTable.socialAccountId, followerHistoryTable.day],
              set: { followers, fetchedAt: new Date() },
            });
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, accountId: acct.id }, "follower fetch failed");
      }
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "Follower tick failed");
  }
}

// ---------- Weekly report email ----------

/**
 * Build and email the previous week's report for every active workspace,
 * once per week. Idempotent in two ways:
 *  - In-process: gated by `lastWeeklyReportRun` so the hourly tick only does
 *    real work once per ISO week.
 *  - Cross-process / restart safe: the report row is upserted on
 *    (brandId, period, periodStart) and the email send is gated by
 *    `last_emailed_at` on that row.
 */
async function runWeeklyReportTick(now: Date = new Date()) {
  // Run Monday–Wednesday UTC: Monday is the canonical send day, Tue/Wed
  // provide a backfill window so a multi-hour outage doesn't drop a week.
  // The per-row last_emailed_at claim still prevents duplicate sends if the
  // Monday run partially succeeded.
  const dow = now.getUTCDay();
  if (dow < 1 || dow > 3) return;
  const { periodStart, periodEnd } = previousWeekRange(now);
  const weekKey = periodStart.toISOString().slice(0, 10);
  if (lastWeeklyReportRun === weekKey) return;

  try {
    const brands = await listActiveBrandsForPeriod({ periodStart, periodEnd });
    logger.info({ brandCount: brands.length, weekKey }, "Weekly report tick starting");
    let sent = 0;
    let alreadyEmailed = 0;
    let skippedTerminal = 0; // no recipients / no mailer configured — won't fix on retry
    let transientFailures = 0; // mailer rejection or thrown error — should retry
    // Reasons returned by emailReport that we should not retry within the
    // weekly window (re-running won't change the outcome until config changes).
    const TERMINAL_REASONS = new Set([
      "already emailed",
      "no recipients",
      "SENDGRID_API_KEY not configured",
    ]);
    for (const b of brands) {
      try {
        const { id: reportId, html } = await generateAndStoreReport({
          brand: { id: b.brandId, name: b.name },
          period: "weekly",
          periodStart,
          periodEnd,
          emailOptIn: true,
        });
        const result = await emailReport({
          reportId,
          brandId: b.brandId,
          workspaceId: b.workspaceId,
          subject: `${b.name} — weekly performance report`,
          html,
        });
        if (result.sent) {
          sent++;
        } else if (result.reason && TERMINAL_REASONS.has(result.reason)) {
          if (result.reason === "already emailed") alreadyEmailed++;
          else skippedTerminal++;
        } else {
          // Anything else (e.g. "sendgrid status 5xx", network error string) is
          // treated as transient and will be retried on the next hourly tick.
          transientFailures++;
        }
        logger.info(
          {
            brandId: b.brandId,
            workspaceId: b.workspaceId,
            sent: result.sent,
            recipients: result.recipients.length,
            reason: result.reason,
          },
          "weekly report processed",
        );
      } catch (err: any) {
        transientFailures++;
        logger.warn({ err: err?.message, brandId: b.brandId }, "weekly report failed for brand");
      }
    }
    logger.info(
      { weekKey, brandCount: brands.length, sent, alreadyEmailed, skippedTerminal, transientFailures },
      "Weekly report tick finished",
    );
    // Suppress in-process retries only when no brand had a retryable failure.
    // Terminal skips (no recipients / mailer unconfigured) and successful sends
    // are both fine; transient failures (network/mailer 5xx, exceptions) leave
    // the gate open so the next hourly tick within the Mon–Wed window retries.
    // Cross-process duplicate sends remain prevented by the per-row
    // `last_emailed_at` claim in `emailReport`.
    if (transientFailures === 0) {
      lastWeeklyReportRun = weekKey;
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "Weekly report tick failed");
  }
}

// ---------- Retention ----------

async function pruneOldSnapshots() {
  try {
    const cutoff = new Date(Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60_000);
    await db.delete(postMetricsSnapshotsTable).where(lte(postMetricsSnapshotsTable.fetchedAt, cutoff));
  } catch (err: any) {
    logger.warn({ err: err?.message }, "pruneOldSnapshots failed");
  }
}

export function startAnalyticsScheduler() {
  if (analyticsTimer || followerTimer) return;
  logger.info("Analytics scheduler starting");
  analyticsTimer = setInterval(() => void runAnalyticsTick(), ANALYTICS_TICK_MS);
  followerTimer = setInterval(() => void runFollowerTick(), FOLLOWER_TICK_MS);
  pruneTimer = setInterval(() => void pruneOldSnapshots(), 24 * 60 * 60_000);
  weeklyReportTimer = setInterval(() => void runWeeklyReportTick(), WEEKLY_REPORT_TICK_MS);
  // Run once shortly after boot.
  setTimeout(() => void runAnalyticsTick(), 10_000);
  setTimeout(() => void runFollowerTick(), 30_000);
  setTimeout(() => void runWeeklyReportTick(), 60_000);
}

export function stopAnalyticsScheduler() {
  if (analyticsTimer) clearInterval(analyticsTimer);
  if (followerTimer) clearInterval(followerTimer);
  if (pruneTimer) clearInterval(pruneTimer);
  if (weeklyReportTimer) clearInterval(weeklyReportTimer);
  analyticsTimer = followerTimer = pruneTimer = weeklyReportTimer = null;
}

// Exposed for tests / manual triggers.
export const _internal = { runAnalyticsTick, runFollowerTick, pruneOldSnapshots, runWeeklyReportTick };
