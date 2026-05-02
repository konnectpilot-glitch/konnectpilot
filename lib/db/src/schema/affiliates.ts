import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const affiliatesTable = pgTable(
  "affiliates",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    payoutMethod: text("payout_method"),
    paypalEmail: text("paypal_email"),
    stripeConnectAccountId: text("stripe_connect_account_id"),
    lifetimePaidCents: integer("lifetime_paid_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    affiliateUserUnique: uniqueIndex("affiliates_user_id_unique").on(t.userId),
    affiliateCodeUnique: uniqueIndex("affiliates_code_unique").on(t.code),
  }),
);

export const affiliateReferralsTable = pgTable(
  "affiliate_referrals",
  {
    id: serial("id").primaryKey(),
    affiliateId: integer("affiliate_id")
      .notNull()
      .references(() => affiliatesTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    referredUserId: integer("referred_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    visitorId: text("visitor_id"),
    clickAt: timestamp("click_at", { withTimezone: true }).notNull().defaultNow(),
    signupAt: timestamp("signup_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    status: text("status").notNull().default("clicked"),
  },
  (t) => ({
    affiliateIdx: index("affiliate_referrals_affiliate_idx").on(t.affiliateId),
    referredUserIdx: index("affiliate_referrals_user_idx").on(t.referredUserId),
    codeIdx: index("affiliate_referrals_code_idx").on(t.code),
  }),
);

export const affiliateCommissionsTable = pgTable(
  "affiliate_commissions",
  {
    id: serial("id").primaryKey(),
    affiliateId: integer("affiliate_id")
      .notNull()
      .references(() => affiliatesTable.id, { onDelete: "cascade" }),
    referralId: integer("referral_id")
      .notNull()
      .references(() => affiliateReferralsTable.id, { onDelete: "cascade" }),
    stripeInvoiceId: text("stripe_invoice_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    periodIndex: integer("period_index").notNull().default(0),
    status: text("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    affiliateStatusIdx: index("affiliate_commissions_affiliate_status_idx").on(
      t.affiliateId,
      t.status,
    ),
    invoiceUnique: uniqueIndex("affiliate_commissions_invoice_unique").on(
      t.stripeInvoiceId,
    ),
  }),
);

export type Affiliate = typeof affiliatesTable.$inferSelect;
export type AffiliateReferral = typeof affiliateReferralsTable.$inferSelect;
export type AffiliateCommission = typeof affiliateCommissionsTable.$inferSelect;
export type CommissionStatus = "pending" | "paid" | "reversed" | "void";
export type ReferralStatus = "clicked" | "signed_up" | "converted";
export type PayoutMethod = "paypal" | "stripe_connect";
