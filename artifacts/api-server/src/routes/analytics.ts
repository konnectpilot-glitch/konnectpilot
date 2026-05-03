import { Router, type IRouter } from "express";
import { and, eq, gte, desc, sql, isNull, inArray } from "drizzle-orm";
import {
  db,
  brandsTable,
  postsTable,
  postingSchedulesTable,
  postMetricsSnapshotsTable,
  brandDailyAggregatesTable,
  followerHistoryTable,
  brandPerformanceMemoryTable,
  aiInsightsTable,
  analyticsReportsTable,
} from "@workspace/db";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import {
  recomputePerformanceMemory,
  generateBrandRecommendations,
  generateSeoRecommendationsForBlog,
  getPerformanceMemory,
  scorePost,
} from "../lib/performance-memory";
import { logger } from "../lib/logger";
import { emailReport, generateAndStoreReport, type ReportPeriod } from "../lib/reports";

const router: IRouter = Router();

async function loadBrandInWorkspace(brandId: number, workspaceId: number) {
  const [b] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, workspaceId)));
  return b ?? null;
}

function rangeDays(range: string | undefined): number {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

// ---------- Brand-level metrics summary ----------
router.get("/analytics/brands/:id/summary", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const range = rangeDays(req.query.range as string | undefined);
  const platform = (req.query.platform as string) || null;
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const since = new Date(Date.now() - range * 24 * 60 * 60_000);
  const prevSince = new Date(Date.now() - 2 * range * 24 * 60 * 60_000);

  const cur = await db.execute<any>(sql`
    SELECT
      COALESCE(SUM(impressions),0)::int AS impressions,
      COALESCE(SUM(reach),0)::int AS reach,
      COALESCE(SUM(likes),0)::int AS likes,
      COALESCE(SUM(comments),0)::int AS comments,
      COALESCE(SUM(shares),0)::int AS shares,
      COALESCE(SUM(clicks),0)::int AS clicks,
      COALESCE(AVG(engagement_rate),0)::float AS engagement_rate
    FROM brand_daily_aggregates
    WHERE brand_id = ${id} AND day >= ${since.toISOString().slice(0, 10)}
      ${platform ? sql`AND platform = ${platform}` : sql``}
  `);
  const prev = await db.execute<any>(sql`
    SELECT
      COALESCE(SUM(impressions),0)::int AS impressions,
      COALESCE(SUM(reach),0)::int AS reach,
      COALESCE(SUM(likes),0)::int AS likes,
      COALESCE(SUM(clicks),0)::int AS clicks,
      COALESCE(AVG(engagement_rate),0)::float AS engagement_rate
    FROM brand_daily_aggregates
    WHERE brand_id = ${id}
      AND day >= ${prevSince.toISOString().slice(0, 10)}
      AND day < ${since.toISOString().slice(0, 10)}
      ${platform ? sql`AND platform = ${platform}` : sql``}
  `);

  // Follower delta from history
  const fol = await db.execute<any>(sql`
    SELECT MIN(followers) AS min_f, MAX(followers) AS max_f,
      (SELECT followers FROM follower_history WHERE brand_id = ${id} ${platform ? sql`AND platform = ${platform}` : sql``} ORDER BY day DESC LIMIT 1) AS latest
    FROM follower_history
    WHERE brand_id = ${id} AND day >= ${since.toISOString().slice(0, 10)}
      ${platform ? sql`AND platform = ${platform}` : sql``}
  `);

  const c = cur.rows[0] ?? {};
  const p = prev.rows[0] ?? {};
  const f = fol.rows[0] ?? {};

  const curImpressions = Number(c.impressions ?? 0);
  const curClicks = Number(c.clicks ?? 0);
  const prevImpressions = Number(p.impressions ?? 0);
  const prevClicks = Number(p.clicks ?? 0);
  const ctr = curImpressions > 0 ? curClicks / curImpressions : 0;
  const prevCtr = prevImpressions > 0 ? prevClicks / prevImpressions : 0;

  res.json({
    brandId: id,
    range,
    platform,
    impressions: curImpressions,
    reach: Number(c.reach ?? 0),
    likes: Number(c.likes ?? 0),
    comments: Number(c.comments ?? 0),
    shares: Number(c.shares ?? 0),
    clicks: curClicks,
    engagementRate: Number(c.engagement_rate ?? 0),
    ctr,
    prev: {
      impressions: prevImpressions,
      reach: Number(p.reach ?? 0),
      likes: Number(p.likes ?? 0),
      engagementRate: Number(p.engagement_rate ?? 0),
      ctr: prevCtr,
    },
    followers: {
      latest: Number(f.latest ?? 0),
      min: Number(f.min_f ?? 0),
      max: Number(f.max_f ?? 0),
      delta: Number(f.latest ?? 0) - Number(f.min_f ?? 0),
    },
  });
});

