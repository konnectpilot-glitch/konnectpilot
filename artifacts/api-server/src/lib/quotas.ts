import { and, eq, gte, sql, inArray } from "drizzle-orm";
import { db, aiUsageTable } from "@workspace/db";
import type { AiUsageKind } from "@workspace/db";

export type Plan = "free" | "starter" | "pro" | "agency";

type Limits = { caption: number | null; image: number | null };

const PLAN_LIMITS: Record<Plan, Limits> = {
  free: { caption: 10, image: 5 },
  starter: { caption: 100, image: 50 },
  pro: { caption: 500, image: 250 },
  agency: { caption: null, image: null },
};

function quotaKey(kind: AiUsageKind): "caption" | "image" {
  return kind === "image" ? "image" : "caption";
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function getPlanLimits(plan: string): Limits {
  return PLAN_LIMITS[(plan as Plan) in PLAN_LIMITS ? (plan as Plan) : "free"];
}

export async function getUsageThisMonth(userId: number): Promise<{ caption: number; image: number }> {
  const since = startOfMonthUtc();
  const rows = await db
    .select({
      kind: aiUsageTable.kind,
      n: sql<number>`count(*)::int`,
    })
    .from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, userId), gte(aiUsageTable.createdAt, since)))
    .groupBy(aiUsageTable.kind);

  let caption = 0;
  let image = 0;
  for (const r of rows) {
    const bucket = quotaKey(r.kind as AiUsageKind);
    if (bucket === "caption") caption += Number(r.n);
    else image += Number(r.n);
  }
  return { caption, image };
}

export async function checkQuota(
  userId: number,
  plan: string,
  kind: AiUsageKind,
): Promise<{ allowed: boolean; used: number; limit: number | null; bucket: "caption" | "image" }> {
  const limits = getPlanLimits(plan);
  const bucket = quotaKey(kind);
  const limit = limits[bucket];
  if (limit === null) {
    return { allowed: true, used: 0, limit: null, bucket };
  }
  const usage = await getUsageThisMonth(userId);
  const used = usage[bucket];
  return { allowed: used < limit, used, limit, bucket };
}

export async function recordUsage(
  userId: number,
  kind: AiUsageKind,
  tokensUsed?: number,
): Promise<void> {
  await db.insert(aiUsageTable).values({ userId, kind, tokensUsed: tokensUsed ?? null });
}

/**
 * Atomically reserve a quota slot by inserting a usage row only if the user is
 * still under their monthly limit. Returns the inserted row id on success, or
 * { allowed: false, used, limit } if the limit is reached. If the caller's
 * downstream AI call fails, they should call `releaseReservation(id)` to roll
 * back. This eliminates the race between checkQuota + recordUsage.
 */
export async function reserveQuota(
  userId: number,
  plan: string,
  kind: AiUsageKind,
): Promise<
  | { allowed: true; reservationId: number; bucket: "caption" | "image" }
  | { allowed: false; used: number; limit: number; bucket: "caption" | "image" }
> {
  const limits = getPlanLimits(plan);
  const bucket = quotaKey(kind);
  const limit = limits[bucket];
  const since = startOfMonthUtc();

  if (limit === null) {
    const [row] = await db
      .insert(aiUsageTable)
      .values({ userId, kind })
      .returning({ id: aiUsageTable.id });
    return { allowed: true, reservationId: row.id, bucket };
  }

  const bucketKinds: AiUsageKind[] = bucket === "image" ? ["image"] : ["caption", "video_script"];

  const inserted = await db.execute(sql`
    INSERT INTO ai_usage (user_id, kind, tokens_used)
    SELECT ${userId}, ${kind}, NULL
    WHERE (
      SELECT COUNT(*) FROM ai_usage
      WHERE user_id = ${userId}
        AND kind IN (${sql.join(bucketKinds.map((k) => sql`${k}`), sql`, `)})
        AND created_at >= ${since}
    ) < ${limit}
    RETURNING id
  `);

  const rows = (inserted as any).rows ?? (inserted as any);
  const id = Array.isArray(rows) && rows[0] ? Number(rows[0].id) : null;

  if (id !== null) {
    return { allowed: true, reservationId: id, bucket };
  }

  const [{ used }] = await db
    .select({ used: sql<number>`count(*)::int` })
    .from(aiUsageTable)
    .where(
      and(
        eq(aiUsageTable.userId, userId),
        inArray(aiUsageTable.kind, bucketKinds),
        gte(aiUsageTable.createdAt, since),
      ),
    );

  return { allowed: false, used: Number(used), limit, bucket };
}

export async function releaseReservation(reservationId: number): Promise<void> {
  await db.delete(aiUsageTable).where(eq(aiUsageTable.id, reservationId));
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
