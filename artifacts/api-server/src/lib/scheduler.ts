import { eq, and } from "drizzle-orm";
import {
  db,
  postingSchedulesTable,
  brandsTable,
  socialAccountsTable,
  brandSocialAccountsTable,
  postsTable,
  workspacesTable,
} from "@workspace/db";
import { generateClaudeText, generateNanoBananaImage } from "./ai-providers";
import { logger } from "./logger";
import { publishToFacebook, publishToInstagram, publishToLinkedIn } from "./publishers";
import { buildProfessionalImageBrief, type ImageStyle } from "./image-brief";
import { writeImageHook } from "./hook-writer";
import { bakeImageOverlays } from "./image-overlay";
import { buildCaptionBrief, type Platform as CaptionPlatform } from "./caption-brief";

const VALID_STYLES: ImageStyle[] = [
  "auto", "product_hero", "lifestyle", "editorial", "minimalist_studio", "documentary", "flat_lay",
];
function normalizeStyle(raw: string | null | undefined): ImageStyle {
  if (!raw) return "auto";
  return (VALID_STYLES as string[]).includes(raw) ? (raw as ImageStyle) : "auto";
}

const TICK_MS = 60_000;
const SLOT_TOLERANCE_MS = 5 * 60_000;
const STRICT_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

let timer: NodeJS.Timeout | null = null;

/**
 * Returns the offset (ms) between the given UTC instant and the same wall-clock
 * moment in `tz`. Positive when `tz` is ahead of UTC. DST-correct.
 */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

/**
 * Compute the UTC instant corresponding to today's HH:MM wall-clock in `tz`.
 * Falls back to UTC if the timezone is invalid.
 */
function utcSlotForLocalTime(now: Date, hh: number, mm: number, tz: string): Date {
  try {
    // Discover what calendar date "now" maps to in tz.
    const dateFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [Y, M, D] = dateFmt.format(now).split("-").map(Number);
    // Treat the wall-clock time as if it were UTC, then subtract the tz offset
    // at that moment to land on the true UTC instant.
    const naive = new Date(Date.UTC(Y, M - 1, D, hh, mm, 0));
    const offset = tzOffsetMs(naive, tz);
    return new Date(naive.getTime() - offset);
  } catch {
    const fallback = new Date(now);
    fallback.setUTCHours(hh, mm, 0, 0);
    return fallback;
  }
}

// Phase 2: weighted-random pillar pick. Used by the scheduler so a brand's
// configured content mix actually drives what gets generated. Falls back to a
// neutral "general" if no pillars are configured.
const PILLAR_GUIDANCE: Record<string, string> = {
  educate: "Write an educational tip or how-to relevant to the brand's industry.",
  spotlight: "Spotlight a product or service from the brand. Highlight one specific benefit.",
  reviews: "Frame this as a customer story or testimonial pattern. Use plain, real-feeling language.",
  bts: "Behind-the-scenes — process, team, packaging, or the day-to-day of running the brand.",
  promo: "Promote a current offer or call out a specific reason to buy now. Stay on-brand, not salesy.",
};
function pickPillar(pillars: any): string | null {
  if (!pillars || typeof pillars !== "object") return null;
  const entries = Object.entries(pillars).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, v]) => sum + Number(v), 0);
  let r = Math.random() * total;
  for (const [k, v] of entries) {
    r -= Number(v);
    if (r <= 0) return k;
  }
  return entries[0][0];
}

function buildCaption(brand: any, platform: string, prompt?: string | null): string {
  // Pillar selection happens here (scheduler-side, weighted-random) and we
  // pass both the pillar id and its long-form guidance through to the shared
  // brief builder so the manual-generate path and scheduler stay aligned.
  const pillar = pickPillar(brand.contentPillars);
  return buildCaptionBrief({
    brand,
    platform: platform as CaptionPlatform,
    topic: prompt ?? null,
    pillar: pillar ?? null,
    pillarGuidance: pillar ? PILLAR_GUIDANCE[pillar] ?? null : null,
  });
}

