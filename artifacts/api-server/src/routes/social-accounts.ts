import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, socialAccountsTable } from "@workspace/db";
import { requireAuth, ensureUser } from "./users";

const router: IRouter = Router();

const OAUTH_CONFIG: Record<string, { envKey: string; authUrl: (redirectUri: string, state: string) => string }> = {
  facebook: {
    envKey: "FACEBOOK_APP_ID",
    authUrl: (redirectUri, state) =>
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement&response_type=code&state=${state}`,
  },
  instagram: {
    envKey: "FACEBOOK_APP_ID",
    authUrl: (redirectUri, state) =>
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_content_publish&response_type=code&state=${state}`,
  },
  linkedin: {
    envKey: "LINKEDIN_CLIENT_ID",
    authUrl: (redirectUri, state) =>
      `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=w_member_social+r_liteprofile+r_emailaddress&state=${state}`,
  },
  tiktok: {
    envKey: "TIKTOK_CLIENT_KEY",
    authUrl: (redirectUri, state) =>
      `https://www.tiktok.com/v2/auth/authorize?client_key=${process.env.TIKTOK_CLIENT_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user.info.basic,video.publish&response_type=code&state=${state}`,
  },
};

router.post("/social-accounts/connect", requireAuth, async (req: any, res): Promise<void> => {
  const { platform } = req.body ?? {};
  const config = OAUTH_CONFIG[platform as string];
  if (!config) {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }
  if (!process.env[config.envKey]) {
    res.status(503).json({ error: "not_configured" });
    return;
  }
  const state = Buffer.from(JSON.stringify({ platform, userId: req.clerkUserId })).toString("base64url");
  const appUrl = process.env.APP_URL ?? `https://${req.headers.host}`;
  const redirectUri = `${appUrl}/api/social-accounts/callback/${platform}`;
  res.json({ url: config.authUrl(redirectUri, state) });
});

router.get("/social-accounts/callback/:platform", async (_req, res): Promise<void> => {
  res.redirect("/accounts?connected=1");
});

router.post("/social-accounts/manual-connect", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const { platform, accountName, accountHandle } = req.body ?? {};

  if (!platform || typeof platform !== "string" || !OAUTH_CONFIG[platform]) {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }
  if (!accountName || typeof accountName !== "string" || !accountName.trim()) {
    res.status(400).json({ error: "Account name is required" });
    return;
  }

  const trimmedName = accountName.trim();
  const trimmedHandle = typeof accountHandle === "string" ? accountHandle.trim() : "";

  const [account] = await db
    .insert(socialAccountsTable)
    .values({
      userId: user.id,
      platform,
      platformUserId: `manual-${platform}-${Date.now()}`,
      accountName: trimmedName,
      accountHandle: trimmedHandle || null,
      accessToken: "manual:no-token",
      isActive: true,
    })
    .returning();

  res.status(201).json({
    id: account.id,
    platform: account.platform,
    accountName: account.accountName,
    accountHandle: account.accountHandle,
    profilePictureUrl: account.profilePictureUrl,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
  });
});

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
