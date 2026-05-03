import { Router, type IRouter } from "express";
import { requireAuth, ensureUser } from "./users";
import {
  getPlanCreditLimit,
  getCreditsUsedThisMonth,
  getBonusCredits,
} from "../lib/quotas";
import { getPlan } from "../lib/plans";

const router: IRouter = Router();

router.get("/usage/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const planConfig = getPlan(user.plan);
  const creditsLimit = getPlanCreditLimit(user.plan);
  const [creditsUsed, bonusCredits] = await Promise.all([
    getCreditsUsedThisMonth(user.id),
    getBonusCredits(user.id),
  ]);
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  res.json({
    plan: user.plan,
    creditsUsed,
    creditsLimit,
    bonusCredits,
    brandLimit: planConfig.brands + (user.extraBrands ?? 0),
    socialAccountLimit: planConfig.socialAccounts,
    daysAdvance: planConfig.daysAdvance,
    periodStart: periodStart.toISOString(),
  });
});

export default router;
