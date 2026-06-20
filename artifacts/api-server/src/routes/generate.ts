import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandsTable, postsTable } from "@workspace/db";
import {
  GeneratePostBody,
  GeneratePostResponse,
  SaveGeneratedPostBody,
} from "@workspace/api-zod";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import { logger } from "../lib/logger";
import { generateClaudeText, generateNanoBananaImage, aiCapabilities } from "../lib/ai-providers";
import { reserveQuota, releaseReservation, setReservationTokens } from "../lib/quotas";
import { buildBrandMemoryContext } from "../lib/brand-memory";
import { buildPerformanceMemoryContext } from "../lib/performance-memory";
import { buildProfessionalImageBrief, buildVariantImageBriefs } from "../lib/image-brief";
import { buildCaptionBrief, buildCaptionVariantsBrief, type Platform as CaptionPlatform } from "../lib/caption-brief";
import { writeImageHook } from "../lib/hook-writer";

const router: IRouter = Router();

// Logo URL helper — delegates to the signed-URL implementation in
// routes/brands.ts so the URL we hand to Nano Banana includes a short-lived
// HMAC token. Logos are no longer accessible without a valid token.
import { buildSignedLogoUrl } from "./brands";
const buildPublicLogoUrl = buildSignedLogoUrl;

function quotaExceededResponse(
  res: any,
  result: { used: number; limit: number; bonus: number; cost: number },
  plan: string,
) {
  res.status(402).json({
    error: `You're out of credits this month (${result.used.toFixed(1)} / ${result.limit} used, ${result.bonus.toFixed(1)} bonus). Top up or upgrade to keep generating.`,
    code: "quota_exceeded",
    used: result.used,
    limit: result.limit,
    bonus: result.bonus,
    cost: result.cost,
    plan,
  });
}

// Delegates to the shared caption-brief builder (lib/caption-brief.ts) which
// also drives the scheduler — keeps both paths producing the same quality.
function buildPrompt(brand: any, platform: string, topic?: string | null, brandMemory: string = ""): string {
  return buildCaptionBrief({
    brand,
    platform: platform as CaptionPlatform,
    topic: topic ?? null,
    memoryContext: brandMemory,
  });
}