// DEPRECATED — kept for the rare callers that still pass through, but every
// real generation path now goes through buildProfessionalImageBrief (in
// lib/image-brief.ts). The reason: the old prompt was too generic ("scroll-
// stopping", "polished") and produced AI-slop output. The new brief writer
// uses Claude as a creative director who specifies subject, lens, lighting,
// composition, and explicit anti-AI-slop negative cues.
async function buildImagePromptPro(
  brand: any,
  prompt?: string | null,
  style?: string | null,
  platform?: string | null,
  postContent?: string | null,
  hasLogoReference?: boolean,
): Promise<string> {
  try {
    return await buildProfessionalImageBrief({
      brand: {
        name: brand.name,
        industry: brand.industry,
        targetAudience: brand.targetAudience,
        voiceDescription: brand.voiceDescription,
        tone: brand.tone,
        keywords: brand.keywords,
        brandColorPrimary: brand.brandColorPrimary,
        brandColorSecondary: brand.brandColorSecondary,
        websiteUrl: brand.websiteUrl,
      },
      topic: prompt ?? null,
      platform: platform ?? null,
      postContent: postContent ?? null,
      hasLogoReference: !!hasLogoReference,
      style: normalizeStyle(style),
    });
  } catch (err) {
    // Enhancer failure path — same structured fallback as routes/generate.ts
    // so scheduled posts still get a markedly-better prompt than the legacy
    // one even if Claude is unhappy.
    logger.warn({ err: (err as any)?.message, brandId: brand?.id }, "Scheduler image brief enhancer failed; using structured fallback");
    const colorBlock = brand.brandColorPrimary
      ? `Brand color palette: primary ${brand.brandColorPrimary}${brand.brandColorSecondary ? `, secondary ${brand.brandColorSecondary}` : ""}. Use these colors naturally in the scene.`
      : "";
    return `Professional commercial photography for ${brand.name}, a ${brand.industry} brand serving ${brand.targetAudience}. ${prompt ? `Subject: ${prompt}.` : "Subject: a versatile evergreen brand-defining moment."} Shot on 50mm f/1.8 lens with shallow depth of field, soft natural window light, rule-of-thirds composition with deliberate negative space, editorial commercial photography style. ${colorBlock} 1:1 square aspect ratio composed for ${platform ?? "social"} feed. Photorealistic, no text overlays, no watermarks, no warped hands, no extra fingers, no plastic skin texture, no AI artifacts, no logos in the image.`;
  }
}

async function generateContent(brand: any, platform: string, contentPrompt?: string | null) {
  const { content } = await generateClaudeText(
    buildCaption(brand, platform, contentPrompt),
    { maxTokens: 1024 },
  );
  return content;
}

// Logo URL helper — delegates to the signed-URL builder in routes/brands.ts
// so Nano Banana receives a short-lived HMAC token rather than an
// enumerable raw URL.
import { buildSignedLogoUrl } from "../routes/brands";
const buildPublicLogoUrl = buildSignedLogoUrl;

/** True iff this brand has a logo AND we can build a public URL for it
 *  (which we can't in dev). Used to inform the enhancer whether to tell
 *  Claude that a logo reference will be attached. */
function hasReachableLogo(brand: any): boolean {
  const logoCount = Array.isArray(brand?.logos) ? brand.logos.length : 0;
  if (logoCount === 0) return false;
  return !!buildPublicLogoUrl(brand.id, 0);
}

