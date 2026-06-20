// Audience comment collector — polls FB Page Graph API + IG Business Graph
// API for new comments on each published post and stores them in
// audience_comments. Runs as a tick alongside the existing analytics
// scheduler.
//
// Strategy:
//   - Only poll posts published in the last 14 days (older posts get few
//     new comments; saves API quota)
//   - One tick = at most N posts per platform (work-cap to stay under
//     Meta's per-app rate limits)
//   - DB-level dedup via the (platform, platformCommentId) unique index
//   - Errors are logged but never throw — a single bad token shouldn't
//     stop the whole tick

import { and, eq, isNotNull, gte, desc, isNull } from "drizzle-orm";
import {
  db,
  postsTable,
  brandsTable,
  socialAccountsTable,
  brandSocialAccountsTable,
  audienceCommentsTable,
} from "@workspace/db";
import { logger } from "./logger";

const TICK_MS = 10 * 60_000; // 10 min
const POSTS_PER_PLATFORM_PER_TICK = 25;
const COMMENT_FRESH_WINDOW_DAYS = 14;
const COMMENT_FIELDS = "id,from,message,created_time";

interface RawComment {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
}

async function fetchFacebookComments(platformPostId: string, pageAccessToken: string): Promise<RawComment[]> {
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(platformPostId)}/comments?fields=${COMMENT_FIELDS}&order=reverse_chronological&limit=25&access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FB comments HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchInstagramComments(platformPostId: string, accessToken: string): Promise<RawComment[]> {
  // IG returns "username" not "name", and timestamp not created_time, so
  // we shim each response into the same shape as FB.
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(platformPostId)}/comments?fields=id,text,username,timestamp&limit=25&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IG comments HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const raw = Array.isArray(json?.data) ? json.data : [];
  return raw.map((c: any) => ({
    id: String(c.id),
    message: c.text ?? "",
    created_time: c.timestamp,
    from: c.username ? { name: c.username } : undefined,
  }));
}

async function pollPlatform(platform: "facebook" | "instagram") {
  const fresh = new Date(Date.now() - COMMENT_FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Pull the most recently published posts on this platform that still have
  // a platformPostId (i.e. they actually published successfully).
  const rows = await db
    .select({
      postId: postsTable.id,
      brandId: postsTable.brandId,
      workspaceId: postsTable.workspaceId,
      platformPostId: postsTable.platformPostId,
      publishedAt: postsTable.publishedAt,
    })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.platform, platform),
        eq(postsTable.status, "published"),
        isNotNull(postsTable.platformPostId),
        gte(postsTable.publishedAt, fresh),
      ),
    )
    .orderBy(desc(postsTable.publishedAt))
    .limit(POSTS_PER_PLATFORM_PER_TICK);

  if (rows.length === 0) return;

  for (const post of rows) {
    if (!post.platformPostId) continue;

    // Find a social account assigned to this brand on this platform.
    const [acct] = await db
      .select({
        token: socialAccountsTable.accessToken,
        accountId: socialAccountsTable.id,
      })
      .from(brandSocialAccountsTable)
      .innerJoin(
        socialAccountsTable,
        eq(socialAccountsTable.id, brandSocialAccountsTable.socialAccountId),
      )
      .where(
        and(
          eq(brandSocialAccountsTable.brandId, post.brandId),
          eq(socialAccountsTable.platform, platform),
          eq(socialAccountsTable.isActive, true),
        ),
      )
      .limit(1);
    if (!acct?.token) continue;

    let comments: RawComment[];
    try {
      comments = platform === "facebook"
        ? await fetchFacebookComments(post.platformPostId, acct.token)
        : await fetchInstagramComments(post.platformPostId, acct.token);
    } catch (err: any) {
      logger.warn({ err: err?.message, postId: post.postId, platform }, "Comment fetch failed");
      continue;
    }

    // Insert all comments; dedup index makes re-polls cheap.
    for (const c of comments) {
      if (!c.id || !c.message) continue;
      try {
        await db
          .insert(audienceCommentsTable)
          .values({
            brandId: post.brandId,
            postId: post.postId,
            platform,
            platformCommentId: c.id,
            authorName: c.from?.name ?? null,
            authorId: c.from?.id ?? null,
            content: c.message.slice(0, 4000),
            platformCreatedAt: c.created_time ? new Date(c.created_time) : null,
          })
          .onConflictDoNothing();
      } catch (err: any) {
        logger.warn({ err: err?.message, commentId: c.id }, "Comment insert failed");
      }
    }
  }
}

async function tick(): Promise<void> {
  try {
    await pollPlatform("facebook");
  } catch (err: any) {
    logger.error({ err: err?.message }, "Comment collector FB tick failed");
  }
  try {
    await pollPlatform("instagram");
  } catch (err: any) {
    logger.error({ err: err?.message }, "Comment collector IG tick failed");
  }
}

let started = false;
export function startCommentCollector() {
  if (started) return;
  started = true;
  // Initial tick after 60s startup grace so we don't pile load on boot.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, 60_000);
  logger.info("Comment collector started");
}

// Keep `isNull` import live for future "only unreplied" filter use.
void isNull;
