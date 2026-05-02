import { Router, type IRouter } from "express";
import { requireAuth, ensureUser } from "./users";
import { getPlanLimits, getUsageThisMonth } from "../lib/quotas";

const router: IRouter = Router();

router.get("/usage/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const limits = getPlanLimits(user.plan);
  const usage = await getUsageThisMonth(user.id);
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  res.json({
    plan: user.plan,
    captionUsed: usage.caption,
    captionLimit: limits.caption,
    imageUsed: usage.image,
    imageLimit: limits.image,
    periodStart: periodStart.toISOString(),
  });
});

export default router;
