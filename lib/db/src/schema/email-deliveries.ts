import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Tracks which transactional / lifecycle emails have been delivered to which
 * users. Used purely for deduplication — we never want to send the same Day-1
 * nudge to the same user twice if the cron is retried or runs slightly
 * overlapping windows.
 *
 * One row per (userId, kind) pair. Insert with onConflictDoNothing — the PK
 * acts as the dedupe guarantee at the database level, not just in app logic.
 *
 * "kind" values used by the nudge scheduler:
 *   - "welcome"               sent immediately on signup (from users.ts)
 *   - "day1_first_post"       Day-1 first-post nudge
 *   - "day3_brand_intel"      Day-3 brand intelligence preview
 *   - "day13_trial_expiring"  Day-13 trial expiring reminder
 */
export const emailDeliveriesTable = pgTable(
  "email_deliveries",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    resendMessageId: text("resend_message_id"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.kind] }),
  }),
);

export type EmailDelivery = typeof emailDeliveriesTable.$inferSelect;
