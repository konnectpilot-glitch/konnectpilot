import { eq, and, desc } from "drizzle-orm";
import {
  db,
  brandMemoryProfilesTable,
  postFeedbackEventsTable,
  type FeedbackAction,
} from "@workspace/db";
import { generateClaudeText } from "./ai-providers";
import { logger } from "./logger";

const MAX_SAMPLES = 10;
const MAX_EDIT_PATTERNS = 10;
const DISTILL_EVERY_N_SIGNALS = 5;

export async function getBrandMemory(brandId: number) {
  const [row] = await db
    .select()
    .from(brandMemoryProfilesTable)
    .where(eq(brandMemoryProfilesTable.brandId, brandId));
  return row ?? null;
}

async function ensureProfile(brandId: number) {
  const existing = await getBrandMemory(brandId);
  if (existing) return existing;
  const [created] = await db
    .insert(brandMemoryProfilesTable)
    .values({ brandId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // race — fetch again
  return (await getBrandMemory(brandId))!;
}

function trimSnippet(s: string | null | undefined, max = 400): string {
  if (!s) return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/**
 * Distil approved/rejected/edited samples into a single short style guide
 * string the prompt can inject. Falls back gracefully on any error — the
 * profile still tracks raw samples so we never lose signal.
 */
async function distillGuidelines(profile: typeof brandMemoryProfilesTable.$inferSelect) {
  const approved = profile.approvedSamples.slice(0, 6).map((s, i) => `A${i + 1}. ${s}`).join("\n");
  const rejected = profile.rejectedSamples.slice(0, 4).map((s, i) => `R${i + 1}. ${s}`).join("\n");
  const edits = (profile.editPatterns ?? [])
    .slice(0, 6)
    .map((p, i) => `E${i + 1}. BEFORE: "${p.from}" -> AFTER: "${p.to}"`)
    .join("\n");

  const prompt = `You are a brand-voice analyst. Read the following user feedback signals from a social-media content tool and write a SHORT style guide (max 8 bullet points, max 80 words total) describing the tone, voice, structure, and forbidden patterns we should follow when generating future posts. Be concrete.

APPROVED EXAMPLES (good — match this voice):
${approved || "(none yet)"}

REJECTED EXAMPLES (bad — avoid this voice):
${rejected || "(none yet)"}

USER EDITS (left side was generated, right side is what the user changed it to):
${edits || "(none yet)"}

Return ONLY the bullet-point style guide, no preamble.`;

  try {
    const { content } = await generateClaudeText(prompt, { maxTokens: 300 });
    return content.trim() || null;
  } catch (err: any) {
    logger.warn({ err: err?.message, brandId: profile.brandId }, "Distill brand guidelines failed");
    return null;
  }
}

/**
 * Record a feedback signal (approve/reject/edit/auto_*) on a post and
 * incrementally update the brand memory profile. Periodically re-distils
 * the profile into a single style-guide blob.
 */
export async function recordFeedback(args: {
  postId: number;
  brandId: number;
  action: FeedbackAction;
  reason?: string | null;
  originalContent?: string | null;
  finalContent?: string | null;
}) {
  const { postId, brandId, action, reason, originalContent, finalContent } = args;
  await db.insert(postFeedbackEventsTable).values({
    postId,
    brandId,
    action,
    reason: reason ?? null,
    originalContent: originalContent ?? null,
    finalContent: finalContent ?? null,
  });

  const profile = await ensureProfile(brandId);
  const updates: Partial<typeof brandMemoryProfilesTable.$inferInsert> = {};
  let approvedSamples = profile.approvedSamples;
  let rejectedSamples = profile.rejectedSamples;
  let editPatterns = profile.editPatterns ?? [];

  if (action === "approved" || action === "auto_approved") {
    const snip = trimSnippet(finalContent ?? originalContent);
    if (snip) approvedSamples = [snip, ...approvedSamples].slice(0, MAX_SAMPLES);
    updates.approvedCount = profile.approvedCount + 1;
  } else if (action === "rejected" || action === "auto_rejected") {
    const snip = trimSnippet(finalContent ?? originalContent);
    if (snip) rejectedSamples = [snip, ...rejectedSamples].slice(0, MAX_SAMPLES);
    updates.rejectedCount = profile.rejectedCount + 1;
  } else if (action === "edited") {
    if (originalContent && finalContent && originalContent !== finalContent) {
      editPatterns = [
        { from: trimSnippet(originalContent, 200), to: trimSnippet(finalContent, 200) },
        ...editPatterns,
      ].slice(0, MAX_EDIT_PATTERNS);
    }
    updates.editedCount = profile.editedCount + 1;
  }

  updates.approvedSamples = approvedSamples;
  updates.rejectedSamples = rejectedSamples;
  updates.editPatterns = editPatterns;

  await db
    .update(brandMemoryProfilesTable)
    .set(updates)
    .where(eq(brandMemoryProfilesTable.brandId, brandId));

  // Periodically distill into a style guide
  const totalSignals =
    (updates.approvedCount ?? profile.approvedCount) +
    (updates.rejectedCount ?? profile.rejectedCount) +
    (updates.editedCount ?? profile.editedCount);
  if (totalSignals > 0 && totalSignals % DISTILL_EVERY_N_SIGNALS === 0) {
    const fresh = await getBrandMemory(brandId);
    if (fresh) {
      const distilled = await distillGuidelines(fresh);
      if (distilled) {
        await db
          .update(brandMemoryProfilesTable)
          .set({ distilledGuidelines: distilled })
          .where(eq(brandMemoryProfilesTable.brandId, brandId));
      }
    }
  }
}

/**
 * Build the "learned brand voice" snippet that should be appended to
 * generation prompts. Returns empty string if no signals yet.
 */
export async function buildBrandMemoryContext(brandId: number): Promise<string> {
  const profile = await getBrandMemory(brandId);
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.distilledGuidelines) {
    parts.push(`LEARNED STYLE GUIDE (derived from this user's prior approvals/edits — follow strictly):\n${profile.distilledGuidelines}`);
  }
  if (profile.approvedSamples.length > 0) {
    parts.push(
      `RECENTLY APPROVED EXAMPLES (match this voice):\n` +
        profile.approvedSamples.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n"),
    );
  }
  if (profile.rejectedSamples.length > 0) {
    parts.push(
      `RECENTLY REJECTED (avoid this voice/structure):\n` +
        profile.rejectedSamples.slice(0, 2).map((s, i) => `${i + 1}. ${s}`).join("\n"),
    );
  }
  if ((profile.editPatterns ?? []).length > 0) {
    parts.push(
      `USER EDIT PATTERNS (the user has rewritten our drafts like this — emulate the AFTER style):\n` +
        profile.editPatterns
          .slice(0, 3)
          .map((p, i) => `${i + 1}. BEFORE: "${p.from}" -> AFTER: "${p.to}"`)
          .join("\n"),
    );
  }
  return parts.length > 0 ? `\n\n--- BRAND MEMORY ---\n${parts.join("\n\n")}\n--- END BRAND MEMORY ---\n` : "";
}

/**
 * AI second-pass brand validator used in auto-approval mode. Returns
 * { ok: true } if the post matches the brand voice and is safe to publish,
 * or { ok: false, reason } if it should be rejected.
 */
export async function aiBrandReview(args: {
  brand: { name: string; industry: string; tone: string; targetAudience: string; keywords: string };
  platform: string;
  content: string;
  brandMemory: string;
}): Promise<{ ok: boolean; reason: string }> {
  const { brand, platform, content, brandMemory } = args;
  const prompt = `You are a strict brand-voice quality reviewer. Decide whether the social media post below is safe to auto-publish without human review.

BRAND: ${brand.name} (${brand.industry})
TONE: ${brand.tone}
AUDIENCE: ${brand.targetAudience}
KEYWORDS: ${brand.keywords}
PLATFORM: ${platform}
${brandMemory}

POST TO REVIEW:
"""
${content}
"""

Reject if any of these are true:
- Off-brand voice, wrong tone, or wrong audience.
- Contains placeholder text ("[insert ...]", "TODO", "Lorem ipsum", "{{...}}").
- Empty, almost-empty, or generic ("Check out our products!").
- Contains unsafe, misleading, or controversial claims.
- Contradicts the LEARNED STYLE GUIDE above.
- Violates platform conventions (e.g. >280 chars on Twitter).

Respond with ONLY a single line of JSON, no markdown:
{"ok": true} OR {"ok": false, "reason": "<short reason, max 120 chars>"}`;

  try {
    const { content } = await generateClaudeText(prompt, { maxTokens: 200 });
    const text = content.trim();
    // Tolerate code fences
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    if (parsed?.ok === true) return { ok: true, reason: "Approved by AI brand review." };
    return { ok: false, reason: String(parsed?.reason ?? "Rejected by AI brand review.").slice(0, 200) };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "AI brand review failed; defaulting to manual review");
    // Failure → safe default: do NOT auto-approve.
    return { ok: false, reason: "AI brand review unavailable; pending manual review." };
  }
}