async function generateImageDataUrl(
  prompt: string,
  brand?: any,
  overlay?: { caption?: string | null; topic?: string | null; hook?: boolean },
): Promise<string> {
  // Phase 2: pass first brand logo as reference image when reachable. In dev
  // (localhost backend) this returns null; falls back to text-to-image.
  let referenceImageUrls: string[] | undefined;
  const logoCount = Array.isArray(brand?.logos) ? brand.logos.length : 0;
  if (logoCount > 0) {
    const url = buildPublicLogoUrl(brand.id, 0);
    if (url) referenceImageUrls = [url];
  }
  const { dataUrl } = await generateNanoBananaImage(prompt, {
    timeoutMs: 120_000,
    referenceImageUrls,
  });

  // AUTOMATION: bake a scroll-stopping text hook (auto-written) + the crisp
  // brand logo onto the image, server-side. This is what makes auto-posts
  // look like real scroll-stoppers without the user touching the Generate
  // page. Hook defaults ON; the bake never throws (falls back to the raw
  // image) so a render hiccup can't block publishing.
  try {
    const hookEnabled = overlay?.hook !== false;
    let hookText = "";
    if (hookEnabled) {
      hookText = await writeImageHook({
        brand: brand
          ? {
              name: brand.name,
              industry: brand.industry,
              targetAudience: brand.targetAudience,
              voiceDescription: brand.voiceDescription ?? null,
              tone: brand.tone ?? null,
            }
          : null,
        topic: overlay?.topic ?? null,
        postContent: overlay?.caption ?? null,
      });
    }
    const logoDataUrl =
      Array.isArray(brand?.logos) && typeof brand.logos[0] === "string" ? brand.logos[0] : null;
    if (hookText || logoDataUrl) {
      return await bakeImageOverlays(dataUrl, {
        hookText,
        hookPosition: "bottom",
        logoDataUrl,
        logoPosition: logoDataUrl ? "bottom_right" : "none",
      });
    }
  } catch (err) {
    logger.warn({ err: (err as any)?.message, brandId: brand?.id }, "Auto hook/logo bake failed; using raw image");
  }
  return dataUrl;
}

async function publishOnePlatform(
  platform: string,
  account: typeof socialAccountsTable.$inferSelect,
  imageUrl: string,
  caption: string,
) {
  if (platform === "facebook") {
    // New picker-flow rows store the Page access token + Page ID directly so
    // the publisher can post without re-fetching /me/accounts. Legacy rows
    // (accountType=null) fall back to the discovery path inside publishers.ts.
    return publishToFacebook({
      userAccessToken: account.accessToken,
      pageId: account.accountType === "facebook_page" ? account.platformUserId : null,
      imageUrl,
      caption,
    });
  }
  if (platform === "instagram") {
    return publishToInstagram({
      userAccessToken: account.accessToken,
      igUserId: account.accountType === "instagram_business" ? account.platformUserId : null,
      imageUrl,
      caption,
    });
  }
  if (platform === "linkedin") {
    return publishToLinkedIn({
      userAccessToken: account.accessToken,
      platformUserId: account.platformUserId,
      imageUrl,
      caption,
    });
  }
  return { ok: false as const, error: `Unsupported platform: ${platform}` };
}

/**
 * Manually retry publishing a single failed post. Re-uses the existing
 * caption + image when available; only regenerates pieces that are missing.
 * Returns the updated post status.
 */
export async function retryPost(postId: number, workspaceId: number): Promise<
  | { ok: true; status: "published"; platformPostId: string | null }
  | { ok: false; status: "failed"; error: string }
