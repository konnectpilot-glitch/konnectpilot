import { pgTable, serial, integer, text, timestamp, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";
import { postsTable } from "./posts";

/**
 * Brand Memory Profile — a learned style profile for each brand, updated
 * every time the user approves, edits, or rejects a generated post. Future
 * generations use this profile as additional prompt context so the AI
 * matches the user's actual preferred style over time.
 */
export const brandMemoryProfilesTable = pgTable(
  "brand_memory_profiles",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    // Last N approved post snippets — short, high-signal examples.
    approvedSamples: text("approved_samples").array().notNull().default([]),
    // Last N rejected snippets so we can tell the model what to avoid.
    rejectedSamples: text("rejected_samples").array().notNull().default([]),
    // Diffs between original generation and user edit, e.g.
    //   { from: "Check out our sale!", to: "Don't miss our sale - ends Friday." }
    editPatterns: jsonb("edit_patterns").$type<Array<{ from: string; to: string }>>().notNull().default([]),
    // Free-form learned guidance the AI distills from feedback signals.
    distilledGuidelines: text("distilled_guidelines"),
    approvedCount: integer("approved_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    editedCount: integer("edited_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandUnique: uniqueIndex("brand_memory_brand_unique").on(t.brandId),
  }),
);

/**
 * Per-event feedback log used to drive the brand memory profile.
 */
export const postFeedbackEventsTable = pgTable(
  "post_feedback_events",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    // approved | rejected | edited | auto_approved | auto_rejected
    action: text("action").notNull(),
    reason: text("reason"),
    originalContent: text("original_content"),
    finalContent: text("final_content"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdx: index("post_feedback_brand_idx").on(t.brandId, t.createdAt),
    postIdx: index("post_feedback_post_idx").on(t.postId),
  }),
);

export type BrandMemoryProfile = typeof brandMemoryProfilesTable.$inferSelect;
export type PostFeedbackEvent = typeof postFeedbackEventsTable.$inferSelect;
export type FeedbackAction = "approved" | "rejected" | "edited" | "auto_approved" | "auto_rejected";
