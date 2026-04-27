import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandsTable, postsTable } from "@workspace/db";
import {
  GeneratePostBody,
  GeneratePostResponse,
  SaveGeneratedPostBody,
} from "@workspace/api-zod";
import { requireAuth, ensureUser } from "./users";
import { logger } from "../lib/logger";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

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

router.post("/generate", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const parsed = GeneratePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.userId, user.id)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const prompt = buildPrompt(brand, parsed.data.platform, parsed.data.topic);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0]?.message?.content ?? "";

  res.json(GeneratePostResponse.parse({
    content,
    platform: parsed.data.platform,
    brandId: parsed.data.brandId,
  }));
});

router.post("/generate/image", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const { brandId, customPrompt, platform, topic } = req.body;

  // Allow pure custom prompt with no brand required
  if (!customPrompt && !brandId) {
    res.status(400).json({ error: "Provide either a custom prompt or a brand" });
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
      .where(and(eq(brandsTable.id, Number(brandId)), eq(brandsTable.userId, user.id)));

    if (!brand) {
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
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

  // Verify the image is actually reachable before returning
  const check = await fetch(imageUrl, { method: "HEAD" });
  if (!check.ok) {
    res.status(500).json({ error: "Image generation failed — could not reach generation service" });
    return;
  }

  res.json({ imageUrl, prompt: imagePrompt });
});

router.post("/generate/video-script", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const { brandId, topic, platform } = req.body;

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, Number(brandId)), eq(brandsTable.userId, user.id)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const targetPlatform = platform || "tiktok";
  const topicLine = topic ? `Topic: ${topic}` : "Choose an engaging topic based on the brand's industry and keywords.";

  const scriptPrompt = `You are a professional short-form video scriptwriter for ${brand.name}, a ${brand.industry} brand targeting ${brand.targetAudience}.
Tone: ${brand.tone}. Keywords to weave in: ${brand.keywords}.
${topicLine}
Platform: ${targetPlatform === "tiktok" ? "TikTok (15–60 seconds)" : "Instagram Reels (15–30 seconds)"}

Write a complete short-form video script in JSON format with this exact structure:
{
  "title": "Video title",
  "duration": "estimated duration e.g. 30 seconds",
  "hook": "First 3 seconds — the attention-grabbing opening line spoken on camera",
  "scenes": [
    {
      "scene": 1,
      "visual": "What the camera shows / B-roll description",
      "voiceover": "What is said or shown as text overlay",
      "duration": "e.g. 5 seconds"
    }
  ],
  "callToAction": "The final CTA line",
  "caption": "The post caption with hashtags"
}

Return ONLY valid JSON. No markdown, no explanation.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: scriptPrompt }],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let script: any;
  try {
    script = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    try {
      script = match ? JSON.parse(match[0]) : {};
    } catch {
      script = { error: "Could not parse script", raw };
    }
  }

  res.json({ script });
});

router.post("/generate/save", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const parsed = SaveGeneratedPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.userId, user.id)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      brandId: parsed.data.brandId,
      platform: parsed.data.platform,
      content: parsed.data.content,
      status: parsed.data.status,
    })
    .returning();

  res.status(201).json({
    ...post,
    brandName: brand.name,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
  });
});

export default router;