router.post("/generate", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!aiCapabilities.text) {
    res.status(503).json({
      code: "ai_text_disabled",
      error: "Text generation is not configured on this server. Contact the administrator.",
    });
    return;
  }
  const parsed = GeneratePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.workspaceId, req.workspaceId)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const user = req.user;
  // Variant count — 1 (default, single caption) or 3 (three caption options).
  // Each variant costs one text_post credit (0.5 credits in the standard plan).
  const requestedCount = Math.max(1, Math.min(3, Number(req.body?.count) || 1));

  // Reserve N text_post credits — one per variant. Releases unused
  // reservations if some renders fail or if we fall back to fewer outputs.
  type Reservation = { reservationId: number; usedBonus: boolean };
  const reservations: Reservation[] = [];
  for (let i = 0; i < requestedCount; i++) {
    const r = await reserveQuota(user.id, user.plan, "caption", "text_post");
    if (!r.allowed) {
      for (const prior of reservations) {
        await releaseReservation(prior.reservationId, prior.usedBonus);
      }
      quotaExceededResponse(res, r, user.plan);
      return;
    }
    reservations.push({ reservationId: r.reservationId, usedBonus: r.usedBonus });
  }

  const [brandMemory, perfMemory] = await Promise.all([
    buildBrandMemoryContext(brand.id),
    buildPerformanceMemoryContext(brand.id),
  ]);

  // SINGLE caption — legacy path, fully backwards-compatible response.
  if (requestedCount === 1) {
    const prompt = buildPrompt(brand, parsed.data.platform, parsed.data.topic, brandMemory + perfMemory);
    try {
      const { content, usage } = await generateClaudeText(prompt, { maxTokens: 1024 });
      await setReservationTokens(reservations[0].reservationId, usage.totalTokens);
      res.json(GeneratePostResponse.parse({
        content,
        platform: parsed.data.platform,
        brandId: parsed.data.brandId,
      }));
    } catch (err) {
      await releaseReservation(reservations[0].reservationId, reservations[0].usedBonus);
      throw err;
    }
    return;
  }

  // VARIANT mode — one Claude call returns N distinct captions in different
  // hook archetypes (contrarian / story-tease / stat / observation /
  // question / list-tease). User picks the one that fits.
  const variantPrompt = buildCaptionVariantsBrief(
    {
      brand,
      platform: parsed.data.platform as CaptionPlatform,
      topic: parsed.data.topic ?? null,
      memoryContext: brandMemory + perfMemory,
    },
    requestedCount,
  );

  let variants: string[];
  try {
    const { content, usage } = await generateClaudeText(variantPrompt, { maxTokens: 2400 });
    // Total tokens across all variants count against the first reservation.
    // We charge per-delivered-variant after parsing so the user is never
    // billed for variants that didn't materialize.
    await setReservationTokens(reservations[0].reservationId, usage.totalTokens);

    // Tolerant JSON parse — Claude sometimes wraps in ```json fences.
    let raw = content.trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) raw = fence[1].trim();
    const parsedArr = JSON.parse(raw);
    if (!Array.isArray(parsedArr)) throw new Error("not an array");
    variants = parsedArr
      .filter((v) => typeof v === "string" && v.trim().length > 10)
      .map((v) => (v as string).trim());
    if (variants.length === 0) throw new Error("no usable variants");
  } catch (err) {
    // Refund all reservations on full failure.
    for (const r of reservations) await releaseReservation(r.reservationId, r.usedBonus);
    logger.warn({ err: (err as any)?.message }, "Caption variant gen failed");
    res.status(502).json({ error: "Couldn't generate caption variants. Please try again." });
    return;
  }

  // Refund any reservations beyond the number of variants we actually got.
  const delivered = Math.min(variants.length, requestedCount);
  for (let i = delivered; i < reservations.length; i++) {
    await releaseReservation(reservations[i].reservationId, reservations[i].usedBonus);
  }

  res.json({
    content: variants[0],
    platform: parsed.data.platform,
    brandId: parsed.data.brandId,
    variants: variants.slice(0, delivered),
    requested: requestedCount,
    delivered,
  });
});

