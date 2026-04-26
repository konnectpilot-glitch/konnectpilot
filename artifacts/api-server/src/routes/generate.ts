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
import Anthropic from "@anthropic-ai/sdk";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "AI service not configured" });
    return;
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(brand, parsed.data.platform, parsed.data.topic);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";

  res.json(GeneratePostResponse.parse({
    content,
    platform: parsed.data.platform,
    brandId: parsed.data.brandId,
  }));
});

router.post("/generate/save", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const parsed = SaveGeneratedPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify brand belongs to user
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