> {
  // Verify ownership via workspace
  const [row] = await db
    .select({ post: postsTable, brand: brandsTable })
    .from(postsTable)
    .innerJoin(brandsTable, eq(postsTable.brandId, brandsTable.id))
    .where(and(eq(postsTable.id, postId), eq(postsTable.workspaceId, workspaceId)));
  if (!row) {
    return { ok: false, status: "failed", error: "Post not found" };
  }
  const { post, brand } = row;

  // Account must be explicitly assigned to this post's brand. Workspace + platform
  // alone is no longer enough — see brand_social_accounts join. This prevents
  // accidentally posting a Brand A draft to Brand B's connected Page.
  const [accountRow] = await db
    .select({ account: socialAccountsTable })
    .from(socialAccountsTable)
    .innerJoin(
      brandSocialAccountsTable,
      eq(brandSocialAccountsTable.socialAccountId, socialAccountsTable.id),
    )
    .where(
      and(
        eq(socialAccountsTable.workspaceId, workspaceId),
        eq(socialAccountsTable.platform, post.platform),
        eq(socialAccountsTable.isActive, true),
        eq(brandSocialAccountsTable.brandId, post.brandId),
      ),
    );
  const account = accountRow?.account;
  if (!account) {
    const msg = `No connected ${post.platform} account assigned to this brand.`;
    await db
      .update(postsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(postsTable.id, postId));
    return { ok: false, status: "failed", error: msg };
  }

  // Reuse existing image/caption when present so retry is fast and consistent.
  let imageUrl = post.imageUrl;
  if (!imageUrl) {
    const prompt = await buildImagePromptPro(brand, null, null, post.platform, post.content, hasReachableLogo(brand));
    try {
      imageUrl = await generateImageDataUrl(prompt, brand, { caption: post.content ?? null });
    } catch (err: any) {
      const msg = `Image generation failed: ${err?.message ?? err}`;
      await db
        .update(postsTable)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(postsTable.id, postId));
      return { ok: false, status: "failed", error: msg };
    }
  }

  let caption = post.content;
  if (!caption || caption.trim().length === 0) {
    try {
      caption = await generateContent(brand, post.platform, null);
    } catch (err: any) {
      const msg = `Caption generation failed: ${err?.message ?? err}`;
      await db
        .update(postsTable)
        .set({ status: "failed", imageUrl, errorMessage: msg })
        .where(eq(postsTable.id, postId));
      return { ok: false, status: "failed", error: msg };
    }
  }

  const result = await publishOnePlatform(post.platform, account, imageUrl, caption);
  await db
    .update(postsTable)
    .set({
      content: caption,
      imageUrl,
      status: result.ok ? "published" : "failed",
      publishedAt: result.ok ? new Date() : null,
      platformPostId: result.platformPostId ?? null,
      errorMessage: result.ok ? null : result.error ?? "Unknown error",
    })
    .where(eq(postsTable.id, postId));

  logger.info(
    { postId, platform: post.platform, ok: result.ok, error: result.error },
    "Manual retry result",
  );

  if (result.ok) {
    return { ok: true, status: "published", platformPostId: result.platformPostId ?? null };
  }
  return { ok: false, status: "failed", error: result.error ?? "Unknown error" };
}

/**
 * Atomically claim a slot for a (schedule, platform, slotTime) tuple by
 * inserting a placeholder row. The unique index on (schedule_id,
 * scheduled_for, platform) makes concurrent claims fail with a unique
 * violation, so only one worker proceeds. Returns the new row id, or null if
 * already claimed.
 */
async function claimSlot(
  scheduleId: number,
  brandId: number,
  platform: string,
  slotTime: Date,
  workspaceId: number | null,
): Promise<number | null> {
  try {
    const [row] = await db
      .insert(postsTable)
      .values({
        brandId,
        workspaceId,
        scheduleId,
        platform,
        content: "",
        status: "pending",
        scheduledFor: slotTime,
      })
      .returning({ id: postsTable.id });
    return row?.id ?? null;
  } catch (err: any) {
    // 23505 = unique_violation in postgres — slot already claimed by another tick
    if (err?.code === "23505") return null;
    throw err;
  }
}

