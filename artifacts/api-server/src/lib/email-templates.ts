// HTML email templates. Plain inline-styled HTML for max client compat —
// react-email would be nicer but adds a meaningful build dependency for
// what's essentially 4 templates. When this grows past ~10 templates we
// should migrate.
//
// Style language matches the marketing site: indigo/primary accent, off-white
// background, generous whitespace. Tested by-eye in Gmail/Outlook/Apple Mail
// — emoji-free, no web fonts, tables for layout where required for Outlook.

interface BaseProps {
  appUrl: string;
  ctaUrl: string;
  unsubscribeUrl?: string;
}

function wrap(content: string, opts: { appUrl: string; preheader: string; unsubscribeUrl?: string }): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KonnectPilot</title>
</head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a2236;-webkit-font-smoothing:antialiased;">
  <span style="display:none;font-size:0;line-height:0;color:#f6f4ef;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f4ef;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #f0e6d6;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 28px 8px;">
          <a href="${opts.appUrl}" style="text-decoration:none;display:inline-block;">
            <span style="display:inline-block;background:#1e5be0;color:#ffffff;font-weight:700;font-size:14px;padding:5px 9px;border-radius:6px;letter-spacing:.5px;">KP</span>
            <span style="font-weight:700;color:#1a2236;font-size:16px;margin-left:6px;vertical-align:middle;">KonnectPilot</span>
          </a>
        </td></tr>
        <tr><td style="padding:8px 28px 32px;font-size:15px;line-height:1.6;color:#1a2236;">
          ${content}
        </td></tr>
      </table>
      <div style="max-width:560px;color:#7a8aa3;font-size:12px;text-align:center;margin-top:16px;line-height:1.5;">
        You're receiving this because you have a KonnectPilot account.
        ${opts.unsubscribeUrl ? `<br><a href="${opts.unsubscribeUrl}" style="color:#7a8aa3;text-decoration:underline;">Unsubscribe</a> · ` : "<br>"}
        <a href="${opts.appUrl}" style="color:#7a8aa3;text-decoration:underline;">konnectpilot.com</a>
      </div>
    </td></tr>
  </table>
</body></html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr>
    <td style="border-radius:8px;background:#1e5be0;">
      <a href="${href}" style="display:inline-block;padding:11px 22px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;">${label}</a>
    </td>
  </tr></table>`;
}

// ── 1. Welcome ────────────────────────────────────────────────────────────
export interface WelcomeProps extends BaseProps {
  firstName?: string | null;
}

export function welcomeEmail(p: WelcomeProps) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : "Hi,";
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a2236;">Welcome to KonnectPilot</h1>
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">Thanks for signing up. KonnectPilot is the only social tool that <strong>learns your brand</strong> — it gets sharper every week you use it.</p>
    <p style="margin:0 0 8px;font-weight:600;">Here's the fastest way to start:</p>
    <ol style="margin:0 0 16px;padding-left:20px;line-height:1.7;">
      <li>Paste your store URL — we'll infer your brand voice in 10 seconds</li>
      <li>Connect Facebook, Instagram, and LinkedIn (one OAuth flow)</li>
      <li>Hit "Generate a post" — drafts appear for all 3 platforms at once</li>
    </ol>
    ${button("Set up my first brand", p.ctaUrl)}
    <p style="margin:0 0 0;color:#5e6c84;font-size:13px;">If anything feels off in your first hour, just reply to this email. A real person reads every one.</p>
  `;
  return {
    subject: "Welcome to KonnectPilot — let's get your first post live",
    html: wrap(content, { appUrl: p.appUrl, preheader: "Three steps and you're posting. Tap to begin.", unsubscribeUrl: p.unsubscribeUrl }),
    text: `${greeting}\n\nWelcome to KonnectPilot. Set up your brand in 10 seconds by pasting your store URL: ${p.ctaUrl}\n\nReply to this email if you get stuck.`,
  };
}

// ── 2. First-post nudge (Day 1) ────────────────────────────────────────────
export interface FirstPostNudgeProps extends BaseProps {
  firstName?: string | null;
  brandName?: string | null;
}

