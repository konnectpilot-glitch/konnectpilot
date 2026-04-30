import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { db, socialAccountsTable, usersTable } from "@workspace/db";
import { requireAuth, ensureUser } from "./users";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const STATE_SECRET = process.env.SESSION_SECRET ?? "dev-state-secret-change-me";

function signState(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): { platform: string; clerkUserId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

type PlatformConfig = {
  envKeys: string[];
  scope: string;
  authUrl: (redirectUri: string, state: string) => string;
  exchangeToken: (code: string, redirectUri: string) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  fetchProfile: (accessToken: string) => Promise<{
    platformUserId: string;
    accountName: string;
    accountHandle?: string | null;
    profilePictureUrl?: string | null;
  }>;
};

const PLATFORMS: Record<string, PlatformConfig> = {
  facebook: {
    envKeys: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
    scope: "public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_metadata,pages_read_user_content",
    authUrl: (redirectUri, state) =>
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_metadata,pages_read_user_content")}&response_type=code&state=${state}`,
    exchangeToken: async (code, redirectUri) => {
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`);
      if (!res.ok) throw new Error(`Facebook token exchange failed: ${await res.text()}`);
      const data = (await res.json()) as { access_token: string; expires_in?: number };
      return {
        accessToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    },
    fetchProfile: async (accessToken) => {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`);
      if (!res.ok) throw new Error(`Facebook profile fetch failed: ${await res.text()}`);
      const data = (await res.json()) as { id: string; name: string };
      return {
        platformUserId: data.id,
        accountName: data.name,
        profilePictureUrl: `https://graph.facebook.com/v19.0/${data.id}/picture?type=normal`,
      };
    },
  },
  instagram: {
    envKeys: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
    scope: "public_profile,pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_insights",
    authUrl: (redirectUri, state) =>
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("public_profile,pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_insights")}&response_type=code&state=${state}`,
    exchangeToken: async (code, redirectUri) => {
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`);
      if (!res.ok) throw new Error(`Instagram token exchange failed: ${await res.text()}`);
      const data = (await res.json()) as { access_token: string; expires_in?: number };
      return {
        accessToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    },
    fetchProfile: async (accessToken) => {
      // Get user's Pages, then the IG business account on each page
      const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
      if (!pagesRes.ok) throw new Error(`Instagram pages fetch failed: ${await pagesRes.text()}`);
      const pagesData = (await pagesRes.json()) as { data: { id: string; name: string }[] };
      for (const page of pagesData.data) {
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`,
        );
        if (!igRes.ok) continue;
        const igData = (await igRes.json()) as {
          instagram_business_account?: { id: string; username: string; name: string; profile_picture_url?: string };
        };
        if (igData.instagram_business_account) {
          const ig = igData.instagram_business_account;
          return {
            platformUserId: ig.id,
            accountName: ig.name || ig.username,
            accountHandle: ig.username ? `@${ig.username}` : null,
            profilePictureUrl: ig.profile_picture_url ?? null,
          };
        }
      }
      throw new Error("No Instagram Business account found. Connect a Facebook Page that's linked to an Instagram Business account.");
    },
  },
  linkedin: {
    envKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    scope: "openid profile email w_member_social",
    authUrl: (redirectUri, state) =>
      `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("openid profile email w_member_social")}&state=${state}`,
    exchangeToken: async (code, redirectUri) => {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      });
      const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${await res.text()}`);
      const data = (await res.json()) as { access_token: string; expires_in?: number; refresh_token?: string };
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    },
    fetchProfile: async (accessToken) => {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`LinkedIn profile fetch failed: ${await res.text()}`);
      const data = (await res.json()) as { sub: string; name: string; email?: string; picture?: string };
      return {
        platformUserId: data.sub,
        accountName: data.name,
        accountHandle: data.email ?? null,
        profilePictureUrl: data.picture ?? null,
      };
    },
  },
  tiktok: {
    envKeys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    scope: "user.info.basic,video.publish,video.upload",
    authUrl: (redirectUri, state) =>
      `https://www.tiktok.com/v2/auth/authorize?client_key=${process.env.TIKTOK_CLIENT_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("user.info.basic,video.publish,video.upload")}&response_type=code&state=${state}`,
    exchangeToken: async (code, redirectUri) => {
      const body = new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error(`TikTok token exchange failed: ${await res.text()}`);
      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    },
    fetchProfile: async (accessToken) => {
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) throw new Error(`TikTok profile fetch failed: ${await res.text()}`);
      const data = (await res.json()) as {
        data?: { user?: { open_id: string; display_name: string; username?: string; avatar_url?: string } };
      };
      const user = data.data?.user;
      if (!user) throw new Error("TikTok profile missing user data");
      return {
        platformUserId: user.open_id,
        accountName: user.display_name,
        accountHandle: user.username ? `@${user.username}` : null,
        profilePictureUrl: user.avatar_url ?? null,
      };
    },
  },
};

