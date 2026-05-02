import { eq, and } from "drizzle-orm";
import {
  db,
  affiliatesTable,
  affiliateReferralsTable,
  type Affiliate,
} from "@workspace/db";

const COMMISSION_RATE = 0.3;
const COMMISSION_MONTHS = 12;

export const AFFILIATE_CONFIG = {
  rate: COMMISSION_RATE,
  months: COMMISSION_MONTHS,
  minPayoutCents: 5000,
  cookieDays: 60,
};

function randomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `KP-${out}`;
}

/**
 * Get or create the affiliate row for a user. Each user gets a unique
 * referral code on first call.
 */
export async function ensureAffiliate(userId: number): Promise<Affiliate> {
  const [existing] = await db
    .select()
    .from(affiliatesTable)
    .where(eq(affiliatesTable.userId, userId));
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const [created] = await db
        .insert(affiliatesTable)
        .values({ userId, code })
        .returning();
      return created;
    } catch (err) {
      // Unique violation on code or userId — retry on code, return existing on userId
      const [retry] = await db
        .select()
        .from(affiliatesTable)
        .where(eq(affiliatesTable.userId, userId));
      if (retry) return retry;
    }
  }
  throw new Error("Failed to allocate referral code");
}

export async function findAffiliateByCode(code: string): Promise<Affiliate | null> {
  const [row] = await db
    .select()
    .from(affiliatesTable)
    .where(eq(affiliatesTable.code, code));
  return row ?? null;
}

/**
 * Returns the active referral row for a referred user (the one that has not
 * yet been attributed to a different affiliate). Used to compute commissions
 * on Stripe invoice events.
 */
export async function findReferralForUser(referredUserId: number) {
  const [row] = await db
    .select()
    .from(affiliateReferralsTable)
    .where(eq(affiliateReferralsTable.referredUserId, referredUserId));
  return row ?? null;
}

/**
 * Returns the index (0-based) of the commission period the given date falls
 * into relative to the conversion date, or null if outside the eligible
 * window.
 */
export function commissionPeriodFor(
  convertedAt: Date,
  invoiceDate: Date,
): number | null {
  const monthsDiff =
    (invoiceDate.getUTCFullYear() - convertedAt.getUTCFullYear()) * 12 +
    (invoiceDate.getUTCMonth() - convertedAt.getUTCMonth());
  if (monthsDiff < 0 || monthsDiff >= COMMISSION_MONTHS) return null;
  return monthsDiff;
}

export function computeCommissionCents(invoiceTotalCents: number): number {
  return Math.round(invoiceTotalCents * COMMISSION_RATE);
}