export function firstPostNudgeEmail(p: FirstPostNudgeProps) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : "Hi there,";
  const brandLine = p.brandName
    ? `You set up <strong>${p.brandName}</strong> — nice. Now let's see what KonnectPilot can do with it.`
    : `You're set up — now let's see what KonnectPilot can do.`;
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a2236;">Want to see the AI in action?</h1>
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">${brandLine}</p>
    <p style="margin:0 0 16px;">One click writes Facebook, Instagram, <em>and</em> LinkedIn drafts tuned per platform. You can publish, schedule, or send to your team for approval.</p>
    ${button("Generate my first post", p.ctaUrl)}
    <p style="margin:0;color:#5e6c84;font-size:13px;">Tip: the more posts you approve, the sharper the AI gets at your voice. Most customers say it feels "theirs" by week two.</p>
  `;
  return {
    subject: p.brandName ? `Ready to generate your first post for ${p.brandName}?` : "Ready to generate your first post?",
    html: wrap(content, { appUrl: p.appUrl, preheader: "One click → drafts for all three platforms.", unsubscribeUrl: p.unsubscribeUrl }),
    text: `${greeting}\n\nGenerate your first post: ${p.ctaUrl}\n\nThe more you approve, the sharper the AI gets.`,
  };
}

// ── 3. Brand intelligence preview (Day 3) ──────────────────────────────────
export interface BrandIntelligencePreviewProps extends BaseProps {
  firstName?: string | null;
  brandName: string;
  approvedCount: number;
  topPlatform?: string | null;
  distilledGuideline?: string | null;
}

export function brandIntelligencePreviewEmail(p: BrandIntelligencePreviewProps) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : "Hi,";
  const learning = p.distilledGuideline
    ? `<blockquote style="margin:0 0 16px;padding:12px 16px;background:#f6f4ef;border-left:3px solid #1e5be0;border-radius:0 8px 8px 0;font-style:italic;color:#1a2236;">${p.distilledGuideline}</blockquote>`
    : `<p style="margin:0 0 16px;color:#5e6c84;">It's still early — approve a few more posts and the engine will surface specific guidelines.</p>`;
  const topLine = p.topPlatform
    ? `Most engagement so far: <strong style="text-transform:capitalize;">${p.topPlatform}</strong>.`
    : "";
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a2236;">Here's what KonnectPilot has learned about ${p.brandName}</h1>
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">In the last few days, ${p.approvedCount} approved post${p.approvedCount === 1 ? "" : "s"} have flowed into your brand memory. ${topLine}</p>
    <p style="margin:0 0 8px;font-weight:600;">A pattern it's picked up:</p>
    ${learning}
    ${button("See the full Brand Intelligence panel", p.ctaUrl)}
    <p style="margin:0;color:#5e6c84;font-size:13px;">Every approval makes the next draft sharper. Keep going.</p>
  `;
  return {
    subject: `Brand intelligence preview — what we've learned about ${p.brandName}`,
    html: wrap(content, { appUrl: p.appUrl, preheader: `${p.approvedCount} approvals in, here's what the AI knows.`, unsubscribeUrl: p.unsubscribeUrl }),
    text: `${greeting}\n\nKonnectPilot has learned ${p.approvedCount} thing${p.approvedCount === 1 ? "" : "s"} about ${p.brandName}. See the full panel: ${p.ctaUrl}`,
  };
}

// ── 4. Trial expiring (Day 13) ─────────────────────────────────────────────
export interface TrialExpiringProps extends BaseProps {
  firstName?: string | null;
  hoursLeft: number;
  postsPublished: number;
}

export function trialExpiringEmail(p: TrialExpiringProps) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : "Hi,";
  const usage = p.postsPublished > 0
    ? `You've published ${p.postsPublished} post${p.postsPublished === 1 ? "" : "s"} in your trial.`
    : `You're set up but haven't published yet — there's still time.`;
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a2236;">Your free trial ends in ${Math.round(p.hoursLeft)} hours</h1>
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">${usage}</p>
    <p style="margin:0 0 16px;">After your trial, KonnectPilot keeps running on whichever plan you pick — Starter, Pro, or Agency. You can change plans anytime; cancel from one button.</p>
    ${button("Pick a plan and keep going", p.ctaUrl)}
    <p style="margin:0;color:#5e6c84;font-size:13px;">No surprise charges. If you do nothing, your account drops to the free tier (1 brand, 1 account, 5 credits).</p>
  `;
  return {
    subject: `Your KonnectPilot trial ends in ${Math.round(p.hoursLeft)} hours`,
    html: wrap(content, { appUrl: p.appUrl, preheader: `Pick a plan to keep your brand memory + scheduling alive.`, unsubscribeUrl: p.unsubscribeUrl }),
    text: `${greeting}\n\nYour trial ends in ${Math.round(p.hoursLeft)} hours. Pick a plan: ${p.ctaUrl}\n\nNo surprise charges — you drop to the free tier if you do nothing.`,
  };
}
