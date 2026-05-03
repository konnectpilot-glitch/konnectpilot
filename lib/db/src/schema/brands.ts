import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id"),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  tone: text("tone").notNull().default("friendly"),
  targetAudience: text("target_audience").notNull(),
  keywords: text("keywords").notNull(),
  platforms: text("platforms").array().notNull().default([]),
  postTime: text("post_time").notNull().default("09:00"),
  active: boolean("active").notNull().default(true),
  // "manual" — user reviews each post before publish.
  // "auto"   — AI second-pass validates against brand guidelines and auto-approves.
  approvalMode: text("approval_mode").notNull().default("manual"),
  // When true, the system pre-generates a rolling window of N days of posts
  // (15 for starter, 30 for pro/agency) into the approval queue.
  autoGenerateEnabled: boolean("auto_generate_enabled").notNull().default(false),
  lastBatchGeneratedAt: timestamp("last_batch_generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBrandSchema = createInsertSchema(brandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
