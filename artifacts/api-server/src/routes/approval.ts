import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, brandsTable, postsTable, brandMemoryProfilesTable } from "@workspace/db";
import { generateClaudeText, generateNanoBananaImage } from "../lib/ai-providers";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import {
  PostApprovalGenerateBatchBody as GenerateBatchBody,
  PostApprovalGenerateBatchResponse as GenerateBatchResponse,
  PatchApprovalPostsIdBody as EditApprovalPostBody,
  PatchApprovalPostsIdParams as EditApprovalPostParams,
  PostApprovalBulkBody as BulkApprovalBody,
  PostApprovalBulkResponse as BulkApprovalResponse,
  GetBrandsIdMemoryParams as GetBrandMemoryParams,
  GetBrandsIdMemoryResponse as GetBrandMemoryResponse,
} from "@workspace/api-zod";
import { reserveQuota, releaseReservation, setReservationTokens } from "../lib/quotas";
import { buildBrandMemoryContext, aiBrandReview, recordFeedback } from "../lib/brand-memory";
import { buildPerformanceMemoryContext } from "../lib/performance-memory";
import { retryPost } from "../lib/scheduler";
import { logger } from "../lib/logger";
import { getPlan } from "../lib/plans";

const router: IRouter = Router();

function maxAdvanceMs(plan: string): number {
  return getPlan(plan).daysAdvance * 24 * 60 * 60 * 1000;
}

