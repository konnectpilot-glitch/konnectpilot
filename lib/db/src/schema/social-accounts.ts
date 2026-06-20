import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const socialAccountsTable = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id"),
  platform: text("platform").notNull(),
  // Distinguishes the kind of identity this row represents:
  //   "facebook_page"      — platformUserId = Page ID; accessToken = Page access token.
  //   "instagram_business" — platformUserId = IG Business account ID; accessToken =
  //                          parent Page's access token (IG publishing uses Page tokens).
  //   "linkedin_person"    — existing LinkedIn flow.
  // Nullable so legacy rows created before this column remain valid; publishers
  // branch on null vs set to preserve backward compatibility during transition.
  accountType: text("account_type"),
  platformUserId: text("platform_user_id").notNull(),
  accountName: text("account_name").notNull(),
  accountHandle: text("account_handle"),
  profilePictureUrl: text("profile_picture_url"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  // Per-row metadata. For facebook_page: { longLived, pictureUrl }.
  // For instagram_business: { linkedPageId, linkedPageName, igUsername }.
  // Free-form so we don't migrate every time Meta adds a field.
  platformMetadata: jsonb("platform_metadata"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
