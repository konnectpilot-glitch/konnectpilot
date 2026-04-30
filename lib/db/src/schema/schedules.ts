import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { brandsTable } from "./brands";

export const postingSchedulesTable = pgTable("posting_schedules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  platforms: text("platforms").array().notNull().default([]),
  postTimes: text("post_times").array().notNull().default([]),
  timezone: text("timezone").notNull().default("UTC"),
  contentPrompt: text("content_prompt"),
  imageStyle: text("image_style"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PostingSchedule = typeof postingSchedulesTable.$inferSelect;
export type InsertPostingSchedule = typeof postingSchedulesTable.$inferInsert;
