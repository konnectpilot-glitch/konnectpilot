import { logger } from "./logger";

export interface SendEmailArgs {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
  provider?: string;
}

function defaultFrom(): { email: string; name: string } {
  const email = process.env["MAIL_FROM"] ?? process.env["SENDGRID_FROM"] ?? "no-reply@konnectpilot.app";
  const name = process.env["MAIL_FROM_NAME"] ?? "KonnectPilot";
  return { email, name };
}

/**
 * Send an email via SendGrid HTTP API.
 *
 * Configuration (env):
 *   - SENDGRID_API_KEY  – API key. When unset, email sending is a no-op
 *                         (logged at info level) so dev/CI does not fail.
 *   - MAIL_FROM         – From address (default: no-reply@konnectpilot.app)
 *   - MAIL_FROM_NAME    – From display name (default: KonnectPilot)
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const recipients = (args.to ?? []).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false, reason: "no recipients" };
  }
  const apiKey = process.env["SENDGRID_API_KEY"];
  if (!apiKey) {
    logger.warn(
      { to: recipients, subject: args.subject },
      "SENDGRID_API_KEY not configured; skipping email send",
    );
    return { sent: false, reason: "SENDGRID_API_KEY not configured" };
  }
  const from = defaultFrom();
  const body = {
    personalizations: recipients.map((email) => ({ to: [{ email }] })),
    from: { email: from.email, name: from.name },
    subject: args.subject,
    content: [
      ...(args.text ? [{ type: "text/plain", value: args.text }] : []),
      { type: "text/html", value: args.html },
    ],
  };
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status >= 200 && res.status < 300) {
      return { sent: true, provider: "sendgrid" };
    }
    const text = await res.text().catch(() => "");
    logger.warn(
      { status: res.status, body: text.slice(0, 500), to: recipients },
      "SendGrid rejected message",
    );
    return { sent: false, reason: `sendgrid status ${res.status}` };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "sendEmail failed");
    return { sent: false, reason: err?.message ?? "unknown error" };
  }
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env["SENDGRID_API_KEY"]);
}
