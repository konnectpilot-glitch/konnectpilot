import { eq, desc, and, sql, gte } from "drizzle-orm";
import {
  db,
  brandPerformanceMemoryTable,
  brandsTable,
  postMetricsSnapshotsTable,
  postsTable,
  aiInsightsTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

const TOP_EXEMPLARS = 8;
const DISTILL_EVERY_N_NEW = 5;

export async function getPerformanceMemory(brandId: number) {
  const [row] = await db
    .select()
    .from(brandPerformanceMemoryTable)
    .where(eq(brandPerformanceMemoryTable.brandId, brandId));
  return row ?? null;
}

async function ensureMemory(brandId: number) {
  const existing = await getPerformanceMemory(brandId);
  if (existing) return existing;
  const [created] = await db
    .insert(brandPerformanceMemoryTable)
    .values({ brandId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return (await getPerformanceMemory(brandId))!;
}

export function scorePost(metrics: {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
}): number {
  // Simple weighted engagement score normalized by reach.
  const denom = Math.max(metrics.reach || metrics.impressions || 1, 1);
  return (
    (metrics.likes * 1 + metrics.comments * 3 + metrics.shares * 5 + metrics.saves * 4 + metrics.clicks * 2) /
    denom
  );
}

function extractHashtags(text: string): string[] {
  return Array.from(new Set((text.match(/#[\w]+/g) ?? []).map((t) => t.toLowerCase()))).slice(0, 12);
}

function extractHook(text: string): string {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
  return firstLine.slice(0, 120);
}

/**
 * Recompute the brand's performance memory from the latest top-N posts.
 * Cheap to call after each metric pull; expensive distillation runs only
 * every N new high-signal posts.
 */
export async function recomputePerformanceMemory(brandId: number): Promise<void> {
  const memory = await ensureMemory(brandId);

  // Pull the latest snapshot per post (DISTINCT ON post_id ordered by fetched_at desc),
  // for posts in the last 90 days, joined with the post for content + hour.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db.execute<any>(sql`
    SELECT DISTINCT ON (s.post_id)
      s.post_id, s.platform, s.impressions, s.reach, s.likes, s.comments, s.shares, s.clicks, s.saves,
      p.content, p.published_at, p.image_url
    FROM post_metrics_snapshots s
    JOIN posts p ON p.id = s.post_id
    WHERE s.brand_id = ${brandId}
      AND s.fetched_at >= ${since}
      AND p.status = 'published'
    ORDER BY s.post_id, s.fetched_at DESC
  `);

  const records = (rows.rows as any[]).map((r) => ({
    postId: Number(r.post_id),
    platform: String(r.platform),
    impressions: Number(r.impressions),
    reach: Number(r.reach),
    likes: Number(r.likes),
    comments: Number(r.comments),
    shares: Number(r.shares),
    clicks: Number(r.clicks),
    saves: Number(r.saves),
    content: String(r.content ?? ""),
    publishedAt: r.published_at ? new Date(r.published_at) : null,
    imageUrl: r.image_url ? String(r.image_url) : null,
  }));

  if (records.length === 0) return;

  const scored = records.map((r) => ({ ...r, score: scorePost(r) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, TOP_EXEMPLARS);

  // Best hour buckets
  const hoursByPlatform: Record<string, Record<number, number>> = {};
  const typesByPlatform: Record<string, Record<string, number>> = {};
  const hashtagScores: Record<string, number> = {};
  const hooks: string[] = [];

  for (const r of top) {
    if (r.publishedAt) {
      const h = r.publishedAt.getUTCHours();
      hoursByPlatform[r.platform] ??= {};
      hoursByPlatform[r.platform][h] = (hoursByPlatform[r.platform][h] ?? 0) + r.score;
    }
    const type = r.imageUrl ? "image" : "text";
    typesByPlatform[r.platform] ??= {};
    typesByPlatform[r.platform][type] = (typesByPlatform[r.platform][type] ?? 0) + r.score;
    for (const tag of extractHashtags(r.content)) {
      hashtagScores[tag] = (hashtagScores[tag] ?? 0) + r.score;
    }
    const hook = extractHook(r.content);
    if (hook) hooks.push(hook);
  }

  const bestHoursByPlatform: Record<string, number[]> = {};
  for (const [plat, byHour] of Object.entries(hoursByPlatform)) {
    bestHoursByPlatform[plat] = Object.entries(byHour)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => Number(h));
  }
  const bestContentTypesByPlatform: Record<string, string[]> = {};
  for (const [plat, byType] of Object.entries(typesByPlatform)) {
    bestContentTypesByPlatform[plat] = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }
  const winningHashtags = Object.entries(hashtagScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);
  const winningHookTemplates = hooks.slice(0, 6);

  const topExemplars = top.map((r) => ({
    postId: r.postId,
    platform: r.platform,
    content: r.content.slice(0, 400),
    score: Number(r.score.toFixed(4)),
    metrics: {
      impressions: r.impressions,
      reach: r.reach,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
    },
  }));

  const newSamples = records.length;
  const shouldDistill =
    !memory.lastDistilledAt ||
    Math.abs(newSamples - memory.samplesAnalyzed) >= DISTILL_EVERY_N_NEW;

  let distilled = memory.distilledStrategy;
  if (shouldDistill) {
    distilled = await distillStrategy({ topExemplars, bestHoursByPlatform, winningHashtags, winningHookTemplates });
  }

  await db
    .update(brandPerformanceMemoryTable)
    .set({
      topExemplars,
      bestHoursByPlatform,
      bestContentTypesByPlatform,
      winningHashtags,
      winningHookTemplates,
      distilledStrategy: distilled,
      samplesAnalyzed: newSamples,
      lastDistilledAt: shouldDistill ? new Date() : memory.lastDistilledAt,
    })
    .where(eq(brandPerformanceMemoryTable.brandId, brandId));
}

async function distillStrategy(args: {
  topExemplars: Array<{ platform: string; content: string; score: number }>;
  bestHoursByPlatform: Record<string, number[]>;
  winningHashtags: string[];
  winningHookTemplates: string[];
}): Promise<string | null> {
  const exemplars = args.topExemplars
    .slice(0, 6)
    .map((e, i) => `${i + 1}. [${e.platform}, score ${e.score}] ${e.content.slice(0, 240)}`)
    .join("\n");
  const prompt = `You analyze social-media performance data for one brand. Based on these TOP-performing posts and signals, write a SHORT performance playbook (max 8 bullets, max 100 words total) describing what works for this audience: hook style, structure, length, hashtag strategy, posting times, content type. Be concrete and prescriptive.

TOP POSTS:
${exemplars || "(none)"}

BEST POSTING HOURS (UTC) BY PLATFORM:
${JSON.stringify(args.bestHoursByPlatform)}

WINNING HASHTAGS: ${args.winningHashtags.join(" ") || "(none)"}

WINNING HOOK OPENERS:
${args.winningHookTemplates.map((h, i) => `${i + 1}. ${h}`).join("\n") || "(none)"}

Return ONLY the bullet-point playbook.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 350,
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "distillStrategy failed");
    return null;
  }
}

/**
 * Build the prompt-injection snippet for the post generator. Read alongside
 * brand memory in generate.ts / approval.ts.
 */
export async function buildPerformanceMemoryContext(brandId: number): Promise<string> {
  const memory = await getPerformanceMemory(brandId);
  if (!memory) return "";
  const parts: string[] = [];
  if (memory.distilledStrategy) {
    parts.push(`PERFORMANCE PLAYBOOK (distilled from this brand's actual top-performing posts — imitate these patterns):\n${memory.distilledStrategy}`);
  }
  if (memory.winningHashtags.length > 0) {
    parts.push(`HIGH-PERFORMING HASHTAGS: ${memory.winningHashtags.slice(0, 8).join(" ")}`);
  }
  if (memory.winningHookTemplates.length > 0) {
    parts.push(
      `WINNING HOOKS (study the structure, do not copy verbatim):\n` +
        memory.winningHookTemplates.slice(0, 3).map((h, i) => `${i + 1}. ${h}`).join("\n"),
    );
  }
  if (Object.keys(memory.bestHoursByPlatform).length > 0) {
    parts.push(`BEST POSTING HOURS (UTC): ${JSON.stringify(memory.bestHoursByPlatform)}`);
  }
  return parts.length > 0
    ? `\n\n--- PERFORMANCE MEMORY ---\n${parts.join("\n\n")}\n--- END PERFORMANCE MEMORY ---\n`
    : "";
}

/**
 * Generate per-brand actionable AI insights from recent metric data.
 * Stored in ai_insights so the dashboard can show + dismiss + apply.
 */
export async function generateBrandRecommendations(brandId: number): Promise<number> {
  const memory = await getPerformanceMemory(brandId);
  // Recent low performers (last 30 days, bottom 25% by score)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db.execute<any>(sql`
    SELECT DISTINCT ON (s.post_id)
      s.post_id, s.platform, s.reach, s.impressions, s.likes, s.comments, s.shares, s.clicks, s.saves,
      p.content
    FROM post_metrics_snapshots s
    JOIN posts p ON p.id = s.post_id
    WHERE s.brand_id = ${brandId} AND s.fetched_at >= ${since} AND p.status = 'published'
    ORDER BY s.post_id, s.fetched_at DESC
  `);
  const rows = (recent.rows as any[]).map((r) => ({
    postId: Number(r.post_id),
    platform: String(r.platform),
    content: String(r.content ?? ""),
    score: scorePost({
      impressions: Number(r.impressions),
      reach: Number(r.reach),
      likes: Number(r.likes),
      comments: Number(r.comments),
      shares: Number(r.shares),
      clicks: Number(r.clicks),
      saves: Number(r.saves),
    }),
  }));
  if (rows.length === 0) return 0;
  rows.sort((a, b) => a.score - b.score);
  const lowPerformers = rows.slice(0, Math.max(1, Math.ceil(rows.length * 0.25)));

  let inserted = 0;
  for (const lp of lowPerformers.slice(0, 5)) {
    // Skip if we already have an active insight for this post.
    const [existing] = await db
      .select({ id: aiInsightsTable.id })
      .from(aiInsightsTable)
      .where(
        and(
          eq(aiInsightsTable.postId, lp.postId),
          eq(aiInsightsTable.kind, "caption_rewrite"),
          gte(aiInsightsTable.createdAt, since),
        ),
      );
    if (existing) continue;

    const playbook = memory?.distilledStrategy ?? "";
    const prompt = `Rewrite this underperforming ${lp.platform} caption to be more engaging. Use the brand's winning playbook below.

PLAYBOOK:
${playbook || "(no playbook yet)"}

ORIGINAL CAPTION:
"""
${lp.content.slice(0, 800)}
"""

Return ONLY the rewritten caption (no preamble).`;
    try {
      const c = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        max_completion_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      const suggestion = c.choices[0]?.message?.content?.trim() ?? "";
      if (suggestion) {
        await db.insert(aiInsightsTable).values({
          brandId,
          postId: lp.postId,
          kind: "caption_rewrite",
          severity: "suggestion",
          title: `Rewrite a low-performing ${lp.platform} caption`,
          body: `This post scored ${lp.score.toFixed(3)} — well below your average. Suggested rewrite below.`,
          payload: { suggestedContent: suggestion, originalPostId: lp.postId, platform: lp.platform },
        });
        inserted++;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, postId: lp.postId }, "Rewrite suggestion failed");
    }
  }

  // Best-time recommendation
  if (memory && Object.keys(memory.bestHoursByPlatform).length > 0) {
    await db.insert(aiInsightsTable).values({
      brandId,
      kind: "best_time",
      severity: "info",
      title: "Best posting times",
      body: `Your audience engages most at: ${Object.entries(memory.bestHoursByPlatform)
        .map(([p, hs]) => `${p} ${hs.map((h) => `${h}:00`).join(", ")}`)
        .join(" · ")} (UTC).`,
      payload: { bestHoursByPlatform: memory.bestHoursByPlatform },
    });
    inserted++;
  }

  // Hashtag swap recommendation
  if (memory && memory.winningHashtags.length > 0) {
    await db.insert(aiInsightsTable).values({
      brandId,
      kind: "hashtag_swap",
      severity: "suggestion",
      title: "Lean into your top-performing hashtags",
      body: `These hashtags drove the most engagement on recent posts. Reuse them on similar content: ${memory.winningHashtags.slice(0, 8).join(" ")}`,
      payload: { hashtags: memory.winningHashtags.slice(0, 12) },
    });
    inserted++;
  }

  // Content-type / visual style mix recommendation
  if (memory && Object.keys(memory.bestContentTypesByPlatform).length > 0) {
    const lines = Object.entries(memory.bestContentTypesByPlatform)
      .map(([p, types]) => `${p}: ${(types as string[]).slice(0, 3).join(", ")}`)
      .join(" · ");
    await db.insert(aiInsightsTable).values({
      brandId,
      kind: "content_mix",
      severity: "suggestion",
      title: "Shift your content mix toward what works",
      body: `Your highest-engaging content types per platform — favor more of these next week: ${lines}.`,
      payload: { bestContentTypesByPlatform: memory.bestContentTypesByPlatform },
    });
    inserted++;
  }

  // SEO suggestion based on current top topic, surfaced in the dashboard insights loop.
  try {
    const [brandRow] = await db
      .select({ name: brandsTable.name, keywords: brandsTable.keywords })
      .from(brandsTable)
      .where(eq(brandsTable.id, brandId));
    if (brandRow) {
      const topic = String(brandRow.keywords ?? brandRow.name ?? "");
      if (topic) {
        const seoCount = await generateSeoRecommendationsForBlog({ brandId, topic });
        inserted += seoCount;
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, brandId }, "SEO insight refresh failed");
  }

  return inserted;
}

/**
 * SEO recommendations for blog-style content. Persisted as ai_insights.
 */
export async function generateSeoRecommendationsForBlog(args: {
  brandId: number;
  topic: string;
  draft?: string;
}): Promise<number> {
  const prompt = `You are an SEO editor. For the blog topic "${args.topic.slice(0, 200)}" and the draft below, return JSON with these fields: targetKeywords (array of 5 strings), suggestedHeadings (array of 5 strings), readabilityScore (0-100 integer), metaDescription (string, max 160 chars).

DRAFT:
"""
${(args.draft ?? "(no draft yet)").slice(0, 1500)}
"""

Return ONLY a single JSON object, no preamble.`;
  try {
    const c = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = c.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const payload = JSON.parse(cleaned);
    await db.insert(aiInsightsTable).values({
      brandId: args.brandId,
      kind: "seo_blog",
      severity: "suggestion",
      title: `SEO suggestions for "${args.topic.slice(0, 80)}"`,
      body: `Target keywords, headings, readability, and meta description for your blog draft.`,
      payload,
    });
    return 1;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "SEO suggestions failed");
    return 0;
  }
}
