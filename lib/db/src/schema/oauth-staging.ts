import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Holds intermediate state for multi-step OAuth flows (currently just Meta:
 * exchange code → fetch Pages + IG linkage → wait for user's Page selection →
 * insert social_accounts rows).
 *
 * Lifecycle:
 *  1. OAuth callback inserts a row with a fresh `ticket`, the user access
 *     token, and a snapshot of the user's Pages with their IG linkage.
 *  2. Frontend redirects to /accounts/connect/meta?ticket=...
 *  3. Picker UI reads the row via GET /api/social-accounts/staging/:ticket
 *  4. User submits selection via POST .../staging/:ticket/select
 *  5. Backend creates social_accounts rows + deletes the staging row.
 *
 * If the user abandons mid-flow, the row stays until expiresAt (5 min default)
 * and is cleaned up by a periodic sweep in the scheduler.
 */
export const oauthStagingTable = pgTable("oauth_staging", {
  id: serial("id").primaryKey(),
  // Random URL-safe string handed to the frontend so it can read this row.
  // Not the user token itself — that never leaves the server.
  ticket: text("ticket").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id"),
  // "meta" for now; reserved for future providers needing a similar flow.
  provider: text("provider").notNull(),
  userAccessToken: text("user_access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  // Pre-fetched data to drive the picker UI without re-querying Meta.
  // Shape for "meta": {
  //   pages: [{ pageId, pageName, pageAccessToken, pagePictureUrl,
  //             igAccount: { id, username, name, profilePictureUrl } | null }]
  // }
  fetchedPages: jsonb("fetched_pages").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type OauthStaging = typeof oauthStagingTable.$inferSelect;