// ---------- Time series ----------
router.get("/analytics/brands/:id/timeseries", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const range = rangeDays(req.query.range as string | undefined);
  const platform = (req.query.platform as string) || null;
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const since = new Date(Date.now() - range * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const rows = await db.execute<any>(sql`
    SELECT day,
      SUM(impressions)::int AS impressions,
      SUM(reach)::int AS reach,
      SUM(likes)::int AS likes,
      SUM(comments)::int AS comments,
      SUM(shares)::int AS shares,
      AVG(engagement_rate)::float AS engagement_rate
    FROM brand_daily_aggregates
    WHERE brand_id = ${id} AND day >= ${since}
      ${platform ? sql`AND platform = ${platform}` : sql``}
    GROUP BY day
    ORDER BY day ASC
  `);
  const followers = await db.execute<any>(sql`
    SELECT day, MAX(followers)::int AS followers
    FROM follower_history
    WHERE brand_id = ${id} AND day >= ${since}
      ${platform ? sql`AND platform = ${platform}` : sql``}
    GROUP BY day
    ORDER BY day ASC
  `);
  res.json({
    range,
    platform,
    points: rows.rows.map((r: any) => ({
      day: r.day,
      impressions: Number(r.impressions ?? 0),
      reach: Number(r.reach ?? 0),
      likes: Number(r.likes ?? 0),
      comments: Number(r.comments ?? 0),
      shares: Number(r.shares ?? 0),
      engagementRate: Number(r.engagement_rate ?? 0),
    })),
    followers: followers.rows.map((r: any) => ({ day: r.day, followers: Number(r.followers ?? 0) })),
  });
});

// ---------- Top posts ----------
router.get("/analytics/brands/:id/top-posts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const range = rangeDays(req.query.range as string | undefined);
  const platform = (req.query.platform as string) || null;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const since = new Date(Date.now() - range * 24 * 60 * 60_000);
  const rows = await db.execute<any>(sql`
    SELECT DISTINCT ON (s.post_id)
      s.post_id, s.platform, s.impressions, s.reach, s.likes, s.comments, s.shares, s.clicks, s.saves, s.engagement_rate,
      p.content, p.image_url, p.published_at
    FROM post_metrics_snapshots s
    JOIN posts p ON p.id = s.post_id
    WHERE s.brand_id = ${id}
      AND s.fetched_at >= ${since}
      ${platform ? sql`AND s.platform = ${platform}` : sql``}
    ORDER BY s.post_id, s.fetched_at DESC
  `);
  const items = rows.rows.map((r: any) => {
    const m = {
      impressions: Number(r.impressions),
      reach: Number(r.reach),
      likes: Number(r.likes),
      comments: Number(r.comments),
      shares: Number(r.shares),
      clicks: Number(r.clicks),
      saves: Number(r.saves),
    };
    return {
      postId: Number(r.post_id),
      platform: String(r.platform),
      content: String(r.content ?? ""),
      imageUrl: r.image_url ? String(r.image_url) : null,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      score: scorePost(m),
      ...m,
      engagementRate: Number(r.engagement_rate ?? 0),
    };
  });
  items.sort((a: any, b: any) => b.score - a.score);
  res.json(items.slice(0, limit));
});

