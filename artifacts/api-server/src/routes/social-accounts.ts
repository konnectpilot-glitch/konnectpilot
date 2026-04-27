import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, socialAccountsTable } from "@workspace/db";
import { requireAuth, ensureUser } from "./users";

const router: IRouter = Router();

router.get("/social-accounts", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const accounts = await db
    .select({
      id: socialAccountsTable.id,
      platform: socialAccountsTable.platform,
      accountName: socialAccountsTable.accountName,
      accountHandle: socialAccountsTable.accountHandle,
      profilePictureUrl: socialAccountsTable.profilePictureUrl,
      isActive: socialAccountsTable.isActive,
      createdAt: socialAccountsTable.createdAt,
    })
    .from(socialAccountsTable)
    .where(eq(socialAccountsTable.userId, user.id))
    .orderBy(socialAccountsTable.createdAt);

  res.json(accounts.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.delete("/social-accounts/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(socialAccountsTable)
    .where(and(eq(socialAccountsTable.id, id), eq(socialAccountsTable.userId, user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
