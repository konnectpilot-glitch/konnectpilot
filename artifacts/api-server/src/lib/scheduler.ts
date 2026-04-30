import { eq, and } from "drizzle-orm";
import {
  db,
  postingSchedulesTable,
  brandsTable,
  socialAccountsTable,
  postsTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { publishToFacebook, publishToInstagram, publishToLinkedIn } from "./publishers";

const TICK_MS = 60_000;
const SLOT_TOLERANCE_MS = 5 * 60_000;
const STRICT_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

let timer: NodeJS.Timeout | null = null;

function buildCaption(brand: any, platform: string, prompt?: string | null): string {
  const platformInstructions: Record<string, string> = {
    instagram: "Write an engaging Instagram caption with 3-5 relevant hashtags. Max 200 words.",
    facebook: "Write a conversational Facebook post ending with an engaging question. Max 150 words.",
    linkedin: "Write a professional LinkedIn post with max 3 hashtags. Share insights. Max 200 words.",
  };
  const topicLine = prompt
    ? `Today's topic: ${prompt}`
    : "Choose a relevant topic based on the brand's industry and keywords.";
  return `You are a social media content writer for ${brand.name}, a ${brand.industry} business.

Brand details:
- Tone of voice: ${brand.tone}
- Target audience: ${brand.targetAudience}
- Keywords: ${brand.keywords}

Platform: ${platform}
${topicLine}

Instructions: ${platformInstructions[platform] ?? "Write a social media post."}

Write ONLY the post content. No preamble, no explanations.`;
}

function buildImagePrompt(brand: any, prompt?: string | null, style?: string | null): string {
  return `Create a visually striking professional social media image for ${brand.name}, a ${brand.industry} brand.
Style: ${style ?? `${brand.tone} tone, appealing to ${brand.targetAudience}`}.
${prompt ? `Theme: ${prompt}.` : ""}
Polished, brand-appropriate, scroll-stopping. No text overlays.`;
}

async function generateContent(brand: any, platform: string, contentPrompt?: string | null) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: buildCaption(brand, platform, contentPrompt) }],
  });
  return completion.choices[0]?.message?.content ?? "";
}

function buildImageUrl(prompt: string): string {
  const seed = Math.floor(Math.random() * 999_999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
}

async function prewarmImage(url: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
  } catch (err) {
    logger.warn({ err, url }, "Image pre-warm failed (continuing anyway)");
  }
}

async function publishOnePlatform(
  platform: string,
  account: typeof socialAccountsTable.$inferSelect,
  imageUrl: string,
  caption: string,
) {
  if (platform === "facebook") {
    return publishToFacebook({ userAccessToken: account.accessToken, imageUrl, caption });
  }
  if (platform === "instagram") {
    return publishToInstagram({ userAccessToken: account.accessToken, imageUrl, caption });
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
): Promise<number | null> {
  try {
    const [row] = await db
      .insert(postsTable)
      .values({
        brandId,
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

  const [account] = await db
    .select()
    .from(socialAccountsTable)
    .where(
      and(
        eq(socialAccountsTable.userId, schedule.userId),
        eq(socialAccountsTable.platform, platform),
        eq(socialAccountsTable.isActive, true),
      ),
    );
  if (!account) {
    await db
      .update(postsTable)
      .set({ status: "failed", errorMessage: `No connected ${platform} account.` })
      .where(eq(postsTable.id, postRowId));
    return;
  }

  const imagePrompt = buildImagePrompt(brand, schedule.contentPrompt, schedule.imageStyle);
  const imageUrl = buildImageUrl(imagePrompt);
  await prewarmImage(imageUrl);

  let caption = "";
  try {
    caption = await generateContent(brand, platform, schedule.contentPrompt);
  } catch (err: any) {
    await db
      .update(postsTable)
      .set({
        status: "failed",
        imageUrl,
        errorMessage: `Caption generation failed: ${err?.message ?? err}`,
      })
      .where(eq(postsTable.id, postRowId));
    return;
  }

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

    for (const schedule of activeSchedules) {
      const seenSlots = new Set<number>();
      for (const time of schedule.postTimes) {
        if (!STRICT_TIME_REGEX.test(time)) continue;
        const [hh, mm] = time.split(":").map(Number);

        const slotTime = new Date(now);
        slotTime.setUTCHours(hh, mm, 0, 0);
        const diffMs = now.getTime() - slotTime.getTime();
        if (diffMs < 0 || diffMs > SLOT_TOLERANCE_MS) continue;

        // de-dup duplicate times within the same schedule
        const key = slotTime.getTime();
        if (seenSlots.has(key)) continue;
        seenSlots.add(key);

        for (const platform of schedule.platforms) {
          const claimedId = await claimSlot(schedule.id, schedule.brandId, platform, slotTime);
          if (claimedId === null) continue; // already processed

          // Process in background; the row is already claimed so no double-fire risk
          void processClaimedSlot(schedule, platform, claimedId, slotTime).catch((err) => {
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
