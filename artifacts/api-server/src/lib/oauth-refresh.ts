import { eq } from "drizzle-orm";
import { db, socialAccountsTable } from "@workspace/db";
import { logger } from "./logger";

const REFRESH_SKEW_MS = 5 * 60_000;

type AccountRow = typeof socialAccountsTable.$inferSelect;

async function persistTokens(accountId: number, args: { accessToken: string; refreshToken?: string | null; expiresInSec?: number | null }) {
  const expiresAt = args.expiresInSec ? new Date(Date.now() + args.expiresInSec * 1000) : null;
  await db
    .update(socialAccountsTable)
    .set({
      accessToken: args.accessToken,
      ...(args.refreshToken !== undefined ? { refreshToken: args.refreshToken } : {}),
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(socialAccountsTable.id, accountId));
}

async function refreshFacebookLong(accountId: number, currentToken: string): Promise<string | null> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return null;
  const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(currentToken)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  await persistTokens(accountId, { accessToken: data.access_token, expiresInSec: data.expires_in ?? null });
  return data.access_token;
}

async function refreshLinkedIn(accountId: number, refreshToken: string): Promise<string | null> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
  if (!data.access_token) return null;
  await persistTokens(accountId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresInSec: data.expires_in ?? null,
  });
  return data.access_token;
}

/**
 * Returns a usable access token for the account, refreshing it if it is expired
 * or close to expiry. Returns null if no refresh path is available.
 */
export async function ensureFreshAccessToken(account: AccountRow): Promise<string | null> {
  const expired = account.tokenExpiresAt
    ? account.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS
    : false;
  if (!expired) return account.accessToken;
  try {
    if (account.platform === "facebook" || account.platform === "instagram") {
      return (await refreshFacebookLong(account.id, account.accessToken)) ?? account.accessToken;
    }
    if (account.platform === "linkedin" && account.refreshToken) {
      return (await refreshLinkedIn(account.id, account.refreshToken)) ?? account.accessToken;
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, accountId: account.id, platform: account.platform }, "ensureFreshAccessToken failed");
  }
  return account.accessToken;
}

/**
 * Force a refresh after a 401/403, regardless of stored expiry. Returns the new
 * token or null if no refresh path is available.
 */
export async function forceRefreshAccessToken(account: AccountRow): Promise<string | null> {
  try {
    if (account.platform === "facebook" || account.platform === "instagram") {
      return await refreshFacebookLong(account.id, account.accessToken);
    }
    if (account.platform === "linkedin" && account.refreshToken) {
      return await refreshLinkedIn(account.id, account.refreshToken);
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, accountId: account.id }, "forceRefreshAccessToken failed");
  }
  return null;
}
