import { and, eq, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import {
  db,
  brandsTable,
  postsTable,
  workspacesTable,
  workspaceMembersTable,
  usersTable,
  aiInsightsTable,
  analyticsReportsTable,
  type Brand,
} from "@workspace/db";
import { logger } from "./logger";
import { sendEmail } from "./mailer";

export type ReportPeriod = "weekly" | "monthly";

export interface ReportSummary {
  brand: { id: number; name: string };
  period: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  totals: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
  };
  topPosts: Array<{
    postId: number;
    platform: string;
    content: string;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
  }>;
  recommendations: Array<{ title: string; body: string; kind: string }>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function renderReportHtml(s: ReportSummary, opts?: { reportUrl?: string }): string {
  const top = (s.topPosts ?? [])
    .slice(0, 5)
    .map(
      (p) => `
    <li><strong>[${escapeHtml(p.platform)}]</strong> ${escapeHtml((p.content ?? "").slice(0, 160))} — ${p.likes} likes · ${p.comments} comments · ${p.shares} shares</li>
  `,
    )
    .join("");
  const recs = (s.recommendations ?? [])
    .map((r) => `<li><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.body)}</li>`)
    .join("");
  const link = opts?.reportUrl
    ? `<p><a href="${escapeHtml(opts.reportUrl)}">View the full report in KonnectPilot →</a></p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(s.brand.name)} ${s.period} report</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}
h1{margin:0 0 4px}h2{margin-top:28px;border-bottom:1px solid #eee;padding-bottom:6px}
.kpi{display:inline-block;margin:8px 18px 8px 0}.kpi b{display:block;font-size:22px}
a{color:#3056d3}</style></head>
<body><h1>${escapeHtml(s.brand.name)} — ${s.period} report</h1>
<p>${new Date(s.periodStart).toLocaleDateString()} — ${new Date(s.periodEnd).toLocaleDateString()}</p>
${link}
<h2>Key stats</h2>
<div><span class="kpi"><b>${s.totals.reach.toLocaleString()}</b>Reach</span>
<span class="kpi"><b>${s.totals.impressions.toLocaleString()}</b>Impressions</span>
<span class="kpi"><b>${s.totals.likes.toLocaleString()}</b>Likes</span>
<span class="kpi"><b>${s.totals.comments.toLocaleString()}</b>Comments</span>
<span class="kpi"><b>${s.totals.shares.toLocaleString()}</b>Shares</span>
<span class="kpi"><b>${(s.totals.engagementRate * 100).toFixed(2)}%</b>Engagement</span></div>
<h2>Top posts</h2><ol>${top || "<li>No data yet.</li>"}</ol>
<h2>Recommendations</h2><ul>${recs || "<li>No recommendations available yet.</li>"}</ul>
${link}
</body></html>`;
}

/**
 * Build the analytics summary for a brand over the trailing N days ending at
 * `periodEnd`. Pure read; does not persist.
 */
export async function buildBrandReportSummary(args: {
  brand: Pick<Brand, "id" | "name">;
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
}): Promise<ReportSummary> {
  const { brand, period, periodStart, periodEnd } = args;
  const since = periodStart.toISOString().slice(0, 10);
  const until = periodEnd.toISOString().slice(0, 10);

  const totals = await db.execute<any>(sql`
    SELECT COALESCE(SUM(impressions),0)::int AS impressions,
           COALESCE(SUM(reach),0)::int AS reach,
           COALESCE(SUM(likes),0)::int AS likes,
           COALESCE(SUM(comments),0)::int AS comments,
           COALESCE(SUM(shares),0)::int AS shares,
           COALESCE(AVG(engagement_rate),0)::float AS engagement_rate
    FROM brand_daily_aggregates
    WHERE brand_id = ${brand.id} AND day >= ${since} AND day <= ${until}
  `);
  // Pull the latest snapshot per post inside the window, then rank by a
  // composite engagement score (engagement_rate weighted by likes+comments+
  // shares as a tie-breaker for low-volume posts) and keep the top 20.
  const top = await db.execute<any>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (s.post_id)
        s.post_id, s.platform, s.likes, s.comments, s.shares, s.engagement_rate, p.content
      FROM post_metrics_snapshots s
      JOIN posts p ON p.id = s.post_id
      WHERE s.brand_id = ${brand.id}
        AND s.fetched_at >= ${periodStart}
        AND s.fetched_at <= ${periodEnd}
      ORDER BY s.post_id, s.fetched_at DESC
    )
    SELECT *
    FROM latest
    ORDER BY engagement_rate DESC NULLS LAST,
             (likes + comments + shares) DESC
    LIMIT 20
  `);
  const insights = await db
    .select()
    .from(aiInsightsTable)
    .where(
      and(
        eq(aiInsightsTable.brandId, brand.id),
        gte(aiInsightsTable.createdAt, periodStart),
        lte(aiInsightsTable.createdAt, periodEnd),
      ),
    )
    .limit(8);

  const t = totals.rows[0] ?? {};
  return {
    brand: { id: brand.id, name: brand.name },
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totals: {
      impressions: Number(t.impressions ?? 0),
      reach: Number(t.reach ?? 0),
      likes: Number(t.likes ?? 0),
      comments: Number(t.comments ?? 0),
      shares: Number(t.shares ?? 0),
      engagementRate: Number(t.engagement_rate ?? 0),
    },
    topPosts: top.rows.map((r: any) => ({
      postId: Number(r.post_id),
      platform: String(r.platform),
      content: String(r.content ?? "").slice(0, 280),
      likes: Number(r.likes),
      comments: Number(r.comments),
      shares: Number(r.shares),
      engagementRate: Number(r.engagement_rate ?? 0),
    })),
    recommendations: insights.map((i) => ({ title: i.title, body: i.body, kind: i.kind })),
  };
}

/**
 * Build the report and persist it (idempotent on (brandId, period, periodStart)).
 * Returns the persisted row id and summary/html.
 */
export async function generateAndStoreReport(args: {
  brand: Pick<Brand, "id" | "name">;
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  emailOptIn?: boolean;
}): Promise<{ id: number; summary: ReportSummary; html: string; createdAt: Date }> {
  const summary = await buildBrandReportSummary(args);
  const html = renderReportHtml(summary, { reportUrl: brandReportUrl(args.brand.id) });

  const [row] = await db
    .insert(analyticsReportsTable)
    .values({
      brandId: args.brand.id,
      period: args.period,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      summary: summary as unknown as Record<string, unknown>,
      html,
      emailOptIn: Boolean(args.emailOptIn ?? false),
    })
    .onConflictDoUpdate({
      target: [analyticsReportsTable.brandId, analyticsReportsTable.period, analyticsReportsTable.periodStart],
      set: {
        periodEnd: args.periodEnd,
        summary: summary as unknown as Record<string, unknown>,
        html,
      },
    })
    .returning();
  return { id: row.id, summary, html, createdAt: row.createdAt };
}

export function brandReportUrl(brandId: number): string {
  const base =
    process.env["APP_URL"] ??
    process.env["FRONTEND_URL"] ??
    (process.env["REPLIT_DOMAINS"] ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]}` : "");
  if (!base) return `/analytics?brandId=${brandId}`;
  return `${base.replace(/\/$/, "")}/analytics?brandId=${brandId}`;
}

