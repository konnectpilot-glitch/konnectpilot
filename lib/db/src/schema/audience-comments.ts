import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";
import { postsTable } from "./posts";

/**
 * Audience comments — comments left by real people on the brand's published
 * posts, fetched from FB Page Graph API + IG Business Graph API by the
 * background collector. Distinct from `post_comments` (which is internal
 * team-collaboration on drafts).
 *
 * Dedup key: (platform, platformCommentId) so re-polls don't insert dupes.
 * Index on (brandId, repliedAt) drives the inbox query — show me the
 * unreplied comments for this workspace's brands, newest first.
 */
export const audienceCommentsTable = pgTable(
  "audience_comments",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // facebook | instagram | linkedin
    platformCommentId: text("platform_comment_id").notNull(),
    authorName: text("author_name"),
    authorId: text("author_id"), // platform's user id (FB asid / IG id)
    content: text("content").notNull(),
    // null = unreplied. ISO timestamp once we've sent a reply (or marked
    // as handled without replying).
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    repliedBy: integer("replied_by"), // user id of the operator who handled it
    // The reply content we sent — useful for audit + feeding back into
    // brand-memory once we wire that loop.
    replyContent: text("reply_content"),
    // null = active. set when user dismisses without replying (spam / not relevant).
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // Original create-time from the platform (FB/IG returns this).
    platformCreatedAt: timestamp("platform_created_at", { withTimezone: true }),
  },
  (t) => ({
    // Dedup — same comment can be re-fetched many times; the unique index
    // makes insert-on-conflict-do-nothing idempotent.
    dedup: uniqueIndex("audience_comments_platform_id_unique").on(t.platform, t.platformCommentId),
    // Drives the inbox query (workspace's brands → unreplied → newest first).
    inboxIdx: index("audience_comments_inbox_idx").on(t.brandId, t.repliedAt, t.dismissedAt),
    postIdx: index("audience_comments_post_idx").on(t.postId, t.fetchedAt),
  }),
);

export type AudienceComment = typeof audienceCommentsTable.$inferSelect;
