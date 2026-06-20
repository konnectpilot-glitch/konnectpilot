// Hook writer
// ───────────
// Writes ONE short, scroll-stopping text hook (3–7 words) to overlay on a
// social image. Shared by the manual Generate flow (/generate/hook) and the
// automated scheduler, so both produce the same punchy style. Tiny text call.

import { generateClaudeText } from "./ai-providers";

export interface HookBrand {
  name?: string | null;
  industry?: string | null;
  targetAudience?: string | null;
  voiceDescription?: string | null;
  tone?: string | null;
}

export interface WriteHookInput {
  brand?: HookBrand | null;
  topic?: string | null;
  postContent?: string | null;
}

/**
 * Generate a single short hook string. Returns "" on failure so callers can
 * decide to skip the overlay rather than blocking the whole pipeline.
 */
export async function writeImageHook(input: WriteHookInput): Promise<string> {
  const { brand, topic, postContent } = input;
  const brandLine = brand
    ? `Brand: ${brand.name ?? "the store"} — ${brand.industry ?? "ecommerce"}. Audience: ${brand.targetAudience ?? "online shoppers"}.${
        brand.voiceDescription ? ` Voice: ${brand.voiceDescription}.` : brand.tone ? ` Tone: ${brand.tone}.` : ""
      }`
    : "Brand: a direct-to-consumer ecommerce store.";
  const topicLine = topic ? `Topic of this post: ${topic}.` : "";
  const captionLine = postContent
    ? `Caption it runs with: """${String(postContent).slice(0, 300)}"""`
    : "";

  const meta = `You are a viral social-media hook writer for ecommerce brands. Write ONE short text HOOK to overlay on a social image — the kind of line that physically stops a thumb mid-scroll and makes someone read the caption.

${brandLine}
${topicLine}
${captionLine}

RULES
- 3 to 7 words. SHORT. It must fit big and bold on an image.
- Curiosity, tension, a bold claim, a number, or a "you're doing X wrong" angle. NOT a generic slogan like "Best deals!".
- No hashtags, no emojis, no quotes, no trailing punctuation.
- Speak to the brand's actual audience and topic.
- Return ONLY the hook text, nothing else.

Examples of the vibe (do not copy): "90% of sellers get this wrong", "Your store is leaking money", "Stop posting like it's 2019", "This costs sellers thousands".`;

  try {
    const result = await generateClaudeText(meta, { maxTokens: 40 });
    let hook = (result.content || "").trim().replace(/^["'\s]+|["'.\s]+$/g, "");
    if (hook.length > 70) hook = hook.slice(0, 70).trim();
    return hook;
  } catch {
    return "";
  }
}