/**
 * Find email addresses for the workspace owners + admins of a workspace.
 */
export async function getWorkspaceOwnerEmails(workspaceId: number): Promise<string[]> {
  const rows = await db
    .select({ email: usersTable.email, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, workspaceMembersTable.userId))
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        inArray(workspaceMembersTable.role, ["owner", "admin"]),
      ),
    );
  // Always include the workspace owner as a backstop in case the membership row
  // is missing (legacy workspaces).
  const [ws] = await db
    .select({ id: workspacesTable.id, ownerId: workspacesTable.ownerId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  let ownerEmail: string | null = null;
  if (ws) {
    const [owner] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, ws.ownerId));
    ownerEmail = owner?.email ?? null;
  }
  const all = new Set<string>();
  for (const r of rows) if (r.email) all.add(r.email);
  if (ownerEmail) all.add(ownerEmail);
  return Array.from(all);
}

/**
 * Email a stored report to the workspace owners/admins. Marks `last_emailed_at`
 * on the row and records the recipient list.
 */
export async function emailReport(args: {
  reportId: number;
  brandId: number;
  workspaceId: number;
  subject: string;
  html: string;
  skipIfAlreadySent?: boolean;
}): Promise<{ sent: boolean; recipients: string[]; reason?: string }> {
  const recipients = await getWorkspaceOwnerEmails(args.workspaceId);
  if (recipients.length === 0) {
    logger.info({ workspaceId: args.workspaceId }, "No owner/admin emails for workspace; skipping report email");
    return { sent: false, recipients, reason: "no recipients" };
  }
  // Atomic claim: only the worker that flips last_emailed_at from NULL → now()
  // is allowed to send. This serializes concurrent schedulers across processes
  // and prevents duplicate emails on restart races. We rollback on failure.
  const claimAt = new Date();
  if (args.skipIfAlreadySent ?? true) {
    const claimed = await db
      .update(analyticsReportsTable)
      .set({ lastEmailedAt: claimAt, emailRecipients: recipients, emailOptIn: true })
      .where(and(eq(analyticsReportsTable.id, args.reportId), isNull(analyticsReportsTable.lastEmailedAt)))
      .returning({ id: analyticsReportsTable.id });
    if (claimed.length === 0) {
      return { sent: false, recipients, reason: "already emailed" };
    }
  }
  const result = await sendEmail({ to: recipients, subject: args.subject, html: args.html });
  if (!result.sent && (args.skipIfAlreadySent ?? true)) {
    // Release the claim so a later tick can retry. Only release the row we
    // just claimed (matched by lastEmailedAt = claimAt) so we never undo a
    // successful send from another worker.
    await db
      .update(analyticsReportsTable)
      .set({ lastEmailedAt: null, emailRecipients: null })
      .where(and(eq(analyticsReportsTable.id, args.reportId), eq(analyticsReportsTable.lastEmailedAt, claimAt)));
  }
  return { sent: result.sent, recipients, reason: result.reason };
}

