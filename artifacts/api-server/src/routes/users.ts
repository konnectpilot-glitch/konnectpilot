import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Ensure user exists in DB (upsert on first request)
async function ensureUser(clerkId: string, email: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) return existing;
  const [created] = await db
    .insert(usersTable)
    .values({ clerkId, email, plan: "free" })
    .returning();
  return created;
}

export async function requireAuth(req: any, res: any, next: any): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  req.clerkEmail = (auth.sessionClaims?.email as string) || "";

  // Impersonation: a superadmin can pass X-Impersonate-User-Id to act as
  // another user for the duration of the request. We validate the requester
  // is a superadmin server-side and swap the effective Clerk identity to the
  // target user's. The original admin id is preserved on req.actualAdminId
  // for audit logging.
  const impersonateRaw = req.header("X-Impersonate-User-Id");
  if (impersonateRaw) {
    const targetId = parseInt(String(impersonateRaw), 10);
    if (!Number.isNaN(targetId)) {
      const requester = await ensureUser(req.clerkUserId, req.clerkEmail);
      if (requester.isSuperadmin) {
        const [target] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, targetId));
        if (target && target.id !== requester.id) {
          req.actualAdminId = requester.id;
          req.actualAdminEmail = requester.email;
          req.clerkUserId = target.clerkId;
          req.clerkEmail = target.email;
          req.isImpersonating = true;
          logger.info(
            { adminId: requester.id, targetUserId: target.id, path: req.path },
            "Admin impersonating user",
          );
        }
      }
    }
  }
  next();
}

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  res.json(GetMeResponse.parse({
    ...user,
    isSuperadmin: user.isSuperadmin,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
});

export async function requireSuperadmin(req: any, res: any, next: any): Promise<void> {
  if (!req.clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  if (!user.isSuperadmin) {
    res.status(403).json({ error: "Forbidden: superadmin only" });
    return;
  }
  req.adminUser = user;
  next();
}

router.patch("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(UpdateMeResponse.parse({
    ...updated,
    trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  }));
});

export { ensureUser };
export default router;