async function processClaimedSlot(
  schedule: typeof postingSchedulesTable.$inferSelect,
  platform: string,
  postRowId: number,
  slotTime: Date,
  requireApproval: boolean,
) {
  logger.info(
    { scheduleId: schedule.id, platform, postRowId, slotTime: slotTime.toISOString() },
    "Processing claimed slot",
  );

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.id, schedule.brandId));
  if (!brand) {
    await db
      .update(postsTable)
      .set({ status: "failed", errorMessage: "Brand not found" })
      .where(eq(postsTable.id, postRowId));
    return;
  }

  const wsId = schedule.workspaceId ?? brand.workspaceId;
  // Account must be assigned to this schedule's brand via brand_social_accounts.
  const [accountRow] = await db
    .select({ account: socialAccountsTable })
    .from(socialAccountsTable)
    .innerJoin(
      brandSocialAccountsTable,
      eq(brandSocialAccountsTable.socialAccountId, socialAccountsTable.id),
    )
    .where(
      and(
        wsId
          ? eq(socialAccountsTable.workspaceId, wsId)
          : eq(socialAccountsTable.userId, schedule.userId),
        eq(socialAccountsTable.platform, platform),
        eq(socialAccountsTable.isActive, true),
        eq(brandSocialAccountsTable.brandId, schedule.brandId),
      ),
    );
  const account = accountRow?.account;
  if (!account) {
    await db
      .update(postsTable)
      .set({ status: "failed", errorMessage: `No connected ${platform} account assigned to this brand.` })
      .where(eq(postsTable.id, postRowId));
    return;
  }

  if (requireApproval) {
    // Workspace requires admin approval before publishing scheduled posts.
    // Generate the caption + image so the admin can preview, then park the
    // row in pending_approval. Admin can approve to publish via the API.
    // Generate the caption FIRST so we can pass it to the image brief
    // enhancer — that way the visual concept matches what the caption is
    // actually about ("fresh roast Tuesday" → coffee scene, not generic).
    let previewCaption = "";
    try {
      previewCaption = await generateContent(brand, platform, schedule.contentPrompt);
    } catch (err: any) {
      previewCaption = "";
      logger.warn({ err: err?.message, scheduleId: schedule.id }, "Pending-approval caption gen failed");
    }
    const imagePromptOnly = await buildImagePromptPro(
      brand,
      schedule.contentPrompt,
      schedule.imageStyle,
      platform,
      previewCaption || null,
      hasReachableLogo(brand),
    );
    let previewImageUrl: string | null = null;
    try {
      previewImageUrl = await generateImageDataUrl(imagePromptOnly, brand, {
        caption: previewCaption || null,
        topic: schedule.contentPrompt ?? null,
      });
    } catch (err: any) {
      logger.warn({ err: err?.message, scheduleId: schedule.id }, "Pending-approval image gen failed");
    }
    await db
      .update(postsTable)
      .set({
        content: previewCaption,
        imageUrl: previewImageUrl,
        status: "pending_approval",
      })
      .where(eq(postsTable.id, postRowId));
    return;
  }

  // Caption first, image second — same as the require-approval branch.
  // The image brief enhancer reads the caption so the visual concept
  // matches what the post is actually saying.
  let caption = "";
  try {
    caption = await generateContent(brand, platform, schedule.contentPrompt);
  } catch (err: any) {
    await db
      .update(postsTable)
      .set({ status: "failed", errorMessage: `Caption generation failed: ${err?.message ?? err}` })
      .where(eq(postsTable.id, postRowId));
    return;
  }

  const imagePrompt = await buildImagePromptPro(
    brand,
    schedule.contentPrompt,
    schedule.imageStyle,
    platform,
    caption || null,
    hasReachableLogo(brand),
  );
  let imageUrl: string;
  try {
    imageUrl = await generateImageDataUrl(imagePrompt, brand, {
      caption: caption || null,
      topic: schedule.contentPrompt ?? null,
    });
  } catch (err: any) {
    const msg = `Image generation failed: ${err?.message ?? err}`;
    await db
      .update(postsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(postsTable.id, postRowId));
    logger.error({ err, scheduleId: schedule.id, platform }, "Image generation failed");
    return;
  }

  // (caption + imageUrl are both ready at this point)

  const result = await publishOnePlatform(platform, account, imageUrl, caption);
  await db
    .update(postsTable)
    .set({
      content: caption,
      imageUrl,
      status: result.ok ? "published" : "failed",
      publishedAt: result.ok ? new Date() : null,
      platformPostId: result.platformPostId ?? null,
      errorMessage: result.ok ? null : result.error ?? "Unknown error",
    })
    .where(eq(postsTable.id, postRowId));

  logger.info(
    { scheduleId: schedule.id, platform, ok: result.ok, error: result.error },
    "Scheduled post result",
  );
}

