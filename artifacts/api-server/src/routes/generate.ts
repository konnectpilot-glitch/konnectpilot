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
import { openai } from "@workspace/integrations-openai-ai-server";
import { reserveQuota, releaseReservation, setReservationTokens } from "../lib/quotas";

const router: IRouter = Router();

function quotaExceededResponse(res: any, kind: "caption" | "image", used: number, limit: number, plan: string) {
  res.status(402).json({
    error: `Monthly ${kind} quota reached (${used}/${limit}) on the ${plan} plan. Upgrade to keep generating.`,
    code: "quota_exceeded",
    kind,
    used,
    limit,
    plan,
  });
}

function buildPrompt(brand: any, platform: string, topic?: string | null): string {
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

  const reservation = await reserveQuota(user.id, user.plan, "caption");
  if (!reservation.allowed) {
    quotaExceededResponse(res, "caption", reservation.used, reservation.limit, user.plan);
    return;
  }

  const prompt = buildPrompt(brand, parsed.data.platform, parsed.data.topic);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    await setReservationTokens(reservation.reservationId, completion.usage?.total_tokens);

    res.json(GeneratePostResponse.parse({
      content,
      platform: parsed.data.platform,
      brandId: parsed.data.brandId,
    }));
  } catch (err) {
    await releaseReservation(reservation.reservationId);
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

  const imageReservation = await reserveQuota(user.id, user.plan, "image");
  if (!imageReservation.allowed) {
    quotaExceededResponse(res, "image", imageReservation.used, imageReservation.limit, user.plan);
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
      await releaseReservation(imageReservation.reservationId);
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

  // Use Pollinations.ai — free image generation, no API key required
  const encodedPrompt = encodeURIComponent(imagePrompt);
  const seed = Math.floor(Math.random() * 999999);
  const sourceUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

  // Fetch the image bytes server-side (Pollinations can take 30-90s to generate).
  // We download and inline the image as a data URL so the browser does not have to
  // wait through a second slow round-trip and risk cache eviction / broken images.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const imgRes = await fetch(sourceUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!imgRes.ok) {
      await releaseReservation(imageReservation.reservationId);
      res.status(502).json({ error: "Image generation service returned an error. Please try again." });
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      await releaseReservation(imageReservation.reservationId);
      res.status(502).json({ error: "Image generation service returned invalid content. Please try again." });
      return;
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.json({ imageUrl: dataUrl, prompt: imagePrompt });
  } catch (err: any) {
    await releaseReservation(imageReservation.reservationId);
    const isTimeout = err?.name === "AbortError";
    res.status(isTimeout ? 504 : 500).json({
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
