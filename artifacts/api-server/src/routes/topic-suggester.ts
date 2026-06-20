import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, brandsTable, postsTable } from "@workspace/db";
import { requireAuth, requireWorkspace } from "./users";
import { generateClaudeText } from "../lib/ai-providers";
import { logger } from "../lib/logger";

// Daily AI topic suggester
// ───────────────────────
// Returns 5 timely, brand-specific topic suggestions the user can click to
// jump into the Generate page with that topic pre-filled. Solves "what
// should I post about today?" — the #1 reported anxiety for solo ecom
// sellers.
//
// Inputs Claude considers:
//   - Brand industry, voice, target audience, keywords
//   - Recent posts (so we don't repeat)
//   - Current month / season (timely hooks)
//   - Content pillars (so suggestions span educate/spotlight/etc.)
//
// Heavily cached server-side per brand+day — first call generates, repeat
// calls on the same UTC day return the cached set. Cache lives in memory
// only (no DB column for it); a process restart re-rolls fresh.

const router: IRouter = Router();

type CacheEntry = { day: string; topics: TopicSuggestion[]; cachedAt: number };
const CACHE_HOURS = 18; // also expire mid-day if requested
const CACHE_MAX = 1000;
const cache = new Map<number, CacheEntry>();
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function pruneCache(): void {
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

interface TopicSuggestion {
  topic: string;
  pillar: string;
  reason: string;
}

router.get(
  "/topic-suggester/:brandId",
  requireAuth,
  requireWorkspace,
  async (req: any, res): Promise<void> => {
    const brandId = Number(req.params.brandId);
    if (!Number.isInteger(brandId)) {
      res.status(400).json({ error: "Invalid brand id" });
      return;
    }

    const [brand] = await db
      .select()
      .from(brandsTable)
      .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    // Cache hit — return immediately. Avoids burning Claude credits on
    // refresh + means the dashboard widget loads instantly.
    const today = todayKey();
    const cached = cache.get(brandId);
    if (cached && cached.day === today && Date.now() - cached.cachedAt < CACHE_HOURS * 60 * 60 * 1000) {
      res.json({ topics: cached.topics, cached: true, day: today });
      return;
    }

    // Pull the brand's last few post topics so we don't repeat ourselves.
    const recent = await db
      .select({ content: postsTable.content, createdAt: postsTable.createdAt })
      .from(postsTable)
      .where(eq(postsTable.brandId, brandId))
      .orderBy(desc(postsTable.createdAt))
      .limit(8);
    const recentExcerpts = recent
      .map((p, i) => `${i + 1}. ${p.content.slice(0, 120)}`)
      .join("\n");

    // Current month gives Claude a seasonal hook to use.
    const now = new Date();
    const monthName = now.toLocaleString("en-US", { month: "long" });
    const dayOfMonth = now.getDate();

    // Content pillars give 5 topic types so the user gets variety, not
    // 5 product spotlights in a row.
    const pillars = brand.contentPillars as Record<string, number> | null;
    const pillarsLine = pillars
      ? Object.entries(pillars).map(([k, v]) => `${k} (${v}%)`).join(", ")
      : "educate, spotlight, reviews, bts, promo (equal)";

    const voice = brand.voiceDescription || brand.tone || "friendly";

    const prompt = `You are a content strategist for ${brand.name}, a ${brand.industry} brand serving ${brand.targetAudience}.

Brand voice: ${voice}
Keywords: ${brand.keywords ?? "(none specified)"}
Today: ${monthName} ${dayOfMonth}
Content pillar mix: ${pillarsLine}

Recent posts (don't repeat these):
${recentExcerpts || "(no recent posts)"}

Suggest 5 SPECIFIC, timely post topics for the brand to publish in the next 1-3 days. Each topic must:
- Pick ONE specific moment, story, or angle — NOT vague themes like "showcase the brand"
- Use a different content pillar where possible (educate, spotlight, reviews, bts, promo)
- Be timely — pull in the current month/season if it fits naturally
- Be writable in 1-3 sentences when expanded into a caption — i.e. it's a concrete prompt, not a chapter title
- Avoid clichés (no "tips Tuesday", "transformation Friday", "behind-the-scenes" as the topic — use specific BTS moments instead)

Return ONLY a JSON array of 5 objects, no prose around it. Each object has:
{
  "topic": "<the post topic, 6-15 words, written as something the writer will RIFF on>",
  "pillar": "<one of: educate, spotlight, reviews, bts, promo>",
  "reason": "<short why-this-now hook, 8-15 words>"
}`;

    try {
      const { content } = await generateClaudeText(prompt, { maxTokens: 700 });
      let raw = content.trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      const topics: TopicSuggestion[] = parsed
        .filter((t) => t && typeof t === "object" && typeof t.topic === "string")
        .map((t) => ({
          topic: String(t.topic).trim(),
          pillar: String(t.pillar ?? "spotlight").trim().toLowerCase(),
          reason: String(t.reason ?? "").trim(),
        }))
        .filter((t) => t.topic.length > 0)
        .slice(0, 5);
      if (topics.length === 0) throw new Error("no usable topics");

      // Move to end (LRU-style) and prune oldest if over the cap.
      if (cache.has(brandId)) cache.delete(brandId);
      cache.set(brandId, { day: today, topics, cachedAt: Date.now() });
      pruneCache();
      res.json({ topics, cached: false, day: today });
    } catch (err: any) {
      logger.warn({ err: err?.message, brandId }, "Topic suggester failed");
      res.status(502).json({ error: "Couldn't generate topic ideas right now." });
    }
  },
);

export default router;