async function tick() {
  const now = new Date();
  try {
    const activeSchedules = await db
      .select()
      .from(postingSchedulesTable)
      .where(eq(postingSchedulesTable.isActive, true));

    // Cache workspace approval flags per tick to avoid repeat lookups
    const approvalCache = new Map<number, boolean>();
    async function workspaceRequiresApproval(wsId: number | null): Promise<boolean> {
      if (!wsId) return false;
      if (approvalCache.has(wsId)) return approvalCache.get(wsId)!;
      const [ws] = await db
        .select({ requireApproval: workspacesTable.requireApproval })
        .from(workspacesTable)
        .where(eq(workspacesTable.id, wsId));
      const v = ws?.requireApproval ?? false;
      approvalCache.set(wsId, v);
      return v;
    }

    for (const schedule of activeSchedules) {
      const seenSlots = new Set<number>();
      for (const time of schedule.postTimes) {
        if (!STRICT_TIME_REGEX.test(time)) continue;
        const [hh, mm] = time.split(":").map(Number);

        const slotTime = utcSlotForLocalTime(now, hh, mm, schedule.timezone || "UTC");
        const diffMs = now.getTime() - slotTime.getTime();
        if (diffMs < 0 || diffMs > SLOT_TOLERANCE_MS) continue;

        // de-dup duplicate times within the same schedule
        const key = slotTime.getTime();
        if (seenSlots.has(key)) continue;
        seenSlots.add(key);

        const requireApproval = await workspaceRequiresApproval(schedule.workspaceId);

        for (const platform of schedule.platforms) {
          const claimedId = await claimSlot(schedule.id, schedule.brandId, platform, slotTime, schedule.workspaceId);
          if (claimedId === null) continue; // already processed

          // Process in background; the row is already claimed so no double-fire risk
          void processClaimedSlot(schedule, platform, claimedId, slotTime, requireApproval).catch((err) => {
            logger.error({ err, scheduleId: schedule.id, platform }, "processClaimedSlot threw");
            void db
              .update(postsTable)
              .set({ status: "failed", errorMessage: String(err?.message ?? err) })
              .where(eq(postsTable.id, claimedId));
          });
        }
      }

      await db
        .update(postingSchedulesTable)
        .set({ lastRunAt: now })
        .where(eq(postingSchedulesTable.id, schedule.id));
    }

    // ── One-off scheduled posts ──────────────────────────────────────────────
    // Users can hit "Schedule" on a generated draft from the Generate page;
    // that PATCHes scheduledFor + sets status="scheduled". This sweep picks
    // them up at their scheduled time and publishes via retryPost (which
    // already handles the data-URL → multipart edge cases for FB/IG).
    try {
      const { lte, sql: sqlOp } = await import("drizzle-orm");
      const due = await db
        .select({ id: postsTable.id, workspaceId: postsTable.workspaceId })
        .from(postsTable)
        .where(
          and(
            eq(postsTable.status, "scheduled"),
            // scheduledFor <= now (publish time has arrived or passed)
            lte(postsTable.scheduledFor, now),
          ),
        )
        .limit(20);
      for (const p of due) {
        if (!p.workspaceId) continue;
        // Flip status to "failed" briefly so retryPost re-uses the existing
        // content/image and publishes; retryPost is idempotent on success.
        await db.update(postsTable).set({ status: "failed" }).where(eq(postsTable.id, p.id));
        void retryPost(p.id, p.workspaceId).catch((err) => {
          logger.error({ err, postId: p.id }, "One-off scheduled publish threw");
        });
      }
    } catch (err) {
      logger.error({ err }, "One-off scheduled-post sweep failed");
    }
  } catch (err) {
    logger.error({ err }, "Scheduler tick failed");
  }
}

export function startScheduler() {
  if (timer) return;
  logger.info({ tickMs: TICK_MS }, "Starting posting scheduler");
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  void tick();
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
