import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandsTable, brandPerformanceMemoryTable } from "@workspace/db";
import { requireAuth, requireWorkspace } from "./users";
import { generateClaudeText } from "../lib/ai-providers";
import { logger } from "../lib/logger";
import crypto from "crypto";

// Predicted engagement score
// ──────────────────────────
// Given a brand + a draft caption + platform, asks Claude to score the
// draft 1-5 against the brand's actual performance memory (top exemplars,
// winning hooks, winning hashtags). Returns a label + one-line reasoning
// so the UI can show a small badge.
//
// Mostly a vibes-check, NOT a hard engagement number — we explicitly tell
// Claude not to fake stats. The value is the qualitative "this draft
// matches your top performers" vs "this is generic" judgment.
//
// Cached in-memory by content hash + brandId so re-rendering or variant
// switching doesn't burn extra Claude calls on the same draft.

const router: IRouter = Router();

interface PredictBody {
  brandId: number;
  content: string;
  platform?: string | null;
}

interface PredictionResult {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
  reasoning: string;
  hasMemory: boolean;
}

// Bounded LRU cache — a Map iterates in insertion order in V8, so re-inserting
// (delete+set) on every read moves the entry to the end. Once we exceed
// CACHE_MAX, we delete the oldest (first) entry. Prevents unbounded growth
// in long-running processes.
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const CACHE_MAX = 2000;
const cache = new Map<string, { result: PredictionResult; cachedAt: number }>();

function cacheGet(key: string): PredictionResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  // Move to the end (mark as recently used).
  cache.delete(key);
  cache.set(key, hit);
  return hit.result;
}

function cacheSet(key: string, result: PredictionResult): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { result, cachedAt: Date.now() });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function cacheKey(brandId: number, content: string, platform?: string | null): string {
  const hash = crypto.createHash("sha1").update(`${brandId}|${platform ?? ""}|${content}`).digest("hex");
  return hash;
}

router.post(
  "/predict/engagement",
  requireAuth,
  requireWorkspace,
  async (req: any, res): Promise<void> => {
    const body = (req.body ?? {}) as Partial<PredictBody>;
    if (!body.brandId || !Number.isInteger(body.brandId)) {
      res.status(400).json({ error: "brandId required" });
      return;
    }
    const content = (body.content ?? "").toString().trim().slice(0, 4000);
    if (!content || content.length < 10) {
      res.status(400).json({ error: "content too short to score" });
      return;
    }
    const platform = body.platform ?? null;

    // Cache by content+brand — same draft, same score within 30 min.
    const key = cacheKey(body.brandId, content, platform);
    const hit = cacheGet(key);
    if (hit) {
      res.json(hit);
      return;
    }

    const [brand] = await db
      .select()
      .from(brandsTable)
      .where(and(eq(brandsTable.id, body.brandId), eq(brandsTable.workspaceId, req.workspaceId)));
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    const [perf] = await db
      .select()
      .from(brandPerformanceMemoryTable)
      .where(eq(brandPerformanceMemoryTable.brandId, brand.id));

    const hasMemory = !!perf && (perf.samplesAnalyzed ?? 0) > 0;
    const exemplars = perf?.topExemplars ?? [];
    const exemplarBlock = exemplars.length > 0
      ? exemplars.slice(0, 5).map((e: any, i: number) => `${i + 1}. (engagement ${Math.round((e.score ?? 0) * 100)}%) ${String(e.content ?? "").slice(0, 200)}`).join("\n")
      : "(no top-exemplars yet — score against industry-typical engagement patterns instead)";
    const winningHooks = perf?.winningHookTemplates?.slice(0, 5) ?? [];
    const winningHashtags = perf?.winningHashtags?.slice(0, 10) ?? [];

    const prompt = `You are an honest performance predictor for a social media post. You will see (1) one or more top-performing posts for this specific brand, and (2) a candidate draft. Score how likely the draft is to perform at or above the brand's recent average.

BRAND: ${brand.name} (${brand.industry}) — ${brand.targetAudience}
PLATFORM: ${platform ?? "social"}

TOP-PERFORMING POSTS FOR THIS BRAND (their actual engagement-validated style):
${exemplarBlock}
${winningHooks.length > 0 ? `\nWINNING HOOK PATTERNS: ${winningHooks.join(" | ")}` : ""}
${winningHashtags.length > 0 ? `\nHASHTAGS THAT HAVE LANDED: ${winningHashtags.join(", ")}` : ""}

DRAFT TO SCORE:
"""
${content}
"""

Score 1-5 using THIS rubric:
- 5: Strong match to the brand's top performers — same hook archetype, same voice rhythm, specific (not vague). Likely to outperform recent average.
- 4: Solid — clear hook, on-brand voice, no AI tells. At-or-above-average.
- 3: Functional — gets the message across but generic; could underperform on engagement.
- 2: Off — clichéd opener, AI tells (em-dashes, "thrilled to share", etc.), or vague.
- 1: Likely to flop — wrong tone, no hook, off-brand.

Be HONEST. Do NOT make up engagement numbers. Just the score + one-line reasoning grounded in the comparison.

Return ONLY JSON, no prose around it:
{"score": <1-5>, "label": "<2-5 words like 'Above average', 'On-brand', 'Generic'>", "reasoning": "<one sentence, max 18 words, concrete>"}`;

    try {
      const { content: aiOut } = await generateClaudeText(prompt, { maxTokens: 250 });
      let raw = aiOut.trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      const parsed = JSON.parse(raw);
      let score = Number(parsed.score);
      if (!Number.isFinite(score) || score < 1 || score > 5) score = 3;
      const result: PredictionResult = {
        score: Math.round(score) as 1 | 2 | 3 | 4 | 5,
        label: String(parsed.label ?? "Scored").trim().slice(0, 32),
        reasoning: String(parsed.reasoning ?? "").trim().slice(0, 200),
        hasMemory,
      };
      cacheSet(key, result);
      res.json(result);
    } catch (err: any) {
      logger.warn({ err: err?.message, brandId: brand.id }, "Engagement predict failed");
      res.status(502).json({ error: "Couldn't score this draft right now." });
    }
  },
);

export default router;
