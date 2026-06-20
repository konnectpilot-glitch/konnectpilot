import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

/**
 * AI providers used across the app:
 *   - Text captions  → Anthropic Claude via the first-party Anthropic API
 *   - Images         → Google Gemini 2.5 Flash Image ("Nano Banana")
 */

const CLAUDE_MODEL_ID = process.env.ANTHROPIC_MODEL_ID || "claude-haiku-4-5-20251001";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Snapshot of which AI providers are configured at process startup.
 * Read by routes/generate.ts to short-circuit with a clean 503 when a
 * provider is missing, instead of letting a per-request throw turn into
 * a generic 500. Also logged at boot via index.ts so misconfigurations
 * are visible immediately.
 */
export const aiCapabilities = {
  text: !!process.env.ANTHROPIC_API_KEY,
  image: !!process.env.NANOBANANAAPI_KEY,
} as const;

export type ClaudeUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ClaudeTextResult = {
  content: string;
  usage: ClaudeUsage;
};

export async function generateClaudeText(
  prompt: string,
  options: { maxTokens?: number } = {},
): Promise<ClaudeTextResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY env var. Get a key at https://console.anthropic.com and add it to artifacts/api-server/.env",
    );
  }

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL_ID,
    max_tokens: options.maxTokens ?? 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return {
    content,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      totalTokens: message.usage.input_tokens + message.usage.output_tokens,
    },
  };
}

// ───────────────────────────── Nano Banana (image) ──────────────────────────
//
// Uses nanobananaapi.ai — a third-party reseller that proxies Gemini 2.5 Flash
// Image. Async API: submit task → poll for taskId → download result image.
// We preserve the synchronous-feeling { dataUrl, mimeType } return shape so
// existing callers don't need changes.
//
// ⚠️ Pre-launch: swap to Google direct (GOOGLE_API_KEY_NANO_BANANA + billing)
// or OpenAI gpt-image-1 for production. This reseller is for local dev / MVP.

const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

export type NanoBananaImage = {
  /** data URL `data:image/png;base64,...` ready to inline or store. */
  dataUrl: string;
  mimeType: string;
};

export async function generateNanoBananaImage(
  prompt: string,
  options: { timeoutMs?: number; referenceImageUrls?: string[] } = {},
): Promise<NanoBananaImage> {
  const apiKey = process.env.NANOBANANAAPI_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing NANOBANANAAPI_KEY secret for Nano Banana image generation. Get one at https://nanobananaapi.ai/api-key",
    );
  }

  const totalTimeoutMs = options.timeoutMs ?? 120_000;
  const deadline = Date.now() + totalTimeoutMs;
  const authHeader = { Authorization: `Bearer ${apiKey}` } as const;

  const refs = (options.referenceImageUrls ?? []).filter(Boolean);
  const useV2 = refs.length > 0;

  // 1. Submit generation task. Use generate-2 (image-to-image, $0.04/img) when
  //    reference images are provided so brand visuals carry through; fall back
  //    to standard generate (text-to-image, $0.02/img) otherwise.
  const endpoint = useV2
    ? `${NANO_BANANA_BASE}/api/v1/nanobanana/generate-2`
    : `${NANO_BANANA_BASE}/api/v1/nanobanana/generate`;
  const body = useV2
    ? { prompt, imageUrls: refs, outputFormat: "jpg" }
    : { prompt, type: "TEXTTOIAMGE", numImages: 1 };

  const submitRes = await fetch(endpoint, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!submitRes.ok) {
    const txt = await submitRes.text().catch(() => "");
    throw new Error(`Nano Banana submit HTTP ${submitRes.status}: ${txt.slice(0, 300)}`);
  }
  const submitBody: any = await submitRes.json();
  const taskId: string | undefined = submitBody?.data?.taskId;
  if (!taskId) {
    throw new Error(`Nano Banana submit returned no taskId: ${JSON.stringify(submitBody).slice(0, 300)}`);
  }

  // 2. Poll for result. Vendor recommends 30s interval but most jobs finish in
  //    ~10–20s; 3s keeps perceived latency low without hammering them.
  let resultImageUrl: string | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(
      `${NANO_BANANA_BASE}/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
      { headers: authHeader },
    );
    if (!pollRes.ok) {
      const txt = await pollRes.text().catch(() => "");
      throw new Error(`Nano Banana poll HTTP ${pollRes.status}: ${txt.slice(0, 300)}`);
    }
    const pollBody: any = await pollRes.json();
    const data = pollBody?.data ?? {};
    const successFlag: number | undefined = data?.successFlag;
    // 0 = generating, 1 = success, 2 = task-create-failed, 3 = generation-failed
    if (successFlag === 1) {
      resultImageUrl = data?.response?.resultImageUrl ?? null;
      break;
    }
    if (successFlag === 2 || successFlag === 3) {
      const msg = data?.errorMessage || pollBody?.msg || "unknown failure";
      throw new Error(`Nano Banana generation failed (flag=${successFlag}): ${msg}`);
    }
    // else: still generating, keep polling
  }
  if (!resultImageUrl) {
    throw new Error(`Nano Banana generation timed out after ${totalTimeoutMs}ms`);
  }

  // 3. Download the image and inline as data URL
  const imgRes = await fetch(resultImageUrl);
  if (!imgRes.ok) {
    throw new Error(`Nano Banana image download HTTP ${imgRes.status}`);
  }
  const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return { dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`, mimeType };
}
