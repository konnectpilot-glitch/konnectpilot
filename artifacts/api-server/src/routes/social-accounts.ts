import { Router, type IRouter } from "express";
import { eq, and, lt } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db, socialAccountsTable, usersTable, oauthStagingTable } from "@workspace/db";
import { requireAuth, requireWorkspace, ensureUser, hasRoleAtLeast } from "./users";
import { workspacesTable, workspaceMembersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getPlan } from "../lib/plans";

const router: IRouter = Router();

async function assertSocialAccountQuota(req: any, res: any): Promise<boolean> {
  const limit = getPlan(req.user.plan).socialAccounts;
  const existing = await db
    .select({ id: socialAccountsTable.id })
    .from(socialAccountsTable)
    .where(eq(socialAccountsTable.workspaceId, req.workspaceId));
  if (existing.length >= limit) {
    res.status(403).json({
      error: `Your plan allows a maximum of ${limit} connected account(s). Please upgrade.`,
      code: "social_account_limit_reached",
    });
    return false;
  }
  return true;
}

// Used from the OAuth callback (no req.workspaceId / no res.json envelope).
async function assertSocialAccountQuotaForCallback(
  userId: number,
  plan: string,
  workspaceId: number | null,
): Promise<{ ok: boolean; limit: number }> {
  const limit = getPlan(plan).socialAccounts;
  const rows = workspaceId
    ? await db
        .select({ id: socialAccountsTable.id })
        .from(socialAccountsTable)
        .where(eq(socialAccountsTable.workspaceId, workspaceId))
    : await db
        .select({ id: socialAccountsTable.id })
        .from(socialAccountsTable)
        .where(eq(socialAccountsTable.userId, userId));
  return { ok: rows.length < limit, limit };
}

const STATE_SECRET = process.env.SESSION_SECRET ?? "dev-state-secret-change-me";