router.post("/generate/image", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!aiCapabilities.image) {
    res.status(503).json({
      code: "ai_image_disabled",
      error: "Image generation is not configured on this server. Contact the administrator.",
    });
    return;
  }
  const { brandId, customPrompt, platform, topic, style } = req.body;
  // Style picker — controls the photography archetype the enhancer asks for.
  // "auto" lets Claude choose based on industry + topic; anything else is a
  // hard directive. Unknown values silently fall through to "auto".
  const validStyles = ["auto", "scroll_stopper", "product_hero", "lifestyle", "editorial", "minimalist_studio", "documentary", "flat_lay"] as const;
  const requestedStyle = (validStyles as readonly string[]).includes(style) ? (style as typeof validStyles[number]) : "auto";
  // Variant count — 1 (default, same as before) or 3. Each variant costs an
  // image credit, so we cap at 3 to keep the bill predictable.
  const requestedCount = Math.max(1, Math.min(3, Number(req.body?.count) || 1));

  // Allow pure custom prompt with no brand required
  if (!customPrompt && !brandId) {
    res.status(400).json({ error: "Provide either a custom prompt or a brand" });
    return;
  }

  const user = req.user;
  // Reserve ONE image credit per variant. We release any unused reservations
  // at the end if some renders fail — so the user is only charged for what
  // actually rendered. Narrowed to the "allowed" variant of the union so
  // downstream code can safely read reservationId/usedBonus.
  type Reservation = { reservationId: number; usedBonus: boolean };
  const reservations: Reservation[] = [];
  for (let i = 0; i < requestedCount; i++) {
    const r = await reserveQuota(user.id, user.plan, "image", "image_post");
    if (!r.allowed) {
      // Release anything we already reserved before bailing.
      for (const prior of reservations) {
        await releaseReservation(prior.reservationId, prior.usedBonus);
      }
      quotaExceededResponse(res, r, user.plan);
      return;
    }
    reservations.push({ reservationId: r.reservationId, usedBonus: r.usedBonus });
  }

  let referenceImageUrls: string[] = [];

  // postContent is the caption the image will accompany — we let the
  // creative-director enhancer use it to inform the visual concept (e.g.
  // a caption about "fresh roast Tuesday" gets a steam-rising coffee scene
  // instead of a generic store hero).
  const postContent: string | null = req.body?.postContent ?? null;

  // Build the brief input once — same shape for single or N variants.
  let briefInput: Parameters<typeof buildProfessionalImageBrief>[0] | null = null;

  if (customPrompt && customPrompt.trim()) {
    briefInput = {
      brand: {
        name: "the brand",
        industry: "general commercial photography",
        targetAudience: "general audience",
        tone: "professional",
      },
      topic: customPrompt.trim(),
      platform: platform ?? null,
      postContent,
      hasLogoReference: false,
      style: requestedStyle,
    };
  } else {
    const [brand] = await db
      .select()
      .from(brandsTable)
      .where(and(eq(brandsTable.id, Number(brandId)), eq(brandsTable.workspaceId, req.workspaceId)));

    if (!brand) {
      for (const r of reservations) await releaseReservation(r.reservationId, r.usedBonus);
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    const logoCount = Array.isArray(brand.logos) ? brand.logos.length : 0;
    const logoRefUrl = buildPublicLogoUrl(brand.id, 0);
    if (logoCount > 0 && logoRefUrl) referenceImageUrls.push(logoRefUrl);

    briefInput = {
      brand: {
        name: brand.name,
        industry: brand.industry,
        targetAudience: brand.targetAudience,
        voiceDescription: brand.voiceDescription,
        tone: brand.tone,
        keywords: brand.keywords,
        brandColorPrimary: brand.brandColorPrimary,
        brandColorSecondary: brand.brandColorSecondary,
        websiteUrl: brand.websiteUrl,
      },
      topic: topic ?? null,
      platform: platform ?? null,
      postContent,
      hasLogoReference: referenceImageUrls.length > 0,
      style: requestedStyle,
    };
  }

  // Produce N briefs. Single-shot when count===1; when count>1, one Claude
  // call returns N DISTINCT briefs (different angles/lighting/subjects) so
  // the variants don't look like re-rolls of the same composition.
  let prompts: string[];
  try {
    prompts = requestedCount > 1
      ? await buildVariantImageBriefs(briefInput, requestedCount)
      : [await buildProfessionalImageBrief(briefInput)];
  } catch (err) {
    logger.warn({ err: (err as any)?.message }, "Image brief enhancer failed; using structured fallback");
    const fb = `A scroll-stopping social image${customPrompt ? ` of ${customPrompt}` : ""} — lead with either a human face showing genuine emotion and near-eye-contact, or the product as a bold close-up hero with one high-contrast color pop. Shot on an iPhone, real ordinary person (not a model) with natural unretouched skin texture, candid feel, one dominant focal point, slightly raw native creator-shot look (not glossy stock), with clean uncluttered space in the top or bottom third for a text hook. 1:1 square aspect ratio composed for ${platform ?? "social"} feed. Photorealistic, real natural skin texture with pores, candid and unretouched, no text overlays, no watermarks, no warped hands, no extra fingers, no plastic or waxy skin, no over-smoothed airbrushed look, no flawless model face, no glossy stock-photo lighting, no AI artifacts, no logos in the image.`;
    prompts = Array(requestedCount).fill(fb);
  }

  logger.info(
    { variantCount: prompts.length, hasLogo: referenceImageUrls.length > 0 },
    "Image brief(s) ready",
  );

  // Render all variants in parallel. Each render takes ~10-20s, so doing
  // them in parallel keeps total wait time roughly equal to one render.
  type RenderResult = { ok: true; imageUrl: string; prompt: string } | { ok: false; error: string };
  const results: RenderResult[] = await Promise.all(
    prompts.map(async (p): Promise<RenderResult> => {
      try {
        const { dataUrl } = await generateNanoBananaImage(p, {
          timeoutMs: 120_000,
          referenceImageUrls,
        });
        return { ok: true, imageUrl: dataUrl, prompt: p };
      } catch (err: any) {
        return { ok: false, error: err?.message ?? "render failed" };
      }
    }),
  );

  const successes = results.filter((r): r is Extract<RenderResult, { ok: true }> => r.ok);
  const failures = results.filter((r) => !r.ok).length;

  // Release credits for failed renders so the user is only billed for
  // variants they actually receive.
  for (let i = 0; i < failures && i < reservations.length; i++) {
    const r = reservations[reservations.length - 1 - i];
    await releaseReservation(r.reservationId, r.usedBonus);
  }

  if (successes.length === 0) {
    const anyTimeout = results.some((r) => !r.ok && /AbortError|timeout|timed out/i.test(r.error));
    logger.error({ failures }, "All Nano Banana renders failed");
    res.status(anyTimeout ? 504 : 502).json({
      error: anyTimeout
        ? "Image generation timed out. The AI service is busy — please try again."
        : "Image generation failed. Please try again.",
    });
    return;
  }

  // Backwards-compat: when count===1, return the legacy single-image shape.
  // When count>1, return successes[0] as the primary AND include the full
  // `variants` array so the UI can render them all.
  if (requestedCount === 1) {
    res.json({ imageUrl: successes[0].imageUrl, prompt: successes[0].prompt });
    return;
  }
  res.json({
    imageUrl: successes[0].imageUrl,
    prompt: successes[0].prompt,
    variants: successes.map((s) => ({ imageUrl: s.imageUrl, prompt: s.prompt })),
    requested: requestedCount,
    delivered: successes.length,
  });
});

