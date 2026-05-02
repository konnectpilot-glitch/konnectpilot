import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const socialAccountsTable = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id"),
  platform: text("platform").notNull(),
  platformUserId: text("platform_user_id").notNull(),
  accountName: text("account_name").notNull(),
  accountHandle: text("account_handle"),
  profilePictureUrl: text("profile_picture_url"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
