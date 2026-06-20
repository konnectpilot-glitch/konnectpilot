import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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
  // Phase 1 brand-redesign fields (BRAND_REDESIGN.md). Nullable so existing
  // brand records remain valid; buildPrompt prefers these when populated.
  voiceDescription: text("voice_description"),
  examplePosts: text("example_posts"),
  doDontRules: text("do_dont_rules"),
  // Phase 2 brand-redesign fields (BRAND_REDESIGN.md, line 292-298).
  // logoUrl: pasted image URL; passed to nano-banana-2 as reference image.
  // brandColor*: hex like #ff5500; injected into image prompt.
  // contentPillars: {educate, spotlight, reviews, bts, promo} percentages
  //   summing to 100; scheduler uses weighted random to pick a pillar per post.
  // platformOverrides: {instagram, facebook, linkedin} optional tone tweaks
  //   that override voiceDescription on a per-platform basis.
  // Phase 2 brand-redesign: up to 3 logo variants (primary, monochrome, square)
  // stored as base64 data URIs. Each item is `data:<mime>;base64,<...>`.
  // MVP storage — bytes live in the brand row. Move to R2/S3 before scaling.
  logos: text("logos").array(),
  websiteUrl: text("website_url"),
  brandColorPrimary: text("brand_color_primary"),
  brandColorSecondary: text("brand_color_secondary"),
  contentPillars: jsonb("content_pillars").$type<{
    educate: number;
    spotlight: number;
    reviews: number;
    bts: number;
    promo: number;
  }>(),
  platformOverrides: jsonb("platform_overrides").$type<Record<string, string>>(),
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