// Auto-write a short, scroll-stopping TEXT HOOK for the on-image overlay.
// This is a tiny text call (no image credit) — the user clicks "Auto-write"
// in the Generate UI and we return a punchy 3–7 word hook tuned to the brand.
router.post("/generate/hook", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!aiCapabilities.text) {
    res.status(503).json({ code: "ai_text_disabled", error: "AI text is not configured on this server." });
    return;
  }
  const { brandId, topic, postContent } = req.body ?? {};
  let brand: any = null;
  if (brandId) {
    [brand] = await db
      .select()
      .from(brandsTable)
      .where(and(eq(brandsTable.id, Number(brandId)), eq(brandsTable.workspaceId, req.workspaceId)));
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
  }

  const hook = await writeImageHook({
    brand: brand
      ? {
          name: brand.name,
          industry: brand.industry,
          targetAudience: brand.targetAudience,
          voiceDescription: (brand as any).voiceDescription ?? null,
          tone: (brand as any).tone ?? null,
        }
      : null,
    topic: topic ?? null,
    postContent: postContent ?? null,
  });
  if (!hook) {
    res.status(502).json({ error: "Couldn't write a hook right now. Try again in a moment." });
    return;
  }
  res.json({ hook });
});

router.post("/generate/save", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const parsed = SaveGeneratedPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, parsed.data.brandId), eq(brandsTable.workspaceId, req.workspaceId)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      brandId: parsed.data.brandId,
      workspaceId: req.workspaceId,
      platform: parsed.data.platform,
      content: parsed.data.content,
      status: parsed.data.status,
    })
    .returning();

  res.status(201).json({
    ...post,
    brandName: brand.name,
    imageUrl: post.imageUrl ?? null,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
  });
});

export default router;
