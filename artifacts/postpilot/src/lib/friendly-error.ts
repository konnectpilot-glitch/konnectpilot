// Centralizes how we turn API/network errors into something a US ecommerce
// seller can actually understand. The goal is: never let a raw JSON blob,
// HTTP status, or stack trace reach a toast.
//
// Pattern: `toast.error(friendlyError(err))` instead of
// `toast.error(err?.data?.error ?? "Failed")`. The fallback already exists in
// many places, but the API error strings themselves are often technical
// ("InvalidArgumentError: brandId must be numeric") — this layer fixes that.

type AnyErr = unknown;

// Map of "if the raw error contains X, show Y" rules. Order matters — first
// match wins. Keep keys lowercase; we lowercase the haystack before matching.
const PATTERNS: Array<[string | RegExp, string]> = [
  // Auth / session
  ["unauthorized", "Your session expired. Please sign in again."],
  ["401", "Your session expired. Please sign in again."],
  ["forbidden", "You don't have permission to do that."],
  ["403", "You don't have permission to do that."],

  // Network
  ["failed to fetch", "Can't reach the server. Check your connection and try again."],
  ["network error", "Can't reach the server. Check your connection and try again."],
  ["timeout", "The request took too long. Try again in a moment."],

  // Stripe / billing
  ["payment service not configured", "Billing isn't set up yet — try again later."],
  ["no billing account", "Subscribe to a plan first to access billing."],
  ["stripe price id", "This plan isn't quite ready yet — please contact support."],

  // Quota / limits
  [/credits?.*exhausted/i, "You've used all your credits this month. Top up or upgrade to keep going."],
  [/credits?.*insufficient/i, "Not enough credits for that. Top up or upgrade to continue."],
  [/brand limit/i, "You've hit your brand limit. Upgrade to add more brands."],
  [/social account limit/i, "You've hit your connected-account limit. Upgrade to connect more."],

  // OAuth
  ["invalid_platform", "That platform isn't supported yet."],
  ["oauth", "Couldn't connect that account. Try disconnecting and reconnecting."],
  ["token expired", "Your social account session expired. Please reconnect."],

  // Validation
  ["required", "Some required fields are missing — please fill them in."],
  ["already exists", "Something with that name already exists."],

  // Generic 5xx
  [/500|internal server/i, "Something went wrong on our end. We've been notified — please try again."],
  [/502|503|504/, "The server is having a moment. Try again in a few seconds."],

  // AI provider
  [/anthropic|bedrock|claude/i, "AI is having a hiccup. Try regenerating in a moment."],
  [/gemini|image gen/i, "Image generation hiccupped. Try again — the next one usually works."],
];

/**
 * Turn any error-shaped thing into a one-sentence string fit for a toast.
 * Always returns a non-empty string; never leaks raw stack traces or JSON.
 */
export function friendlyError(err: AnyErr, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  // Best-effort extraction across the shapes our app actually throws.
  const candidates: string[] = [];
  if (typeof err === "string") candidates.push(err);
  if (err instanceof Error) candidates.push(err.message);
  if (typeof err === "object" && err !== null) {
    const e: any = err;
    if (typeof e.message === "string") candidates.push(e.message);
    if (typeof e?.data?.error === "string") candidates.push(e.data.error);
    if (typeof e?.data?.message === "string") candidates.push(e.data.message);
    if (typeof e?.response?.data?.error === "string") candidates.push(e.response.data.error);
    if (typeof e?.statusText === "string") candidates.push(e.statusText);
    if (typeof e?.status === "number") candidates.push(String(e.status));
  }

  const haystack = candidates.join(" ").toLowerCase();
  if (!haystack.trim()) return fallback;

  for (const [pattern, friendly] of PATTERNS) {
    if (typeof pattern === "string") {
      if (haystack.includes(pattern)) return friendly;
    } else if (pattern.test(haystack)) {
      return friendly;
    }
  }

  // If no pattern matched, prefer the API's own message when it's short
  // and human (under 120 chars, no curly braces, no stack-y stuff).
  for (const c of candidates) {
    const trimmed = c.trim();
    if (trimmed && trimmed.length <= 120 && !trimmed.includes("{") && !trimmed.includes("at ")) {
      return trimmed;
    }
  }

  return fallback;
}