// ---------- Compare two posts ----------
router.get("/analytics/posts/compare", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (!Number.isInteger(a) || !Number.isInteger(b)) { res.status(400).json({ error: "Need a and b post ids" }); return; }
  const posts = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.workspaceId, req.workspaceId), inArray(postsTable.id, [a, b])));
  if (posts.length !== 2) { res.status(404).json({ error: "Posts not found" }); return; }

  async function latest(postId: number) {
    const [snap] = await db
      .select()
      .from(postMetricsSnapshotsTable)
      .where(eq(postMetricsSnapshotsTable.postId, postId))
      .orderBy(desc(postMetricsSnapshotsTable.fetchedAt))
      .limit(1);
    return snap ?? null;
  }
  const [snapA, snapB] = await Promise.all([latest(a), latest(b)]);
  res.json({
    a: { post: posts.find((p) => p.id === a), metrics: snapA },
    b: { post: posts.find((p) => p.id === b), metrics: snapB },
  });
});

// ---------- Best time / content type recommendations (per platform) ----------
router.get("/analytics/brands/:id/recommendations", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const memory = await getPerformanceMemory(id);
  res.json({
    bestHoursByPlatform: memory?.bestHoursByPlatform ?? {},
    bestContentTypesByPlatform: memory?.bestContentTypesByPlatform ?? {},
    winningHashtags: memory?.winningHashtags ?? [],
    winningHookTemplates: memory?.winningHookTemplates ?? [],
  });
});

// ---------- AI insights list / refresh / dismiss / apply ----------
router.get("/analytics/brands/:id/insights", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const rows = await db
    .select()
    .from(aiInsightsTable)
    .where(and(eq(aiInsightsTable.brandId, id), isNull(aiInsightsTable.dismissedAt)))
    .orderBy(desc(aiInsightsTable.createdAt))
    .limit(50);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), dismissedAt: null, appliedAt: r.appliedAt?.toISOString() ?? null })));
});