function signState(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): { platform: string; clerkUserId: string; workspaceId?: number } | null {
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

// Unified Meta OAuth scope — single consent screen covers both FB Pages and
// IG Business. After the callback, user picks which Pages to import via the
// staging/picker flow; for each selected Page we probe for a linked IG
// Business account and import that too.
const META_SCOPE = [
  "public_profile",
  "business_management",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
].join(",");

const PLATFORMS: Record<string, PlatformConfig> = {
  meta: {
    envKeys: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_REDIRECT_URI"],
    scope: META_SCOPE,
    authUrl: (redirectUri, state) =>
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(META_SCOPE)}` +
      `&response_type=code&state=${state}`,
    exchangeToken: async (code, redirectUri) => {
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`);
      if (!res.ok) throw new Error(`Meta token exchange failed: ${await res.text()}`);
      const data = (await res.json()) as { access_token: string; expires_in?: number };
      return {
        accessToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    },
    // No fetchProfile for meta — the callback stages a picker flow instead.
    // This field is required by the type, so we point it at a no-op that's
    // never invoked for meta (callback handler branches on platform === "meta").
    fetchProfile: async () => {
      throw new Error("Meta uses the staging/picker flow; fetchProfile not used.");
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
};

function getAppUrl(req: any): string {
  return process.env.APP_URL ?? `https://${req.headers.host}`;
}

function getRedirectUri(req: any, platform: string): string {
  // Meta requires an exact match against the URI registered in the App
  // settings. We honor a dedicated env var (FACEBOOK_REDIRECT_URI) for that
  // platform so the registered URI can differ from APP_URL (which is the
  // frontend's URL). Other providers derive from APP_URL as before.
  if (platform === "meta") {
    return process.env.FACEBOOK_REDIRECT_URI ?? "https://www.konnectpilot.com/api/social-accounts/callback/facebook";
  }
  return `${getAppUrl(req)}/api/social-accounts/callback/${platform}`;
}

// Random URL-safe ticket for the staging row. Long enough to be unguessable;
// stored in a unique-indexed column to make collision irrelevant.
function newTicket(): string {
  return randomBytes(32).toString("base64url");
}

// Lazy sweep of expired staging rows. Called on staging-related requests so
// we don't grow forever without a dedicated cron. Cheap query (single DELETE).
async function sweepExpiredStaging(): Promise<void> {
  try {
    await db.delete(oauthStagingTable).where(lt(oauthStagingTable.expiresAt, new Date()));
  } catch (err: any) {
    logger.warn({ err: err?.message }, "oauth_staging sweep failed");
  }
}

async function connectHandler(req: any, res: any): Promise<void> {
  if (!(await assertSocialAccountQuota(req, res))) return;
  return connectHandlerImpl(req, res);
}
router.post("/social-accounts/connect", requireAuth, requireWorkspace, connectHandler);
async function connectHandlerImpl(req: any, res: any): Promise<void> {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
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
  const state = signState({ platform, clerkUserId: req.clerkUserId, workspaceId: req.workspaceId, ts: Date.now() });
  const redirectUri = getRedirectUri(req, platform);
  res.json({ url: config.authUrl(redirectUri, state) });
}

router.get("/social-accounts/callback/:platform", async (req, res): Promise<void> => {
  // URL path uses "facebook" (registered redirect URI) but internal config key is "meta"
  const rawPlatform = req.params.platform;
  const platform = rawPlatform === "facebook" ? "meta" : rawPlatform;
  const config = PLATFORMS[platform];
  const redirectBase = `${getAppUrl(req)}/accounts`;

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

    // Resolve target workspace (state-bound, fall back to user's active personal)
    let targetWsId = decoded.workspaceId ?? user.activeWorkspaceId ?? null;
    if (targetWsId) {
      const [member] = await db
        .select()
        .from(workspaceMembersTable)
        .where(
          and(
            eq(workspaceMembersTable.workspaceId, targetWsId),
            eq(workspaceMembersTable.userId, user.id),
          ),
        );
      if (!member) targetWsId = user.activeWorkspaceId ?? null;
    }

    const redirectUri = getRedirectUri(req, platform);
    const tokens = await config.exchangeToken(code, redirectUri);

    // Meta: stage the result and bounce to the picker UI.
    if (platform === "meta") {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts` +
          `?fields=id,name,access_token,picture` +
          `&access_token=${encodeURIComponent(tokens.accessToken)}`,
      );
      if (!pagesRes.ok) {
        logger.error({ body: await pagesRes.text() }, "Meta /me/accounts failed");
        res.redirect(`${redirectBase}?error=callback_failed&platform=meta`);
        return;
      }
      const { data: pages = [] } = (await pagesRes.json()) as {
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          picture?: { data?: { url?: string } };
        }>;
      };

      // For each Page, probe whether it has a linked IG Business account.
      // Use the Page token (not the user token) — Meta requires it for this field.
      const enriched = await Promise.all(
        pages.map(async (p) => {
          let igAccount: {
            id: string;
            username: string;
            name?: string;
            profilePictureUrl?: string | null;
          } | null = null;
          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v19.0/${p.id}` +
                `?fields=instagram_business_account{id,username,name,profile_picture_url}` +
                `&access_token=${encodeURIComponent(p.access_token)}`,
            );
            if (igRes.ok) {
              const igData = (await igRes.json()) as {
                instagram_business_account?: {
                  id: string;
                  username: string;
                  name?: string;
                  profile_picture_url?: string;
                };
              };
              if (igData.instagram_business_account) {
                igAccount = {
                  id: igData.instagram_business_account.id,
                  username: igData.instagram_business_account.username,
                  name: igData.instagram_business_account.name,
                  profilePictureUrl: igData.instagram_business_account.profile_picture_url ?? null,
                };
              }
            }
          } catch (err: any) {
            logger.warn({ err: err?.message, pageId: p.id }, "IG linkage probe failed");
          }
          return {
            pageId: p.id,
            pageName: p.name,
            pageAccessToken: p.access_token,
            pagePictureUrl: p.picture?.data?.url ?? null,
            igAccount,
          };
        }),
      );

      const ticket = newTicket();
      await db.insert(oauthStagingTable).values({
        ticket,
        userId: user.id,
        workspaceId: targetWsId,
        provider: "meta",
        userAccessToken: tokens.accessToken,
        tokenExpiresAt: tokens.expiresAt ?? null,
        fetchedPages: { pages: enriched },
        expiresAt: new Date(Date.now() + 5 * 60_000),
      });

      res.redirect(`${getAppUrl(req)}/accounts/connect/meta?ticket=${ticket}`);
      return;
    }

    // Single-account providers (LinkedIn): existing insert-on-callback flow.
    const profile = await config.fetchProfile(tokens.accessToken);

    // Upsert by (workspaceId, platform, platformUserId) — falls back to user-scoped match
    const [existing] = await db
      .select()
      .from(socialAccountsTable)
      .where(
        and(
          targetWsId
            ? eq(socialAccountsTable.workspaceId, targetWsId)
            : eq(socialAccountsTable.userId, user.id),
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
      // Re-check the social-account cap at insert time. The cap is enforced
      // on /connect, but a user could initiate several OAuth flows in
      // parallel under the cap and have all of them complete after.
      const cap = await assertSocialAccountQuotaForCallback(user.id, user.plan, targetWsId);
      if (!cap.ok) {
        res.redirect(`${redirectBase}?error=limit_reached&platform=${platform}`);
        return;
      }
      await db.insert(socialAccountsTable).values({
        userId: user.id,
        workspaceId: targetWsId,
        platform,
        accountType: platform === "linkedin" ? "linkedin_person" : null,
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

// Read the Pages snapshot for a staging ticket so the picker UI can render
// without re-querying Meta. Ticket must belong to the calling user.
router.get(
  "/social-accounts/staging/:ticket",
  requireAuth,
  requireWorkspace,
  async (req: any, res): Promise<void> => {
    await sweepExpiredStaging();
    const ticket = String(req.params.ticket);
    const [row] = await db
      .select()
      .from(oauthStagingTable)
      .where(eq(oauthStagingTable.ticket, ticket));
    if (!row || row.userId !== req.user.id) {
      res.status(404).json({ error: "Staging ticket not found or expired" });
      return;
    }
    if (row.expiresAt < new Date()) {
      res.status(410).json({ error: "Staging ticket expired — restart the OAuth flow" });
      return;
    }
    const fetched = (row.fetchedPages as any) ?? { pages: [] };
    // Strip page access tokens from the response — they never go to the browser.
    const pages = (fetched.pages ?? []).map((p: any) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      pagePictureUrl: p.pagePictureUrl,
      igAccount: p.igAccount
        ? {
            id: p.igAccount.id,
            username: p.igAccount.username,
            name: p.igAccount.name,
            profilePictureUrl: p.igAccount.profilePictureUrl,
          }
        : null,
    }));
    res.json({ provider: row.provider, pages });
  },
);

// Apply the user's Page selection. Creates one social_accounts row per
// selected Page (account_type = facebook_page), plus one per linked IG when
// includeLinkedInstagram is true (account_type = instagram_business). Deletes
// the staging row on success; partial failures (e.g. quota cap) are reported.
router.post(
  "/social-accounts/staging/:ticket/select",
  requireAuth,
  requireWorkspace,
  async (req: any, res): Promise<void> => {
    if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    await sweepExpiredStaging();
    const ticket = String(req.params.ticket);
    const [row] = await db
      .select()
      .from(oauthStagingTable)
      .where(eq(oauthStagingTable.ticket, ticket));
    if (!row || row.userId !== req.user.id) {
      res.status(404).json({ error: "Staging ticket not found or expired" });
      return;
    }
    if (row.expiresAt < new Date()) {
      res.status(410).json({ error: "Staging ticket expired — restart the OAuth flow" });
      return;
    }

    const body = req.body ?? {};
    const pageIds = Array.isArray(body.pageIds) ? body.pageIds.map(String) : [];
    const includeLinkedInstagram = body.includeLinkedInstagram !== false;
    if (pageIds.length === 0) {
      res.status(400).json({ error: "Pick at least one Page" });
      return;
    }

    const fetched = (row.fetchedPages as any) ?? { pages: [] };
    const selected = (fetched.pages ?? []).filter((p: any) => pageIds.includes(p.pageId));
    if (selected.length === 0) {
      res.status(400).json({ error: "Selected Page IDs do not match the staged set" });
      return;
    }

    // Build the rows we want to insert; check quota against the projected total.
    const wantedRows: Array<{
      platform: string;
      accountType: string;
      platformUserId: string;
      accountName: string;
      accountHandle: string | null;
      profilePictureUrl: string | null;
      accessToken: string;
      tokenExpiresAt: Date | null;
      platformMetadata: Record<string, unknown>;
    }> = [];
    for (const p of selected) {
      wantedRows.push({
        platform: "facebook",
        accountType: "facebook_page",
        platformUserId: p.pageId,
        accountName: p.pageName,
        accountHandle: null,
        profilePictureUrl: p.pagePictureUrl ?? null,
        accessToken: p.pageAccessToken,
        tokenExpiresAt: row.tokenExpiresAt,
        platformMetadata: { pictureUrl: p.pagePictureUrl ?? null },
      });
      if (includeLinkedInstagram && p.igAccount) {
        wantedRows.push({
          platform: "instagram",
          accountType: "instagram_business",
          platformUserId: p.igAccount.id,
          accountName: p.igAccount.name || p.igAccount.username,
          // Store handle without the leading @ — the UI prefixes it on render.
          accountHandle: p.igAccount.username || null,
          profilePictureUrl: p.igAccount.profilePictureUrl ?? null,
          // IG publishing uses the parent Page's token — store it directly so
          // the publisher doesn't need to look up the linked Page row.
          accessToken: p.pageAccessToken,
          tokenExpiresAt: row.tokenExpiresAt,
          platformMetadata: {
            linkedPageId: p.pageId,
            linkedPageName: p.pageName,
            igUsername: p.igAccount.username,
          },
        });
      }
    }

    // Cap check: existing + would-be insertions.
    const cap = await assertSocialAccountQuotaForCallback(req.user.id, req.user.plan, req.workspaceId);
    const existingCount = getPlan(req.user.plan).socialAccounts - (cap.limit - (cap.ok ? 1 : 0)); // rough; recount cleanly:
    const existing = await db
      .select({ id: socialAccountsTable.id })
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.workspaceId, req.workspaceId));
    if (existing.length + wantedRows.length > cap.limit) {
      res.status(403).json({
        error: `Selection would exceed your plan limit (${existing.length + wantedRows.length} > ${cap.limit}).`,
        code: "social_account_limit_reached",
      });
      return;
    }
    void existingCount; // shadowed by clean recount above; keep for clarity.

    // Upsert each row by (workspaceId, platform, platformUserId).
    const created: Array<{ id: number; platform: string; accountType: string; accountName: string }> = [];
    for (const r of wantedRows) {
      const [dupe] = await db
        .select()
        .from(socialAccountsTable)
        .where(
          and(
            eq(socialAccountsTable.workspaceId, req.workspaceId),
            eq(socialAccountsTable.platform, r.platform),
            eq(socialAccountsTable.platformUserId, r.platformUserId),
          ),
        );
      if (dupe) {
        await db
          .update(socialAccountsTable)
          .set({
            accountType: r.accountType,
            accountName: r.accountName,
            accountHandle: r.accountHandle,
            profilePictureUrl: r.profilePictureUrl,
            accessToken: r.accessToken,
            tokenExpiresAt: r.tokenExpiresAt,
            platformMetadata: r.platformMetadata,
            isActive: true,
          })
          .where(eq(socialAccountsTable.id, dupe.id));
        created.push({ id: dupe.id, platform: r.platform, accountType: r.accountType, accountName: r.accountName });
      } else {
        const [ins] = await db
          .insert(socialAccountsTable)
          .values({
            userId: req.user.id,
            workspaceId: req.workspaceId,
            platform: r.platform,
            accountType: r.accountType,
            platformUserId: r.platformUserId,
            accountName: r.accountName,
            accountHandle: r.accountHandle,
            profilePictureUrl: r.profilePictureUrl,
            accessToken: r.accessToken,
            tokenExpiresAt: r.tokenExpiresAt,
            platformMetadata: r.platformMetadata,
            isActive: true,
          })
          .returning({ id: socialAccountsTable.id });
        created.push({ id: ins.id, platform: r.platform, accountType: r.accountType, accountName: r.accountName });
      }
    }

    await db.delete(oauthStagingTable).where(eq(oauthStagingTable.id, row.id));
    res.json({ created });
  },
);

router.post("/social-accounts/manual-connect", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  if (!(await assertSocialAccountQuota(req, res))) return;
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
      userId: req.user.id,
      workspaceId: req.workspaceId,
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

router.get("/social-accounts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
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
    .where(eq(socialAccountsTable.workspaceId, req.workspaceId))
    .orderBy(socialAccountsTable.createdAt);

  res.json(accounts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

// Returns the Facebook Pages the connected account admins. Used by the UI to
// warn users who connected a personal Facebook profile but don't admin any
// Pages — Meta's Graph API only allows posting to Pages, not personal feeds.
router.get("/social-accounts/facebook/pages", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const [account] = await db
    .select()
    .from(socialAccountsTable)
    .where(
      and(
        eq(socialAccountsTable.workspaceId, req.workspaceId),
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

router.delete("/social-accounts/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(socialAccountsTable)
    .where(and(eq(socialAccountsTable.id, id), eq(socialAccountsTable.workspaceId, req.workspaceId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
