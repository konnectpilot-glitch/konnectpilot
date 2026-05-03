import { and, eq, gte, sql } from "drizzle-orm";
import { db, aiUsageTable, usersTable } from "@workspace/db";
import type { AiUsageKind } from "@workspace/db";
import { getPlan, CREDIT_COST, type CreditOp } from "./plans";

// Stable hash from a numeric user id to a 32-bit signed int suitable for
// pg_advisory_xact_lock. user.id is already an int32 so we can pass it
// directly, but the cast guards future migrations to bigint.
function userLockKey(userId: number): number {
  return userId | 0;
}

export type Plan = "free" | "starter" | "pro" | "agency";

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function getPlanCreditLimit(plan: string): number {
  return getPlan(plan).credits;
}

export async function getCreditsUsedThisMonth(userId: number): Promise<number> {
  const since = startOfMonthUtc();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${aiUsageTable.creditCost}), 0)::float`,
    })
    .from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, userId), gte(aiUsageTable.createdAt, since)));
  return Number(row?.total ?? 0);
}

export async function getBonusCredits(userId: number): Promise<number> {
  const [u] = await db
    .select({ bonus: usersTable.bonusCredits })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return Number(u?.bonus ?? 0);
}

/**
 * Atomically reserve credits by inserting a usage row only if the user still
 * has either monthly allocation OR top-up balance to cover the cost. Returns
 * the inserted row id on success, or { allowed: false, ... } if exhausted.
 *
 * Bonus (top-up) credits are debited from `users.bonus_credits` BEFORE
 * inserting the usage row, but only if the monthly allocation is short by the
 * full cost. Partial coverage is not supported per the spec — each operation
 * is charged as a single atomic unit.
 *
 * On AI failure the caller must call `releaseReservation(id)` which also
 * refunds the bonus credit if one was used.
 */
export async function reserveQuota(
  userId: number,
  plan: string,
  kind: AiUsageKind,
  op: CreditOp = kind === "image" ? "image_post" : kind === "blog" ? "blog" : "text_post",
): Promise<
  | { allowed: true; reservationId: number; cost: number; usedBonus: boolean }
  | { allowed: false; used: number; limit: number; bonus: number; cost: number }
> {
  const cost = CREDIT_COST[op];
  const limit = getPlanCreditLimit(plan);
  const since = startOfMonthUtc();

  // Serialize per-user credit accounting via pg_advisory_xact_lock so two
  // concurrent generations cannot both pass the limit check and overspend.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userLockKey(userId)})`);

    const usedRows = await tx.execute<{ total: number }>(sql`
      SELECT COALESCE(SUM(credit_cost), 0)::float AS total
      FROM ai_usage
      WHERE user_id = ${userId} AND created_at >= ${since}
    `);
    const monthlyUsed = Number(usedRows.rows[0]?.total ?? 0);

    // Prefer monthly allocation, fall back to bonus credits.
    if (monthlyUsed + cost <= limit) {
      const inserted = await tx
        .insert(aiUsageTable)
        .values({ userId, kind, creditCost: cost })
        .returning({ id: aiUsageTable.id });
      return {
        allowed: true as const,
        reservationId: inserted[0].id,
        cost,
        usedBonus: false,
      };
    }

    const debit = await tx.execute<{ id: number }>(sql`
      UPDATE users
      SET bonus_credits = bonus_credits - ${cost}
      WHERE id = ${userId} AND bonus_credits >= ${cost}
      RETURNING id
    `);
    if (debit.rows[0]) {
      const inserted = await tx
        .insert(aiUsageTable)
        .values({ userId, kind, creditCost: cost })
        .returning({ id: aiUsageTable.id });
      return {
        allowed: true as const,
        reservationId: inserted[0].id,
        cost,
        usedBonus: true,
      };
    }

    const [u] = await tx
      .select({ bonus: usersTable.bonusCredits })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    return {
      allowed: false as const,
      used: monthlyUsed,
      limit,
      bonus: Number(u?.bonus ?? 0),
      cost,
    };
  });
}

export async function releaseReservation(
  reservationId: number,
  refundBonus = false,
): Promise<void> {
  // Fetch first to know the cost in case we need to refund a bonus debit.
  const [row] = await db
    .select({ userId: aiUsageTable.userId, cost: aiUsageTable.creditCost })
    .from(aiUsageTable)
    .where(eq(aiUsageTable.id, reservationId));
  await db.delete(aiUsageTable).where(eq(aiUsageTable.id, reservationId));
  if (refundBonus && row) {
    await db.execute(sql`
      UPDATE users SET bonus_credits = bonus_credits + ${row.cost}
      WHERE id = ${row.userId}
    `);
  }
}

export async function setReservationTokens(
  reservationId: number,
  tokensUsed: number | undefined,
): Promise<void> {
  if (tokensUsed === undefined) return;
  await db
    .update(aiUsageTable)
    .set({ tokensUsed })
    .where(eq(aiUsageTable.id, reservationId));
}

export async function addBonusCredits(userId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db.execute(sql`
    UPDATE users SET bonus_credits = bonus_credits + ${amount} WHERE id = ${userId}
  `);
}
