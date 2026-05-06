import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandsTable, postsTable } from "@workspace/db";
import {
  GeneratePostBody,
  GeneratePostResponse,
  SaveGeneratedPostBody,
} from "@workspace/api-zod";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import { logger } from "../lib/logger";
import { generateClaudeText, generateNanoBananaImage } from "../lib/ai-providers";
import { reserveQuota, releaseReservation, setReservationTokens } from "../lib/quotas";
import { buildBrandMemoryContext } from "../lib/brand-memory";
import { buildPerformanceMemoryContext } from "../lib/performance-memory";

const router: IRouter = Router();

function quotaExceededResponse(
  res: any,
  result: { used: number; limit: number; bonus: number; cost: number },
  plan: string,
) {
  res.status(402).json({
    error: `You're out of credits this month (${result.used.toFixed(1)} / ${result.limit} used, ${result.bonus.toFixed(1)} bonus). Top up or upgrade to keep generating.`,
    code: "quota_exceeded",
    used: result.used,
    limit: result.limit,
    bonus: result.bonus,
    cost: result.cost,
    plan,
  });
}

function buildPrompt(brand: any, platform: string, topic?: string | null, brandMemory: string = ""): string {
  const platformInstructions: Record<string, string> = {
    instagram: `Write an engaging Instagram caption. Include 3-5 relevant hashtags at the end. Keep it visual and engaging. Max 200 words.`,
    facebook: `Write a conversational Facebook post. End with an engaging question to drive comments. Max 150 words.`,
    linkedin: `Write a professional LinkedIn post with max 3 hashtags. Use a professional tone, share insights or value. Max 200 words.`,
    tiktok: `Write a very short, punchy TikTok caption. Casual tone, max 50 words. High energy.`,
  };

  const instruction = platformInstructions[platform] || "Write a social media post.";
  const topicLine = topic ? `Today's topic: ${topic}` : "Choose a relevant topic based on the brand's industry and keywords.";

  return `You are a social media content writer for ${brand.name}, a ${brand.industry} business.

Brand details:
- Tone of voice: ${brand.tone}
- Target audience: ${brand.targetAudience}
- Keywords to incorporate: ${brand.keywords}

Platform: ${platform.charAt(0).toUpperCase() + platform.slice(1)}
${topicLine}

Instructions: ${instruction}
${brandMemory}
Write ONLY the post content. No preamble, no explanations, just the post text itself.`;
}

router.post("/generate", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const parsed = GeneratePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.workspaceId, req.workspaceId)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const user = req.user;
  // Text-only caption generation = 0.5 credits per spec.
  const reservation = await reserveQuota(user.id, user.plan, "caption", "text_post");
  if (!reservation.allowed) {
    quotaExceededResponse(res, reservation, user.plan);
    return;
  }

  const [brandMemory, perfMemory] = await Promise.all([
    buildBrandMemoryContext(brand.id),
    buildPerformanceMemoryContext(brand.id),
  ]);
  const prompt = buildPrompt(brand, parsed.data.platform, parsed.data.topic, brandMemory + perfMemory);

  try {
    const { content, usage } = await generateClaudeText(prompt, { maxTokens: 1024 });
    await setReservationTokens(reservation.reservationId, usage.totalTokens);

    res.json(GeneratePostResponse.parse({
      content,
      platform: parsed.data.platform,
      brandId: parsed.data.brandId,
    }));
  } catch (err) {
    await releaseReservation(reservation.reservationId, reservation.usedBonus);
    throw err;
  }
});

router.post("/generate/image", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const { brandId, customPrompt, platform, topic } = req.body;

  // Allow pure custom prompt with no brand required
  if (!customPrompt && !brandId) {
    res.status(400).json({ error: "Provide either a custom prompt or a brand" });
    return;
  }

  const user = req.user;
  // AI image post (image + caption combo) = 1 credit per spec.
  const imageReservation = await reserveQuota(user.id, user.plan, "image", "image_post");
  if (!imageReservation.allowed) {
    quotaExceededResponse(res, imageReservation, user.plan);
    return;
  }

  let imagePrompt: string;

  if (customPrompt && customPrompt.trim()) {
    // User typed their own description — use it directly
    imagePrompt = customPrompt.trim();
  } else {
    // Build prompt from brand details
    const [brand] = await db
      .select()
      .from(brandsTable)
      .where(and(eq(brandsTable.id, Number(brandId)), eq(brandsTable.workspaceId, req.workspaceId)));

    if (!brand) {
      await releaseReservation(imageReservation.reservationId, imageReservation.usedBonus);
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    imagePrompt = `Create a visually striking, professional social media image for ${brand.name}, a ${brand.industry} brand.
Style: ${brand.tone} tone, appealing to ${brand.targetAudience}.
${topic ? `Theme: ${topic}.` : ""}
Platform: ${platform || "social media"}.
The image should feel polished, brand-appropriate, and scroll-stopping.
No text overlays. Clean composition with strong visual hierarchy.`;
  }

  // Generate image with Google Gemini 2.5 Flash Image ("Nano Banana").
  // Returned as an inlined data URL so the browser doesn't need a second round-trip.
  try {
    const { dataUrl } = await generateNanoBananaImage(imagePrompt, { timeoutMs: 120_000 });
    res.json({ imageUrl: dataUrl, prompt: imagePrompt });
  } catch (err: any) {
    await releaseReservation(imageReservation.reservationId, imageReservation.usedBonus);
    const isTimeout = err?.name === "AbortError";
    logger.error({ err: err?.message ?? err }, "Nano Banana image generation failed");
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout
        ? "Image generation timed out. The AI service is busy — please try again."
        : "Image generation failed. Please try again.",
    });
  }
});

router.post("/generate/save", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const parsed = SaveGeneratedPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.workspaceId, req.workspaceId)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      brandId: parsed.data.brandId,
      workspaceId: req.workspaceId,
      platform: parsed.data.platform,
      content: parsed.data.content,
      status: parsed.data.status,
    })
    .returning();

  res.status(201).json({
    ...post,
    brandName: brand.name,
    imageUrl: post.imageUrl ?? null,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
  });
});

export default router;