/**
 * Find brands with at least one published post in the trailing window.
 */
export async function listActiveBrandsForPeriod(args: {
  periodStart: Date;
  periodEnd: Date;
}): Promise<Array<{ brandId: number; name: string; workspaceId: number }>> {
  const rows = await db
    .selectDistinct({
      brandId: brandsTable.id,
      name: brandsTable.name,
      workspaceId: brandsTable.workspaceId,
    })
    .from(brandsTable)
    .innerJoin(postsTable, eq(postsTable.brandId, brandsTable.id))
    .where(
      and(
        eq(brandsTable.active, true),
        eq(postsTable.status, "published"),
        gte(postsTable.publishedAt, args.periodStart),
        lte(postsTable.publishedAt, args.periodEnd),
      ),
    );
  return rows
    .filter((r) => r.workspaceId != null)
    .map((r) => ({ brandId: r.brandId, name: r.name, workspaceId: r.workspaceId as number }));
}

/**
 * Compute the period boundaries for "the previous full ISO week ending Sunday
 * 23:59:59.999 UTC". Reference time is `now`.
 */
export function previousWeekRange(now: Date = new Date()): { periodStart: Date; periodEnd: Date } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // 0 = Sun, 1 = Mon ... 6 = Sat. Find this week's Monday in UTC.
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const thisMonday = new Date(d.getTime() - daysSinceMonday * 24 * 60 * 60_000);
  const periodStart = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60_000);
  const periodEnd = new Date(thisMonday.getTime() - 1);
  return { periodStart, periodEnd };
}