router.post("/analytics/brands/:id/insights/refresh", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) { res.status(403).json({ error: "Editor role required" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  await recomputePerformanceMemory(id);
  const created = await generateBrandRecommendations(id);
  res.json({ created });
});

router.post("/analytics/insights/:id/dismiss", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Verify workspace ownership via brand join
  const [row] = await db
    .select({ id: aiInsightsTable.id })
    .from(aiInsightsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, aiInsightsTable.brandId))
    .where(and(eq(aiInsightsTable.id, id), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(aiInsightsTable).set({ dismissedAt: new Date() }).where(eq(aiInsightsTable.id, id));
  res.json({ ok: true });
});

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function hoursToTimes(hours: number[]): string[] {
  return uniq(
    hours
      .filter((h) => Number.isFinite(h) && h >= 0 && h < 24)
      .map((h) => `${String(Math.floor(h)).padStart(2, "0")}:00`),
  ).sort();
}

router.post("/analytics/insights/:id/apply", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) { res.status(403).json({ error: "Editor role required" }); return; }
  const [row] = await db
    .select({ insight: aiInsightsTable, brand: brandsTable })
    .from(aiInsightsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, aiInsightsTable.brandId))
    .where(and(eq(aiInsightsTable.id, id), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.insight.appliedAt) { res.status(409).json({ error: "Already applied" }); return; }

  const insight = row.insight;
  const brand = row.brand;
  const payload = (insight.payload ?? {}) as Record<string, unknown>;
  let undoSnapshot: Record<string, unknown> | null = null;
  let applied: { kind: string; summary: string } = { kind: insight.kind, summary: "Marked as applied" };

  try {
    if (insight.kind === "best_time") {
      const byPlatform = (payload.bestHoursByPlatform ?? {}) as Record<string, number[]>;
      const allHours: number[] = [];
      for (const hs of Object.values(byPlatform)) if (Array.isArray(hs)) allHours.push(...hs.map((h) => Number(h)));
      const newTimes = hoursToTimes(allHours);
      if (newTimes.length === 0) { res.status(400).json({ error: "No best hours in payload" }); return; }
      const schedules = await db
        .select()
        .from(postingSchedulesTable)
        .where(and(eq(postingSchedulesTable.brandId, brand.id), eq(postingSchedulesTable.isActive, true)));
      undoSnapshot = {
        brand: { id: brand.id, postTime: brand.postTime },
        schedules: schedules.map((s) => ({ id: s.id, postTimes: s.postTimes })),
      };
      for (const s of schedules) {
        await db.update(postingSchedulesTable).set({ postTimes: newTimes }).where(eq(postingSchedulesTable.id, s.id));
      }
      await db.update(brandsTable).set({ postTime: newTimes[0] }).where(eq(brandsTable.id, brand.id));
      applied = {
        kind: insight.kind,
        summary: `Updated ${schedules.length} schedule(s) to post at ${newTimes.join(", ")} (UTC).`,
      };
    } else if (insight.kind === "hashtag_swap") {
      const tags = Array.isArray(payload.hashtags) ? (payload.hashtags as unknown[]).map(String) : [];
      const cleaned = uniq(tags.map((t) => t.trim()).filter(Boolean));
      if (cleaned.length === 0) { res.status(400).json({ error: "No hashtags in payload" }); return; }
      undoSnapshot = { brand: { id: brand.id, keywords: brand.keywords } };
      const existing = uniq(
        String(brand.keywords ?? "")
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      const merged = uniq([...existing, ...cleaned]);
      await db.update(brandsTable).set({ keywords: merged.join(", ") }).where(eq(brandsTable.id, brand.id));
      applied = { kind: insight.kind, summary: `Added ${cleaned.length} hashtag(s) to brand keywords.` };
    } else if (insight.kind === "caption_rewrite") {
      const suggested = typeof payload.suggestedContent === "string" ? payload.suggestedContent : "";
      const originalPostId = Number(payload.originalPostId ?? insight.postId ?? 0);
      if (!suggested || !Number.isInteger(originalPostId) || originalPostId <= 0) {
        res.status(400).json({ error: "Missing suggested content or post id" }); return;
      }
      const [target] = await db
        .select()
        .from(postsTable)
        .where(and(eq(postsTable.id, originalPostId), eq(postsTable.workspaceId, req.workspaceId)));
      if (!target) { res.status(404).json({ error: "Target post not found" }); return; }
      if (target.status === "published") { res.status(409).json({ error: "Cannot edit a published post" }); return; }
      undoSnapshot = { post: { id: target.id, content: target.content } };
      await db.update(postsTable).set({ content: suggested }).where(eq(postsTable.id, target.id));
      applied = { kind: insight.kind, summary: `Updated caption on post #${target.id}.` };
    } else if (insight.kind === "content_mix") {
      const byPlatform = (payload.bestContentTypesByPlatform ?? {}) as Record<string, string[]>;
      const lines = Object.entries(byPlatform)
        .map(([p, types]) => `- ${p}: prefer ${(types as string[]).slice(0, 3).join(", ")}`)
        .join("\n");
      if (!lines) { res.status(400).json({ error: "No content types in payload" }); return; }
      const guidance = `\n\n[Performance hint] Favor these content types:\n${lines}`;
      const schedules = await db
        .select()
        .from(postingSchedulesTable)
        .where(and(eq(postingSchedulesTable.brandId, brand.id), eq(postingSchedulesTable.isActive, true)));
      undoSnapshot = {
        schedules: schedules.map((s) => ({ id: s.id, contentPrompt: s.contentPrompt })),
      };
      for (const s of schedules) {
        const prev = s.contentPrompt ?? "";
        if (!prev.includes("[Performance hint]")) {
          await db
            .update(postingSchedulesTable)
            .set({ contentPrompt: prev + guidance })
            .where(eq(postingSchedulesTable.id, s.id));
        }
      }
      applied = { kind: insight.kind, summary: `Added content-mix guidance to ${schedules.length} schedule(s).` };
    } else if (insight.kind === "seo_blog") {
      const targetKeywords = Array.isArray(payload.targetKeywords)
        ? (payload.targetKeywords as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
        : [];
      if (targetKeywords.length === 0) { res.status(400).json({ error: "No target keywords in payload" }); return; }
      undoSnapshot = { brand: { id: brand.id, keywords: brand.keywords } };
      const existing = uniq(
        String(brand.keywords ?? "")
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      const merged = uniq([...existing, ...targetKeywords]);
      await db.update(brandsTable).set({ keywords: merged.join(", ") }).where(eq(brandsTable.id, brand.id));
      applied = { kind: insight.kind, summary: `Added ${targetKeywords.length} SEO keyword(s) to brand.` };
    } else {
      res.status(400).json({ error: `Insight kind "${insight.kind}" is not applicable` }); return;
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, insightId: id }, "Apply insight failed");
    res.status(500).json({ error: "Failed to apply insight" }); return;
  }

  await db
    .update(aiInsightsTable)
    .set({ appliedAt: new Date(), undoPayload: undoSnapshot ?? undefined })
    .where(eq(aiInsightsTable.id, id));

  res.json({
    ok: true,
    payload: insight.payload ?? null,
    applied,
    canUndo: undoSnapshot !== null,
    undoExpiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
  });
});

router.post("/analytics/insights/:id/undo", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) { res.status(403).json({ error: "Editor role required" }); return; }
  const [row] = await db
    .select({ insight: aiInsightsTable })
    .from(aiInsightsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, aiInsightsTable.brandId))
    .where(and(eq(aiInsightsTable.id, id), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const insight = row.insight;
  if (!insight.appliedAt) { res.status(409).json({ error: "Insight is not applied" }); return; }
  if (Date.now() - insight.appliedAt.getTime() > UNDO_WINDOW_MS) {
    res.status(410).json({ error: "Undo window has expired" }); return;
  }
  const snap: unknown = insight.undoPayload ?? null;
  if (!snap || typeof snap !== "object") {
    await db.update(aiInsightsTable).set({ appliedAt: null }).where(eq(aiInsightsTable.id, id));
    res.json({ ok: true, restored: false });
    return;
  }
  const snapObj = snap as Record<string, unknown>;

  function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  }
  function asStringArray(v: unknown): string[] | null {
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
  }

  try {
    const brandSnap = asRecord(snapObj.brand);
    if (brandSnap) {
      const patch: { postTime?: string; keywords?: string } = {};
      if (typeof brandSnap.postTime === "string") patch.postTime = brandSnap.postTime;
      if (typeof brandSnap.keywords === "string") patch.keywords = brandSnap.keywords;
      if (Object.keys(patch).length > 0 && typeof brandSnap.id === "number") {
        await db.update(brandsTable).set(patch).where(eq(brandsTable.id, brandSnap.id));
      }
    }
    if (Array.isArray(snapObj.schedules)) {
      for (const item of snapObj.schedules) {
        const s = asRecord(item);
        if (!s || typeof s.id !== "number") continue;
        const patch: { postTimes?: string[]; contentPrompt?: string | null } = {};
        const times = asStringArray(s.postTimes);
        if (times) patch.postTimes = times;
        if ("contentPrompt" in s) {
          const cp = s.contentPrompt;
          if (cp === null || typeof cp === "string") patch.contentPrompt = cp;
        }
        if (Object.keys(patch).length > 0) {
          await db.update(postingSchedulesTable).set(patch).where(eq(postingSchedulesTable.id, s.id));
        }
      }
    }
    const postSnap = asRecord(snapObj.post);
    if (postSnap && typeof postSnap.id === "number" && typeof postSnap.content === "string") {
      await db.update(postsTable).set({ content: postSnap.content }).where(eq(postsTable.id, postSnap.id));
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, insightId: id }, "Undo insight failed");
    res.status(500).json({ error: "Failed to undo insight" }); return;
  }

  await db
    .update(aiInsightsTable)
    .set({ appliedAt: null, undoPayload: null })
    .where(eq(aiInsightsTable.id, id));
  res.json({ ok: true, restored: true });
});

