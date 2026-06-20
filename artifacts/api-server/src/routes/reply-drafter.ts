import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandsTable, brandMemoryProfilesTable } from "@workspace/db";
import { requireAuth, requireWorkspace } from "./users";
import { generateClaudeText } from "../lib/ai-providers";
import { logger } from "../lib/logger";

// AI Reply Drafter
// ────────────────
// Given a brand, the original post content, and the audience comment, return
// 3 reply drafts in the brand's voice. This is the v1 of audit P2 "Auto-reply
// to comments" — we don't yet have the FB/IG webhook ingest, so the user
// pastes the comment in by hand. Same drafting engine will plug into a real
// inbox once we have the comment-fetching layer.
//
// Why 3 drafts: ecommerce social usually has 3 "modes" — supportive, sales,
// playful. Letting the user pick the tone they want in one click beats
// regenerating until happy.

const router: IRouter = Router();

interface DraftReplyBody {
  brandId: number;
  postContent: string;
  commentText: string;
  /** Optional: who's commenting — first name helps personalize. */
  commenterName?: string | null;
  /** Optional: which platform — slightly tunes phrasing. */
  platform?: "facebook" | "instagram" | "linkedin" | null;
}

router.post(
  "/reply-drafter/draft",
  requireAuth,
  requireWorkspace,
  async (req: any, res): Promise<void> => {
    const body = (req.body ?? {}) as Partial<DraftReplyBody>;
    if (!body.brandId || !Number.isInteger(body.brandId)) {
      res.status(400).json({ error: "brandId is required" });
      return;
    }
    if (!body.postContent || typeof body.postContent !== "string") {
      res.status(400).json({ error: "postContent is required" });
      return;
    }
    if (!body.commentText || typeof body.commentText !== "string") {
      res.status(400).json({ error: "commentText is required" });
      return;
    }
    // Cap input sizes to keep the prompt and cost predictable.
    const postContent = body.postContent.slice(0, 4000);
    const commentText = body.commentText.slice(0, 2000);
    const commenterName = (body.commenterName ?? "").slice(0, 80).trim() || null;
    const platform = body.platform ?? null;

    // Brand context — workspace-scoped, so we don't leak across tenants.
    const [brand] = await db
      .select()
      .from(brandsTable)
      .where(
        and(eq(brandsTable.id, body.brandId), eq(brandsTable.workspaceId, req.workspaceId)),
      );
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    // Brand memory — what we've learned from approvals/edits. Optional;
    // brand-new brands won't have any yet.
    const [memory] = await db
      .select()
      .from(brandMemoryProfilesTable)
      .where(eq(brandMemoryProfilesTable.brandId, brand.id));

    // Build the prompt. We give Claude the brand voice signal, the original
    // post (so the reply is in-context), and three explicit "modes" so we
    // get genuinely different drafts and not three rewordings of the same
    // sentence.
    const voiceSignal = [
      brand.voiceDescription ? `Voice: ${brand.voiceDescription}` : null,
      brand.doDontRules ? `Always/Never rules: ${brand.doDontRules}` : null,
      brand.examplePosts ? `Example brand posts (for tone reference):\n${brand.examplePosts.slice(0, 1500)}` : null,
      memory?.distilledGuidelines ? `Learned guidelines from prior approvals: ${memory.distilledGuidelines}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const platformHint = platform
      ? `The reply will appear on ${platform}. Keep length and tone appropriate to that platform's audience.`
      : "";

    const prompt = `You are drafting reply options for ${brand.name}'s social media manager. Respond to the audience comment below in three distinct tones, in the brand's voice.

BRAND CONTEXT
${brand.name} — ${brand.industry}
Target audience: ${brand.targetAudience}
${voiceSignal || "(No specific voice description provided; lean warm and human.)"}

ORIGINAL POST (what the audience is commenting on):
"""
${postContent}
"""

AUDIENCE COMMENT${commenterName ? ` (from ${commenterName})` : ""}:
"""
${commentText}
"""

${platformHint}

Draft THREE distinct replies. Each must be:
- In the brand voice (not generic AI tone)
- A direct reply to this specific comment (acknowledge what they said)
- Concise — 1-3 sentences for Instagram/Facebook, can be slightly longer for LinkedIn
- Free of em-dashes and AI tells like "I appreciate", "Thank you so much for"
- ${commenterName ? `Use "${commenterName}" by name if it feels natural; don't force it` : "Don't fabricate a name"}

The three tones:
1. SUPPORTIVE — warm, helpful, prioritizes building relationship
2. SALES-LEANING — gently moves them toward purchasing/product, without being pushy
3. PLAYFUL — light, friendly, shows personality

Return ONLY a JSON array of three objects, no prose around it:
[
  { "tone": "supportive", "reply": "..." },
  { "tone": "sales", "reply": "..." },
  { "tone": "playful", "reply": "..." }
]`;

    try {
      const result = await generateClaudeText(prompt, { maxTokens: 700 });
      let raw = result.content.trim();
      // Strip ```json fences if Claude added them despite instructions.
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      const drafts = JSON.parse(raw);
      if (!Array.isArray(drafts)) {
        throw new Error("AI didn't return an array");
      }
      // Normalize + harden — guard against malformed entries.
      const normalized = drafts
        .filter((d) => d && typeof d === "object" && typeof d.reply === "string")
        .map((d) => ({
          tone: String(d.tone ?? "neutral"),
          reply: String(d.reply).trim(),
        }))
        .filter((d) => d.reply.length > 0)
        .slice(0, 3);
      if (!normalized.length) {
        res.status(502).json({ error: "AI returned no usable drafts" });
        return;
      }
      res.json({ drafts: normalized });
    } catch (err: any) {
      logger.error({ err: err?.message, brandId: brand.id }, "Reply drafter failed");
      res.status(502).json({ error: "Couldn't draft replies right now. Try again in a moment." });
    }
  },
);

export default router;
