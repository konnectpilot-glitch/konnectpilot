import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";
import { postsTable } from "./posts";
import { socialAccountsTable } from "./social-accounts";

/**
 * Raw per-pull metrics snapshot for a single post on a single platform.
 * Pruned to last ~90 days; long-term trend lives in `postDailyAggregatesTable`.
 */
export const postMetricsSnapshotsTable = pgTable(
  "post_metrics_snapshots",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformPostId: text("platform_post_id"),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    videoViews: integer("video_views").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    engagementRate: doublePrecision("engagement_rate").notNull().default(0),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index("metrics_post_idx").on(t.postId, t.fetchedAt),
    brandIdx: index("metrics_brand_idx").on(t.brandId, t.fetchedAt),
  }),
);

/**
 * Daily rollup per brand+platform. Cheap to query for trend charts.
 */
export const brandDailyAggregatesTable = pgTable(
  "brand_daily_aggregates",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    day: text("day").notNull(), // YYYY-MM-DD UTC
    posts: integer("posts").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    engagementRate: doublePrecision("engagement_rate").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniq: uniqueIndex("brand_day_platform_unique").on(t.brandId, t.platform, t.day),
  }),
);

/**
 * Daily follower count snapshot per connected social account.
 */
export const followerHistoryTable = pgTable(
  "follower_history",
  {
    id: serial("id").primaryKey(),
    socialAccountId: integer("social_account_id")
      .notNull()
      .references(() => socialAccountsTable.id, { onDelete: "cascade" }),
    brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    day: text("day").notNull(),
    followers: integer("followers").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("follower_account_day_unique").on(t.socialAccountId, t.day),
    brandIdx: index("follower_brand_idx").on(t.brandId, t.day),
  }),
);

/**
 * Performance Memory — a sibling to Brand Memory Profile that captures what
 * actually performs well on each brand's audience. Read alongside
 * brand_memory_profiles when generating posts.
 */
export const brandPerformanceMemoryTable = pgTable(
  "brand_performance_memory",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    // Top exemplar posts (post id + summary), most recent at top.
    topExemplars: jsonb("top_exemplars")
      .$type<Array<{ postId: number; platform: string; content: string; score: number; metrics: Record<string, number> }>>()
      .notNull()
      .default([]),
    // Aggregate insights derived from top performers.
    bestHoursByPlatform: jsonb("best_hours_by_platform")
      .$type<Record<string, number[]>>() // e.g. { instagram: [9, 18], facebook: [12] }
      .notNull()
      .default({}),
    bestContentTypesByPlatform: jsonb("best_content_types_by_platform")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    winningHashtags: jsonb("winning_hashtags").$type<string[]>().notNull().default([]),
    winningHookTemplates: jsonb("winning_hook_templates").$type<string[]>().notNull().default([]),
    // Distilled style+strategy guide derived from the above (LLM output).
    distilledStrategy: text("distilled_strategy"),
    samplesAnalyzed: integer("samples_analyzed").notNull().default(0),
    lastDistilledAt: timestamp("last_distilled_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandUnique: uniqueIndex("brand_perf_memory_unique").on(t.brandId),
  }),
);

/**
 * AI-generated insight / recommendation row. The dashboard reads + dismisses these.
 */
export const aiInsightsTable = pgTable(
  "ai_insights",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    postId: integer("post_id").references(() => postsTable.id, { onDelete: "set null" }),
    // caption_rewrite | hashtag_swap | best_time | content_mix | seo_blog | general
    kind: text("kind").notNull(),
    severity: text("severity").notNull().default("info"), // info | suggestion | critical
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Structured payload the UI/generator can apply (e.g. suggested caption text).
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    // Snapshot of the affected resource captured immediately before apply,
    // used by the /undo endpoint within 24h to restore previous state.
    undoPayload: jsonb("undo_payload").$type<Record<string, unknown>>(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdx: index("ai_insights_brand_idx").on(t.brandId, t.createdAt),
    activeIdx: index("ai_insights_active_idx").on(t.brandId, t.dismissedAt),
  }),
);

/**
 * Generated weekly/monthly reports.
 */
export const analyticsReportsTable = pgTable(
  "analytics_reports",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // weekly | monthly
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    html: text("html"),
    emailOptIn: boolean("email_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdx: index("reports_brand_idx").on(t.brandId, t.createdAt),
  }),
);

/**
 * Bookkeeping for the metric-collector scheduler. One row per (post, platform).
 * `nextFetchAt` controls decaying-frequency polling; `lastFetchedAt` makes
 * restarts idempotent.
 */
export const metricFetchCursorsTable = pgTable(
  "metric_fetch_cursors",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    nextFetchAt: timestamp("next_fetch_at", { withTimezone: true }).notNull().defaultNow(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    failures: integer("failures").notNull().default(0),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }), // stop polling after window
  },
  (t) => ({
    uniq: uniqueIndex("metric_cursor_post_platform_unique").on(t.postId, t.platform),
    nextIdx: index("metric_cursor_next_idx").on(t.nextFetchAt),
  }),
);

export type PostMetricsSnapshot = typeof postMetricsSnapshotsTable.$inferSelect;
export type BrandDailyAggregate = typeof brandDailyAggregatesTable.$inferSelect;
export type FollowerHistory = typeof followerHistoryTable.$inferSelect;
export type BrandPerformanceMemory = typeof brandPerformanceMemoryTable.$inferSelect;
export type AiInsight = typeof aiInsightsTable.$inferSelect;
export type AnalyticsReport = typeof analyticsReportsTable.$inferSelect;
export type MetricFetchCursor = typeof metricFetchCursorsTable.$inferSelect;
