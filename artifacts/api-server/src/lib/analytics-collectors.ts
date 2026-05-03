/**
 * Centralized read-only insights fetchers for FB Pages, Instagram Business, LinkedIn.
 * Each function returns a normalized metrics object so the snapshot table is
 * platform-agnostic.
 *
 * Error contract: these functions DO NOT swallow failures. Auth failures throw
 * `HttpAuthError` so the scheduler can trigger a reactive token refresh; all
 * other transport / parsing errors throw so the scheduler records a cursor
 * failure and applies exponential backoff. Returning fake zero metrics on
 * failure would (a) reset failure counters, (b) suppress reactive token
 * refresh, and (c) pollute aggregates / performance memory with synthetic
 * zeros.
 */

export type NormalizedMetrics = {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  videoViews: number;
  saves: number;
  raw: Record<string, unknown>;
};

const FETCH_TIMEOUT_MS = 20_000;

export class HttpAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers });
    const body = await res.text();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new HttpAuthError(res.status, `HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    return body ? JSON.parse(body) : {};
  } finally {
    clearTimeout(t);
  }
}

function linkedInHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": "202405",
  };
}

function pickInsightValue(insights: any, name: string): number {
  const item = (insights?.data ?? []).find((i: any) => i?.name === name);
  if (!item) return 0;
  const v = item?.values?.[0]?.value;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v) return Object.values(v as Record<string, unknown>).reduce<number>((s, n) => s + (Number(n) || 0), 0);
  return 0;
}

export async function fetchFacebookPostInsights(args: {
  pageAccessToken: string;
  platformPostId: string;
}): Promise<NormalizedMetrics> {
  const metrics = [
    "post_impressions",
    "post_impressions_unique",
    "post_clicks",
    "post_reactions_by_type_total",
    "post_video_views",
  ].join(",");
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(args.platformPostId)}/insights?metric=${metrics}&access_token=${encodeURIComponent(args.pageAccessToken)}`;
  const insights = await fetchJson(url);

  const reactionsObj: any = (insights?.data ?? []).find((i: any) => i?.name === "post_reactions_by_type_total")?.values?.[0]?.value ?? {};
  const likes = Object.values(reactionsObj).reduce<number>((s, v) => s + (Number(v) || 0), 0);

  // Comments + shares come from the post object itself (not insights).
  const summaryUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(args.platformPostId)}?fields=comments.summary(true),shares&access_token=${encodeURIComponent(args.pageAccessToken)}`;
  const summary = await fetchJson(summaryUrl);

  return {
    impressions: pickInsightValue(insights, "post_impressions"),
    reach: pickInsightValue(insights, "post_impressions_unique"),
    likes,
    comments: Number(summary?.comments?.summary?.total_count ?? 0),
    shares: Number(summary?.shares?.count ?? 0),
    clicks: pickInsightValue(insights, "post_clicks"),
    videoViews: pickInsightValue(insights, "post_video_views"),
    saves: 0,
    raw: { insights, summary },
  };
}

export async function fetchFacebookPageFollowers(args: {
  pageId: string;
  pageAccessToken: string;
}): Promise<number> {
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(args.pageId)}?fields=fan_count,followers_count&access_token=${encodeURIComponent(args.pageAccessToken)}`;
  const res = await fetchJson(url);
  return Number(res?.followers_count ?? res?.fan_count ?? 0);
}

export async function fetchInstagramMediaInsights(args: {
  igMediaId: string;
  pageAccessToken: string;
}): Promise<NormalizedMetrics> {
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(args.igMediaId)}/insights?metric=impressions,reach,likes,comments,shares,saved,video_views&access_token=${encodeURIComponent(args.pageAccessToken)}`;
  const insights = await fetchJson(url);
  return {
    impressions: pickInsightValue(insights, "impressions"),
    reach: pickInsightValue(insights, "reach"),
    likes: pickInsightValue(insights, "likes"),
    comments: pickInsightValue(insights, "comments"),
    shares: pickInsightValue(insights, "shares"),
    clicks: 0,
    videoViews: pickInsightValue(insights, "video_views"),
    saves: pickInsightValue(insights, "saved"),
    raw: { insights },
  };
}

export async function fetchInstagramFollowers(args: {
  igUserId: string;
  pageAccessToken: string;
}): Promise<number> {
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(args.igUserId)}?fields=followers_count&access_token=${encodeURIComponent(args.pageAccessToken)}`;
  const res = await fetchJson(url);
  return Number(res?.followers_count ?? 0);
}

export async function fetchLinkedInShareStats(args: {
  accessToken: string;
  shareUrn: string;
  organizationUrn?: string;
}): Promise<NormalizedMetrics> {
  const params = new URLSearchParams({
    q: "organizationalEntity",
    "shares[0]": args.shareUrn,
  });
  if (args.organizationUrn) params.set("organizationalEntity", args.organizationUrn);
  const url = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?${params.toString()}`;
  const stats = await fetchJson(url, linkedInHeaders(args.accessToken));
  const el = (stats?.elements ?? [])[0]?.totalShareStatistics ?? {};
  return {
    impressions: Number(el.impressionCount ?? 0),
    reach: Number(el.uniqueImpressionsCount ?? 0),
    likes: Number(el.likeCount ?? 0),
    comments: Number(el.commentCount ?? 0),
    shares: Number(el.shareCount ?? 0),
    clicks: Number(el.clickCount ?? 0),
    videoViews: 0,
    saves: 0,
    raw: { stats },
  };
}

export async function fetchLinkedInOrgFollowers(args: {
  accessToken: string;
  organizationUrn: string;
}): Promise<number> {
  const url = `https://api.linkedin.com/v2/networkSizes/${encodeURIComponent(args.organizationUrn)}?edgeType=CompanyFollowedByMember`;
  const res = await fetchJson(url, linkedInHeaders(args.accessToken));
  return Number(res?.firstDegreeSize ?? 0);
}

export function computeEngagementRate(m: NormalizedMetrics): number {
  const denom = m.reach || m.impressions || 0;
  if (!denom) return 0;
  return (m.likes + m.comments + m.shares + m.saves) / denom;
}
