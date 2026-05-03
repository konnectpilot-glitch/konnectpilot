import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Idempotency ledger for Stripe webhook events. Inserting a row with the
// Stripe event id acts as a "process once" guard — duplicate deliveries
// (which Stripe explicitly retries) become no-ops because of the PK conflict.
export const processedStripeEventsTable = pgTable("processed_stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
