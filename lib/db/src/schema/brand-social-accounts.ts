import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";
import { socialAccountsTable } from "./social-accounts";

/**
 * Many-to-many assignment between brands and connected social accounts.
 *
 * Rationale: social_accounts live at the workspace level (so an agency can
 * connect one LinkedIn page and use it across many brands), but publishing
 * for a brand should be deterministic — only accounts EXPLICITLY assigned
 * to a brand are eligible. This table is the authoritative source of which
 * accounts a brand may publish from.
 *
 * Backfill on first deploy: every existing social_account is assigned to
 * every brand in the same workspace, preserving today's behavior.
 *
 * Cascade rules: if a brand or social_account is deleted, the assignment
 * rows go with them; we never want dangling references that publishers
 * would silently skip.
 */
export const brandSocialAccountsTable = pgTable(
  "brand_social_accounts",
  {
    brandId: integer("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    socialAccountId: integer("social_account_id")
      .notNull()
      .references(() => socialAccountsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.brandId, t.socialAccountId] }),
  }),
);

export type BrandSocialAccount = typeof brandSocialAccountsTable.$inferSelect;
