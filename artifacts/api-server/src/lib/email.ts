// Email sender — wraps Resend's REST API with a soft fallback. If
// RESEND_API_KEY is not set (dev or staging without a real key), we log
// the payload and return without throwing — so signup flows don't fail
// just because email isn't wired yet.
//
// We deliberately don't pull in the `resend` SDK as a dependency — the API
// is a single HTTP POST, and skipping the SDK keeps the bundle lean.

import type pino from "pino";

const RESEND_API = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Some clients prefer it; Resend will build one if omitted. */
  text?: string;
  /** Reply-To header — defaults to support@. */
  replyTo?: string;
  /** Override the From — defaults to the env-configured sender. */
  from?: string;
  /** Optional tag for Resend dashboard filtering. */
  tag?: string;
}

interface SendOptions {
  log?: pino.Logger;
}

function getDefaultFrom(): string {
  return process.env.EMAIL_FROM ?? "KonnectPilot <hello@konnectpilot.com>";
}

export async function sendEmail(input: SendEmailInput, opts: SendOptions = {}): Promise<{
  status: "sent" | "skipped" | "failed";
  id?: string;
  error?: string;
}> {
  const log = opts.log;
  const apiKey = process.env.RESEND_API_KEY;

  // Dev fallback: log + skip. Lets the rest of the app behave the same in
  // local dev without burning real email volume.
  if (!apiKey) {
    log?.info(
      { to: input.to, subject: input.subject, tag: input.tag },
      "[email:skipped] RESEND_API_KEY not set — email not sent",
    );
    return { status: "skipped" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from ?? getDefaultFrom(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo ?? "hello@konnectpilot.com",
        tags: input.tag ? [{ name: "kind", value: input.tag }] : undefined,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "(no body)");
      log?.warn({ status: res.status, errText, tag: input.tag }, "Resend send failed");
      return { status: "failed", error: `Resend ${res.status}` };
    }
    const data: any = await res.json().catch(() => ({}));
    log?.info({ id: data?.id, to: input.to, tag: input.tag }, "Email sent");
    return { status: "sent", id: data?.id };
  } catch (err: any) {
    log?.warn({ err: err?.message, tag: input.tag }, "Resend send threw");
    return { status: "failed", error: err?.message ?? "unknown" };
  }
}
