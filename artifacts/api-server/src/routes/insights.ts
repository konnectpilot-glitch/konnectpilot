import { Router, type IRouter } from "express";
import { eq, and, isNull, desc, inArray, gte } from "drizzle-orm";
import {
  db,
  brandsTable,
  aiInsightsTable,
  brandPerformanceMemoryTable,
  brandDailyAggregatesTable,
} from "@workspace/db";
import { requireAuth, requireWorkspace } from "./users";
import { generateClaudeText } from "../lib/ai-providers";
import { logger } from "../lib/logger";

// AI Insights inbox
// ─────────────────
// The schema (lib/db/schema/analytics.ts → aiInsightsTable) was already
// designed for this — kind / severity / title / body / dismissedAt /
// appliedAt. This endpoint:
//   1. Returns the workspace's active (non-dismissed) insights
//   2. If none exist AND the workspace has enough analytics data, runs a
//      one-shot generator that produces 1-3 concrete insights from the
//      brand_performance_memory + brand_daily_aggregates tables
//   3. Dismiss endpoint marks an insight resolved (soft-delete)
//
// Lazy-generated on-read so we never burn Claude credits on workspaces
// nobody is looking at. Cached server-side per workspace per day.

const router: IRouter = Router();

const MIN_SAMPLES_TO_GENERATE = 5;
const GEN_CACHE_HOURS = 24;
const lastGenAt = new Map<number, number>(); // workspaceId → ms

interface InsightRow {
  id: number;
  brandId: number;
  brandName?: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

async function maybeGenerate(workspaceId: number): Promise<void> {
  const lastAt = lastGenAt.get(workspaceId) ?? 0;
  if (Date.now() - lastAt < GEN_CACHE_HOURS * 60 * 60 * 1000) return;
  // Soft "in-flight" lock — prevents concurrent requests from both starting
  // a generation. Real success-time set after the loop completes; failure
  // path resets so we don't get a 24h dead zone after a transient error.
  const startedAt = Date.now();
  lastGenAt.set(workspaceId, startedAt);
  let generatedAny = false;

  const brands = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, workspaceId));
  if (brands.length === 0) {
    // Empty workspace — keep the lock so we don't poll Claude pointlessly.
    return;
  }

  for (const brand of brands) {
    try {
      // Pull what we know about this brand's performance.
      const [perf] = await db
        .select()
        .from(brandPerformanceMemoryTable)
        .where(eq(brandPerformanceMemoryTable.brandId, brand.id));
      const samples = perf?.samplesAnalyzed ?? 0;
      if (samples < MIN_SAMPLES_TO_GENERATE) continue;

      // Pull last 30 days of daily aggregates for context.
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const agg = await db
        .select()
        .from(brandDailyAggregatesTable)
        .where(
          and(
            eq(brandDailyAggregatesTable.brandId, brand.id),
            gte(brandDailyAggregatesTable.updatedAt, thirtyDaysAgo),
          ),
        );
      if (agg.length === 0) continue;

      const aggSummary = agg
        .slice(0, 30)
        .map((a) => `${a.day} ${a.platform}: ${a.posts}p ${a.likes}l ${a.comments}c ${a.shares}s er=${a.engagementRate.toFixed(2)}`)
        .join("\n");
      const bestHours = perf?.bestHoursByPlatform ? JSON.stringify(perf.bestHoursByPlatform) : "{}";
      const winningHashtags = (perf?.winningHashtags ?? []).slice(0, 10).join(", ") || "(none yet)";
      const distilled = perf?.distilledStrategy ?? "";

      const prompt = `You are a data-driven social media strategist looking at one brand's last-30-day analytics. Produce 1-3 SPECIFIC, ACTIONABLE insights the operator can act on this week.

BRAND: ${brand.name} (${brand.industry}) — ${brand.targetAudience}

LAST-30-DAY DAILY AGGREGATES (day platform: posts likes comments shares engagementRate):
${aggSummary || "(no data)"}

BEST HOURS OBSERVED PER PLATFORM (from past top-performers):
${bestHours}

WINNING HASHTAGS:
${winningHashtags}

EXISTING DISTILLED STRATEGY (don't restate, build on it):
${distilled || "(none)"}

Each insight must:
- Reference a SPECIFIC observation from the data above (a day, hour, number, hashtag, etc.)
- Be ACTIONABLE in this week's content (e.g. "post Tuesdays at 10am", "test more carousels", "drop #motivation, lean into #DTCfounder")
- Be concise: title max 8 words, body 1-2 sentences max 35 words
- NOT be vague ("engage more with your audience" is forbidden)

Return ONLY a JSON array (1-3 items, no prose around it):
[
  {
    "kind": "best_time" | "hashtag_swap" | "content_mix" | "caption_rewrite" | "general",
    "severity": "info" | "suggestion" | "critical",
    "title": "<8 words max>",
    "body": "<1-2 sentences max 35 words, with specific numbers/days/hashtags>"
  }
]`;

      const { content } = await generateClaudeText(prompt, { maxTokens: 600 });
      let raw = content.trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed.slice(0, 3)) {
        if (!item?.title || !item?.body) continue;
        await db
          .insert(aiInsightsTable)
          .values({
            brandId: brand.id,
            kind: String(item.kind ?? "general"),
            severity: String(item.severity ?? "info"),
            title: String(item.title).slice(0, 200),
            body: String(item.body).slice(0, 500),
            payload: item.payload ?? null,
          })
          .onConflictDoNothing();
        generatedAny = true;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, brandId: brand.id }, "Insight gen failed for brand");
    }
  }

  // If we generated nothing (every brand failed), reset the lock so a
  // retry happens on the next request instead of waiting 24h.
  if (!generatedAny) {
    lastGenAt.delete(workspaceId);
  }
}

router.get("/insights", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  // Try to generate fresh insights (no-op if recently run for this workspace).
  // Doesn't block: if Claude is slow, we still return whatever's already in DB.
  void maybeGenerate(req.workspaceId);

  const brands = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));
  const brandIds = brands.map((b) => b.id);
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));

  if (brandIds.length === 0) {
    res.json({ insights: [] });
    return;
  }

  const rows = await db
    .select()
    .from(aiInsightsTable)
    .where(and(inArray(aiInsightsTable.brandId, brandIds), isNull(aiInsightsTable.dismissedAt)))
    .orderBy(desc(aiInsightsTable.createdAt))
    .limit(8);

  const insights: InsightRow[] = rows.map((r) => ({
    id: r.id,
    brandId: r.brandId,
    brandName: brandMap.get(r.brandId),
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    body: r.body,
    payload: r.payload,
    createdAt: r.createdAt,
  }));

  res.json({ insights });
});

router.post("/insights/:id/dismiss", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid insight id" });
    return;
  }
  // Confirm the insight belongs to a brand in the current workspace before
  // updating — otherwise users could dismiss other tenants' insights.
  const [row] = await db
    .select({ brandId: aiInsightsTable.brandId, workspaceId: brandsTable.workspaceId })
    .from(aiInsightsTable)
    .innerJoin(brandsTable, eq(brandsTable.id, aiInsightsTable.brandId))
    .where(eq(aiInsightsTable.id, id));
  if (!row || row.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }
  await db
    .update(aiInsightsTable)
    .set({ dismissedAt: new Date() })
    .where(eq(aiInsightsTable.id, id));
  res.json({ dismissed: true });
});

export default router;