function buildCaptionPrompt(brand: any, platform: string, topic: string | null, brandMemory: string) {
  const platformInstructions: Record<string, string> = {
    instagram: "Write an engaging Instagram caption with 3-5 relevant hashtags. Max 200 words.",
    facebook: "Write a conversational Facebook post ending with an engaging question. Max 150 words.",
    linkedin: "Write a professional LinkedIn post with max 3 hashtags. Share insights. Max 200 words.",
    tiktok: "Write a very short, punchy TikTok caption. Casual tone, max 50 words.",
  };
  return `You are a social media content writer for ${brand.name}, a ${brand.industry} business.

Brand details:
- Tone of voice: ${brand.tone}
- Target audience: ${brand.targetAudience}
- Keywords: ${brand.keywords}

Platform: ${platform}
${topic ? `Today's topic: ${topic}` : "Choose a relevant topic based on the brand's industry and keywords."}

Instructions: ${platformInstructions[platform] ?? "Write a social media post."}
${brandMemory}
Write ONLY the post content. No preamble, no explanations.`;
}

async function buildImageDataUrl(brand: any): Promise<string | null> {
  const prompt = `Professional social media image for ${brand.name}, a ${brand.industry} brand. ${brand.tone} tone for ${brand.targetAudience}. Polished, scroll-stopping, no text overlays.`;
  try {
    const { dataUrl } = await generateNanoBananaImage(prompt, { timeoutMs: 120_000 });
    return dataUrl;
  } catch (err: any) {
    logger.warn({ err: err?.message, brandId: brand.id }, "Approval batch image gen failed");
    return null;
  }
}

function nextSlotTime(base: Date, postTime: string, dayOffset: number): Date {
  const [hh, mm] = postTime.split(":").map((n) => Number(n) || 0);
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
}

// ----- POST /approval/generate-batch -----
router.post("/approval/generate-batch", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const parsed = GenerateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { brandId, days, platforms, startDate } = parsed.data;
  const planDays = getPlan(req.user.plan).daysAdvance;
  if (days > planDays) {
    res.status(402).json({
      error: `Your ${req.user.plan} plan allows up to ${planDays} days of advance generation. Requested ${days}.`,
      code: "days_advance_exceeded",
    });
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

  const start = startDate ? new Date(startDate) : new Date();
  const [bm, pm] = await Promise.all([
    buildBrandMemoryContext(brandId),
    buildPerformanceMemoryContext(brandId),
  ]);
  const brandMemory = bm + pm;

  let created = 0;
  let autoApproved = 0;
  let autoRejected = 0;
  let failed = 0;

  for (let day = 0; day < days; day++) {
    for (const platform of platforms) {
      const slotTime = nextSlotTime(start, brand.postTime, day);
      // Each batch caption costs 0.5 credits (text-only post).
      const reservation = await reserveQuota(req.user.id, req.user.plan, "caption", "text_post");
      if (!reservation.allowed) {
        failed++;
        continue;
      }
      let content = "";
      try {
        const { content: text, usage } = await generateClaudeText(
          buildCaptionPrompt(brand, platform, null, brandMemory),
          { maxTokens: 1024 },
        );
        content = text;
        await setReservationTokens(reservation.reservationId, usage.totalTokens);
      } catch (err: any) {
        await releaseReservation(reservation.reservationId, reservation.usedBonus);
        logger.warn({ err: err?.message, brandId, platform }, "Batch caption gen failed");
        failed++;
        continue;
      }

      let status: "pending_approval" | "scheduled" | "rejected" = "pending_approval";
      let aiApproved: "yes" | "no" | null = null;
      let aiReviewReason: string | null = null;
      let aiReviewedAt: Date | null = null;

      if (brand.approvalMode === "auto") {
        const review = await aiBrandReview({ brand, platform, content, brandMemory });
        aiReviewedAt = new Date();
        aiReviewReason = review.reason;
        if (review.ok) {
          aiApproved = "yes";
          status = "scheduled";
          autoApproved++;
        } else {
          aiApproved = "no";
          status = "rejected";
          autoRejected++;
        }
      }

      const [inserted] = await db
        .insert(postsTable)
        .values({
          brandId: brand.id,
          workspaceId: req.workspaceId,
          platform,
          content,
          imageUrl: await buildImageDataUrl(brand),
          status,
          scheduledFor: slotTime,
          submittedById: req.user.id,
          approvedById: brand.approvalMode === "auto" && aiApproved === "yes" ? req.user.id : null,
          approvedAt: brand.approvalMode === "auto" && aiApproved === "yes" ? new Date() : null,
          aiApproved,
          aiReviewReason,
          aiReviewedAt,
        })
        .returning({ id: postsTable.id });
      created++;

      if (brand.approvalMode === "auto" && inserted) {
        await recordFeedback({
          postId: inserted.id,
          brandId: brand.id,
          action: aiApproved === "yes" ? "auto_approved" : "auto_rejected",
          reason: aiReviewReason,
          originalContent: content,
          finalContent: content,
        });
      }
    }
  }

  await db
    .update(brandsTable)
    .set({ lastBatchGeneratedAt: new Date() })
    .where(eq(brandsTable.id, brandId));

  res.json(
    GenerateBatchResponse.parse({ created, autoApproved, autoRejected, failed, days }),
  );
});

// ----- PATCH /approval/posts/:id -----
router.patch("/approval/posts/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const params = EditApprovalPostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = EditApprovalPostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.workspaceId, req.workspaceId)));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const updates: Partial<typeof postsTable.$inferInsert> = {};
  let captionEdited = false;
  if (body.data.content != null && body.data.content !== existing.content) {
    updates.content = body.data.content;
    captionEdited = true;
  }
  if (body.data.imageUrl !== undefined) updates.imageUrl = body.data.imageUrl;
  if (body.data.scheduledFor !== undefined) {
    if (body.data.scheduledFor) {
      const when = new Date(body.data.scheduledFor);
      if (when.getTime() - Date.now() > maxAdvanceMs(req.user.plan)) {
        res.status(402).json({
          error: `Your ${req.user.plan} plan limits scheduling to ${getPlan(req.user.plan).daysAdvance} days ahead.`,
          code: "days_advance_exceeded",
        });
        return;
      }
      updates.scheduledFor = when;
    } else {
      updates.scheduledFor = null;
    }
  }

  const [updated] = await db
    .update(postsTable)
    .set(updates)
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (captionEdited) {
    void recordFeedback({
      postId: existing.id,
      brandId: existing.brandId,
      action: "edited",
      originalContent: existing.content,
      finalContent: updates.content as string,
    }).catch((err) => logger.warn({ err: err?.message }, "recordFeedback edit failed"));
  }

  res.json({
    ...updated,
    scheduledFor: updated.scheduledFor?.toISOString() ?? null,
    publishedAt: updated.publishedAt?.toISOString() ?? null,
    aiReviewedAt: updated.aiReviewedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

// ----- POST /approval/bulk -----
router.post("/approval/bulk", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const parsed = BulkApprovalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { action, postIds, reason, publish, scheduledFor } = parsed.data;

  const minRole = action === "delete" || action === "approve" || action === "reject" ? "admin" : "editor";
  if (!hasRoleAtLeast(req.workspaceRole, minRole)) {
    res.status(403).json({ error: `${minRole} role required` });
    return;
  }

  const rows = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.workspaceId, req.workspaceId), inArray(postsTable.id, postIds)));

  const succeeded: number[] = [];
  const skipped: { id: number; reason: string }[] = [];

  for (const id of postIds) {
    const post = rows.find((r) => r.id === id);
    if (!post) {
      skipped.push({ id, reason: "Not found" });
      continue;
    }

    try {
      if (action === "delete") {
        await db.delete(postsTable).where(eq(postsTable.id, id));
        succeeded.push(id);
      } else if (action === "reject") {
        if (post.status !== "pending_approval") {
          skipped.push({ id, reason: `Cannot reject status "${post.status}"` });
          continue;
        }
        await db
          .update(postsTable)
          .set({
            status: "rejected",
            approvedById: req.user.id,
            approvedAt: new Date(),
            errorMessage: reason ?? null,
          })
          .where(eq(postsTable.id, id));
        succeeded.push(id);
        void recordFeedback({
          postId: id,
          brandId: post.brandId,
          action: "rejected",
          reason: reason ?? null,
          originalContent: post.content,
          finalContent: post.content,
        }).catch(() => {});
      } else if (action === "approve") {
        if (post.status !== "pending_approval") {
          skipped.push({ id, reason: `Cannot approve status "${post.status}"` });
          continue;
        }
        await db
          .update(postsTable)
          .set({
            status: post.scheduledFor ? "scheduled" : "generated",
            approvedById: req.user.id,
            approvedAt: new Date(),
          })
          .where(eq(postsTable.id, id));
        if (publish) {
          await db.update(postsTable).set({ status: "failed" }).where(eq(postsTable.id, id));
          await retryPost(id, req.workspaceId);
        }
        succeeded.push(id);
        void recordFeedback({
          postId: id,
          brandId: post.brandId,
          action: "approved",
          originalContent: post.content,
          finalContent: post.content,
        }).catch(() => {});
      } else if (action === "reschedule") {
        if (!scheduledFor) {
          skipped.push({ id, reason: "scheduledFor required" });
          continue;
        }
        const when = new Date(scheduledFor);
        if (when.getTime() - Date.now() > maxAdvanceMs(req.user.plan)) {
          skipped.push({
            id,
            reason: `Beyond ${getPlan(req.user.plan).daysAdvance}-day advance limit for ${req.user.plan} plan`,
          });
          continue;
        }
        await db
          .update(postsTable)
          .set({ scheduledFor: when })
          .where(eq(postsTable.id, id));
        succeeded.push(id);
      }
    } catch (err: any) {
      skipped.push({ id, reason: err?.message ?? "Unknown error" });
    }
  }

  res.json(BulkApprovalResponse.parse({ succeeded, skipped }));
});

// ----- GET /brands/:id/memory -----
router.get("/brands/:id/memory", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const params = GetBrandMemoryParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [brand] = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  const [profile] = await db
    .select()
    .from(brandMemoryProfilesTable)
    .where(eq(brandMemoryProfilesTable.brandId, params.data.id));
  if (!profile) {
    res.json(
      GetBrandMemoryResponse.parse({
        brandId: params.data.id,
        approvedSamples: [],
        rejectedSamples: [],
        editPatterns: [],
        distilledGuidelines: null,
        approvedCount: 0,
        rejectedCount: 0,
        editedCount: 0,
        updatedAt: new Date().toISOString(),
      }),
    );
    return;
  }
  res.json(
    GetBrandMemoryResponse.parse({
      brandId: profile.brandId,
      approvedSamples: profile.approvedSamples,
      rejectedSamples: profile.rejectedSamples,
      editPatterns: profile.editPatterns ?? [],
      distilledGuidelines: profile.distilledGuidelines ?? null,
      approvedCount: profile.approvedCount,
      rejectedCount: profile.rejectedCount,
      editedCount: profile.editedCount,
      updatedAt: profile.updatedAt.toISOString(),
    }),
  );
});

export default router;
