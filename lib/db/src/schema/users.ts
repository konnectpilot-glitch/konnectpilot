import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  plan: text("plan").notNull().default("free"),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  // Top-up credits purchased outside the monthly subscription. Roll over
  // month-to-month and are consumed AFTER the monthly allocation is exhausted.
  bonusCredits: real("bonus_credits").notNull().default(0),
  // Add-on capacity stacked on top of the plan's brand / seat limits ($5/mo each).
  extraBrands: integer("extra_brands").notNull().default(0),
  extraSeats: integer("extra_seats").notNull().default(0),
  activeWorkspaceId: integer("active_workspace_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