function getAppUrl(req: any): string {
  return process.env.APP_URL ?? `https://${req.headers.host}`;
}

function getRedirectUri(req: any, platform: string): string {
  return `${getAppUrl(req)}/api/social-accounts/callback/${platform}`;
}

router.post("/social-accounts/connect", requireAuth, async (req: any, res): Promise<void> => {
  const { platform } = req.body ?? {};
  const config = PLATFORMS[platform as string];
  if (!config) {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }
  const missing = config.envKeys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(503).json({ error: "not_configured", missing });
    return;
  }
  const state = signState({ platform, clerkUserId: req.clerkUserId, ts: Date.now() });
  const redirectUri = getRedirectUri(req, platform);
  res.json({ url: config.authUrl(redirectUri, state) });
});

router.get("/social-accounts/callback/:platform", async (req, res): Promise<void> => {
  const platform = req.params.platform;
  const config = PLATFORMS[platform];
  const redirectBase = "/accounts";

  if (!config) {
    res.redirect(`${redirectBase}?error=invalid_platform`);
    return;
  }

  const code = req.query.code as string | undefined;
  const stateRaw = req.query.state as string | undefined;
  const oauthError = req.query.error as string | undefined;

  if (oauthError) {
    logger.warn({ platform, oauthError }, "OAuth provider returned error");
    res.redirect(`${redirectBase}?error=denied&platform=${platform}`);
    return;
  }
  if (!code || !stateRaw) {
    res.redirect(`${redirectBase}?error=missing_code&platform=${platform}`);
    return;
  }

  const decoded = verifyState(stateRaw);
  if (!decoded || decoded.platform !== platform) {
    res.redirect(`${redirectBase}?error=invalid_state&platform=${platform}`);
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, decoded.clerkUserId));
    if (!user) {
      res.redirect(`${redirectBase}?error=user_not_found&platform=${platform}`);
      return;
    }

    const redirectUri = getRedirectUri(req, platform);
    const tokens = await config.exchangeToken(code, redirectUri);
    const profile = await config.fetchProfile(tokens.accessToken);

    // Upsert by (userId, platform, platformUserId)
    const [existing] = await db
      .select()
      .from(socialAccountsTable)
      .where(
        and(
          eq(socialAccountsTable.userId, user.id),
          eq(socialAccountsTable.platform, platform),
          eq(socialAccountsTable.platformUserId, profile.platformUserId),
        ),
      );

    if (existing) {
      await db
        .update(socialAccountsTable)
        .set({
          accountName: profile.accountName,
          accountHandle: profile.accountHandle ?? null,
          profilePictureUrl: profile.profilePictureUrl ?? null,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          tokenExpiresAt: tokens.expiresAt ?? null,
          isActive: true,
        })
        .where(eq(socialAccountsTable.id, existing.id));
    } else {
      await db.insert(socialAccountsTable).values({
        userId: user.id,
        platform,
        platformUserId: profile.platformUserId,
        accountName: profile.accountName,
        accountHandle: profile.accountHandle ?? null,
        profilePictureUrl: profile.profilePictureUrl ?? null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        isActive: true,
      });
    }

    res.redirect(`${redirectBase}?connected=1&platform=${platform}`);
  } catch (err: any) {
    logger.error({ err: err?.message, platform }, "OAuth callback failed");
    res.redirect(`${redirectBase}?error=callback_failed&platform=${platform}`);
  }
});

router.post("/social-accounts/manual-connect", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const { platform, accountName, accountHandle } = req.body ?? {};

  if (!platform || typeof platform !== "string" || !PLATFORMS[platform]) {
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

  res.json(accounts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

// Returns the Facebook Pages the connected account admins. Used by the UI to
// warn users who connected a personal Facebook profile but don't admin any
// Pages — Meta's Graph API only allows posting to Pages, not personal feeds.
router.get("/social-accounts/facebook/pages", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const [account] = await db
    .select()
    .from(socialAccountsTable)
    .where(
      and(
        eq(socialAccountsTable.userId, user.id),
        eq(socialAccountsTable.platform, "facebook"),
        eq(socialAccountsTable.isActive, true),
      ),
    );
  if (!account) {
    res.status(404).json({ error: "Facebook account not connected" });
    return;
  }
  if (account.accessToken.startsWith("manual:")) {
    res.json({ pages: [], manual: true });
    return;
  }
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name&access_token=${encodeURIComponent(account.accessToken)}`,
    );
    if (!r.ok) {
      const body = await r.text();
      res.status(502).json({ error: `Facebook API error: ${body}` });
      return;
    }
    const data = (await r.json()) as { data?: { id: string; name: string }[] };
    res.json({ pages: data.data ?? [] });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to fetch Facebook Pages");
    res.status(502).json({ error: err?.message ?? "Failed to fetch Pages" });
  }
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