// ---------- Performance memory ----------
router.get("/analytics/brands/:id/performance-memory", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const memory = await getPerformanceMemory(id);
  if (!memory) {
    res.json({
      brandId: id,
      topExemplars: [],
      bestHoursByPlatform: {},
      bestContentTypesByPlatform: {},
      winningHashtags: [],
      winningHookTemplates: [],
      distilledStrategy: null,
      samplesAnalyzed: 0,
      lastDistilledAt: null,
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  res.json({
    brandId: id,
    topExemplars: memory.topExemplars,
    bestHoursByPlatform: memory.bestHoursByPlatform,
    bestContentTypesByPlatform: memory.bestContentTypesByPlatform,
    winningHashtags: memory.winningHashtags,
    winningHookTemplates: memory.winningHookTemplates,
    distilledStrategy: memory.distilledStrategy,
    samplesAnalyzed: memory.samplesAnalyzed,
    lastDistilledAt: memory.lastDistilledAt?.toISOString() ?? null,
    updatedAt: memory.updatedAt.toISOString(),
  });
});

// ---------- Reports ----------
router.post("/analytics/brands/:id/reports", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const period = (req.body?.period as string) ?? "weekly";
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!["weekly", "monthly"].includes(period)) { res.status(400).json({ error: "period must be weekly or monthly" }); return; }
  if (!hasRoleAtLeast(req.workspaceRole, "viewer")) { res.status(403).json({ error: "No access" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const days = period === "weekly" ? 7 : 30;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60_000);

  const { id: rowId, summary, html, createdAt } = await generateAndStoreReport({
    brand: { id: brand.id, name: brand.name },
    period: period as ReportPeriod,
    periodStart,
    periodEnd,
    emailOptIn: Boolean(req.body?.emailOptIn ?? false),
  });

  // Optional immediate send when requested. Restricted to editor+ to prevent
  // low-privilege viewers from triggering owner/admin emails repeatedly.
  if (req.body?.sendEmail) {
    if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
      res.status(403).json({ error: "Editor role required to send report email" });
      return;
    }
    await emailReport({
      reportId: rowId,
      brandId: brand.id,
      workspaceId: req.workspaceId,
      subject: `${brand.name} — ${period} performance report`,
      html,
    });
  }

  res.status(201).json({
    id: rowId,
    brandId: id,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    html,
    summary,
    createdAt: createdAt.toISOString(),
  });
});

router.get("/analytics/brands/:id/reports", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const rows = await db
    .select()
    .from(analyticsReportsTable)
    .where(eq(analyticsReportsTable.brandId, id))
    .orderBy(desc(analyticsReportsTable.createdAt))
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    brandId: r.brandId,
    period: r.period,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
  })));
});

// ---------- SEO insights for blog content ----------
router.post("/analytics/brands/:id/seo", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) { res.status(403).json({ error: "Editor role required" }); return; }
  const brand = await loadBrandInWorkspace(id, req.workspaceId);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const topic = String(req.body?.topic ?? brand.keywords ?? brand.name);
  const draft = req.body?.draft ? String(req.body.draft) : undefined;
  const created = await generateSeoRecommendationsForBlog({ brandId: id, topic, draft });
  res.json({ created });
});

export default router;
