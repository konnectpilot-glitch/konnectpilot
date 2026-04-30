import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const postsTable = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
    scheduleId: integer("schedule_id"),
    platform: text("platform").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    status: text("status").notNull().default("generated"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    platformPostId: text("platform_post_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    // Unique slot claim — scheduler inserts a row per (schedule, slot, platform);
    // concurrent ticks racing to insert the same slot get a unique violation
    // and bail out, preventing double publishing.
    scheduleSlotUnique: uniqueIndex("posts_schedule_slot_unique_idx").on(
      t.scheduleId,
      t.scheduledFor,
      t.platform,
    ),
  }),
);

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
