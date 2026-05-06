import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { logger } from "./logger";

/**
 * AI providers used across the app:
 *   - Text captions  → Anthropic Claude on AWS Bedrock (ConverseCommand)
 *   - Images         → Google Gemini 2.5 Flash Image ("Nano Banana")
 */

const BEDROCK_REGION = process.env.AWS_REGION || "eu-north-1";
const CLAUDE_MODEL_ID =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "arn:aws:bedrock:eu-north-1:336846061819:inference-profile/global.anthropic.claude-opus-4-7";

/**
 * Bedrock SDK accepts an API key via the AWS_BEARER_TOKEN_BEDROCK env var
 * (introduced 2025) and uses it automatically when no IAM credentials are set.
 * We construct a single shared client.
 */
const bedrock = new BedrockRuntimeClient({ region: BEDROCK_REGION });

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
  const cmd = new ConverseCommand({
    modelId: CLAUDE_MODEL_ID,
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: options.maxTokens ?? 1024 },
  });
  const out = await bedrock.send(cmd);
  const blocks = out.output?.message?.content ?? [];
  const content = blocks
    .map((b) => (typeof (b as any).text === "string" ? (b as any).text : ""))
    .join("")
    .trim();
  return {
    content,
    usage: {
      inputTokens: out.usage?.inputTokens,
      outputTokens: out.usage?.outputTokens,
      totalTokens: out.usage?.totalTokens,
    },
  };
}

// ───────────────────────────── Gemini Nano Banana (image) ─────────────────────

const NANO_BANANA_MODEL = "gemini-2.5-flash-image";
const NANO_BANANA_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_MODEL}:generateContent`;

export type NanoBananaImage = {
  /** data URL `data:image/png;base64,...` ready to inline or store. */
  dataUrl: string;
  mimeType: string;
};

export async function generateNanoBananaImage(
  prompt: string,
  options: { timeoutMs?: number } = {},
): Promise<NanoBananaImage> {
  const apiKey =
    process.env.GOOGLE_API_KEY_NANO_BANNA ||
    process.env.GOOGLE_API_KEY_NANO_BANANA ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GOOGLE_API_KEY_NANO_BANNA secret for Nano Banana image generation",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 120_000,
  );
  try {
    const res = await fetch(`${NANO_BANANA_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Nano Banana HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }
    const body: any = await res.json();
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    if (!imgPart) {
      logger.warn({ body }, "Nano Banana returned no image part");
      throw new Error("Nano Banana returned no image data");
    }
    const mimeType: string = imgPart.inlineData.mimeType || "image/png";
    const data: string = imgPart.inlineData.data;
    return { dataUrl: `data:${mimeType};base64,${data}`, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}
