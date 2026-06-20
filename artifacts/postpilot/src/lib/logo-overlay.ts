// Frontend canvas composite — draws a brand logo on top of a generated
// image at a chosen position. We do this on the client (not on Nano Banana's
// server) because AI image models reliably mangle logos: text gets warped,
// colors shift, edges get smushed. A clean canvas overlay guarantees the
// exact uploaded logo lands in the exact position the user picked.
//
// Pure browser code, no native deps. Both inputs are data URIs (which is
// already how logos and AI images live on the client), so there's no
// network hop.

export type LogoPosition =
  | "none"
  | "bottom_right"
  | "bottom_left"
  | "top_right"
  | "top_left"
  | "centered_footer";

interface OverlayOptions {
  /** Logo size as a fraction of the smaller image dimension (e.g. 0.15 = 15%). */
  sizeRatio?: number;
  /** Padding from the image edge as a fraction of the smaller dimension. */
  paddingRatio?: number;
  /** Translucent backdrop pill behind the logo for legibility on busy bgs. */
  backdrop?: boolean;
}

const DEFAULTS: Required<OverlayOptions> = {
  sizeRatio: 0.16,      // ~16% of the short side; readable but not overpowering
  paddingRatio: 0.04,   // ~4% breathing room from the edge
  backdrop: true,       // most AI images have busy textures; backdrop fixes legibility
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Detect whether the image has a near-uniform light background by sampling
 * the four corner pixels. If they're all close to each other AND close to
 * white-ish, we can safely flood-out that background as transparent.
 */
function detectBackgroundColor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { r: number; g: number; b: number } | null {
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ] as const;
  const samples: Array<[number, number, number]> = [];
  for (const [x, y] of corners) {
    const px = ctx.getImageData(x, y, 1, 1).data;
    samples.push([px[0], px[1], px[2]]);
  }
  // All four corners must agree within ±15 per channel — i.e. uniform background.
  const [r0, g0, b0] = samples[0];
  for (const [r, g, b] of samples.slice(1)) {
    if (Math.abs(r - r0) > 15 || Math.abs(g - g0) > 15 || Math.abs(b - b0) > 15) {
      return null; // not a uniform background — likely already transparent or a real image
    }
  }
  // And that color must be "light" (any of R/G/B above 230) for us to call
  // it a background that should drop out. Dark uniform backgrounds (e.g. a
  // logo on black) are valid design choices — don't touch them.
  if (Math.max(r0, g0, b0) < 230) return null;
  return { r: r0, g: g0, b: b0 };
}

/**
 * Take a logo data URI that probably has a white background and return a
 * new data URI with the background replaced by transparency. Uses corner-
 * pixel sampling — same trick Photoshop's magic wand uses — with a
 * tolerance so anti-aliased edges fade naturally.
 *
 * If the logo already has transparency (alpha < 255 on any corner), or if
 * the background isn't uniform light, we return the original untouched.
 */
async function stripWhiteBackground(logoDataUri: string): Promise<string> {
  const img = await loadImage(logoDataUri);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return logoDataUri;
  ctx.drawImage(img, 0, 0);

  // Quick check: if any corner is already transparent, the logo already has
  // a transparent bg — nothing to do.
  const corner = ctx.getImageData(0, 0, 1, 1).data;
  if (corner[3] < 250) return logoDataUri;

  const bg = detectBackgroundColor(ctx, canvas.width, canvas.height);
  if (!bg) return logoDataUri; // not a uniform light bg — leave alone

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = data.data;
  // Tolerance — how close to the background a pixel has to be to fade.
  // 35 catches anti-aliased edges nicely without nuking dark logo strokes.
  const HARD_TOLERANCE = 22; // fully transparent within this distance
  const SOFT_TOLERANCE = 60; // partial transparency up to here (edge feather)
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const dist = Math.sqrt(
      (r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2,
    );
    if (dist < HARD_TOLERANCE) {
      pixels[i + 3] = 0;
    } else if (dist < SOFT_TOLERANCE) {
      // linear feather between hard and soft — preserves anti-aliased edges
      const t = (dist - HARD_TOLERANCE) / (SOFT_TOLERANCE - HARD_TOLERANCE);
      pixels[i + 3] = Math.round(pixels[i + 3] * t);
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

// Module-level cache so we only strip a given logo once per session.
const stripCache = new Map<string, Promise<string>>();
function getCleanLogo(logoDataUri: string): Promise<string> {
  if (!stripCache.has(logoDataUri)) {
    stripCache.set(logoDataUri, stripWhiteBackground(logoDataUri).catch(() => logoDataUri));
  }
  return stripCache.get(logoDataUri)!;
}

/**
 * Composite `logoDataUri` onto `baseImageDataUri` at the chosen position.
 * Returns a data URL of the composite. If position is "none", just returns
 * the base unchanged.
 *
 * Throws on unrecoverable errors (invalid base image). The caller should
 * fall back to displaying the AI image without the logo rather than blocking.
 */
export async function compositeLogo(
  baseImageDataUri: string,
  logoDataUri: string,
  position: LogoPosition,
  options: OverlayOptions = {},
): Promise<string> {
  if (position === "none") return baseImageDataUri;
  if (!logoDataUri) return baseImageDataUri;

  const opts = { ...DEFAULTS, ...options };

  // Auto-strip white background from the logo so it doesn't sit on an
  // obvious white box over the AI image. Cached per-session so we only pay
  // this cost once per logo no matter how many times the user re-composites.
  const cleanLogoDataUri = await getCleanLogo(logoDataUri);

  const [baseImg, logoImg] = await Promise.all([
    loadImage(baseImageDataUri),
    loadImage(cleanLogoDataUri),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");

  // 1. Base image fills the canvas
  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  // 2. Compute logo target size preserving aspect ratio
  const shortSide = Math.min(canvas.width, canvas.height);
  const targetHeight = Math.round(shortSide * opts.sizeRatio);
  const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
  const targetWidth = Math.round(targetHeight * aspect);
  const pad = Math.round(shortSide * opts.paddingRatio);

  // 3. Compute placement
  let x = 0;
  let y = 0;
  switch (position) {
    case "bottom_right":
      x = canvas.width - targetWidth - pad;
      y = canvas.height - targetHeight - pad;
      break;
    case "bottom_left":
      x = pad;
      y = canvas.height - targetHeight - pad;
      break;
    case "top_right":
      x = canvas.width - targetWidth - pad;
      y = pad;
      break;
    case "top_left":
      x = pad;
      y = pad;
      break;
    case "centered_footer":
      x = Math.round((canvas.width - targetWidth) / 2);
      y = canvas.height - targetHeight - pad;
      break;
  }

  // 4. Soft drop shadow — gives the logo legibility on busy AI backgrounds
  // without the "pasted sticker" feel of a white pill. The shadow follows
  // the actual logo silhouette (because we've already stripped the bg to
  // transparent), so it reads as a watermark, not a label.
  if (opts.backdrop) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = Math.max(8, Math.round(targetHeight * 0.12));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(targetHeight * 0.02));
    ctx.drawImage(logoImg, x, y, targetWidth, targetHeight);
    ctx.restore();
  }

  // 5. The logo itself (crisp on top of the shadow)
  ctx.drawImage(logoImg, x, y, targetWidth, targetHeight);

  // 6. Return the composite as a PNG data URL. PNG preserves logo crispness;
  // JPEG would visibly compress text edges. If the base image came from a
  // cross-origin source without CORS headers, the canvas is "tainted" and
  // toDataURL throws SecurityError — fall back to the un-composited image
  // so the user still sees something rather than a hard failure.
  try {
    return canvas.toDataURL("image/png");
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("Logo overlay: canvas tainted (likely CORS on AI image); returning base image", err?.name);
    return baseImageDataUri;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Text-hook overlay
// ───────────────────────────────────────────────────────────────────────────
// The single biggest scroll-stopper on ecommerce social is a bold text HOOK
// baked onto the image — e.g. "This mistake costs sellers $1,000s". We do NOT
// ask the AI image model to render this text: Gemini (and every diffusion
// model) reliably garbles letters. Instead we draw the hook ourselves on a
// canvas, exactly like the logo overlay — guaranteeing crisp, legible,
// correctly-spelled type every time. The image briefs already reserve clean
// space in the top/bottom third for this.

export type HookPosition = "none" | "top" | "center" | "bottom";

interface TextHookOptions {
  /** Max fraction of image width the text block may occupy. */
  maxWidthRatio?: number;
  /** Starting font size as a fraction of image width (auto-shrinks to fit). */
  fontRatio?: number;
  /** Max number of wrapped lines before we shrink the font further. */
  maxLines?: number;
}

const HOOK_DEFAULTS: Required<TextHookOptions> = {
  maxWidthRatio: 0.86,
  fontRatio: 0.1, // ~10% of width for the first line; shrinks if it overflows
  maxLines: 3,
};

/** Greedy word-wrap: returns the lines that fit within maxWidth at the given font. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draw a bold, crisp text hook onto a generated image and return a new data
 * URL. The text is auto-wrapped and auto-sized to fit, sits on a soft gradient
 * scrim for legibility on any background, and is placed in the chosen third.
 *
 * Never throws for empty/none input — returns the base image untouched so the
 * caller can always render something.
 */
export async function compositeTextHook(
  baseImageDataUri: string,
  text: string,
  position: HookPosition,
  options: TextHookOptions = {},
): Promise<string> {
  if (position === "none") return baseImageDataUri;
  const hook = (text ?? "").trim();
  if (!hook) return baseImageDataUri;

  const opts = { ...HOOK_DEFAULTS, ...options };
  const baseImg = await loadImage(baseImageDataUri);

  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");

  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;
  const maxTextWidth = W * opts.maxWidthRatio;

  // Auto-fit: shrink the font until the wrapped text fits within maxLines.
  let fontSize = Math.round(W * opts.fontRatio);
  const minFont = Math.round(W * 0.05);
  let lines: string[] = [];
  const fontFamily =
    '"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif';
  while (fontSize >= minFont) {
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, hook.toUpperCase(), maxTextWidth);
    if (lines.length <= opts.maxLines) break;
    fontSize -= Math.max(2, Math.round(fontSize * 0.06));
  }

  const lineHeight = Math.round(fontSize * 1.12);
  const blockHeight = lineHeight * lines.length;
  const pad = Math.round(H * 0.045);

  // Vertical anchor (top of the text block) per chosen third.
  let blockTop: number;
  switch (position) {
    case "top":
      blockTop = pad;
      break;
    case "center":
      blockTop = Math.round((H - blockHeight) / 2);
      break;
    case "bottom":
    default:
      blockTop = H - blockHeight - pad;
      break;
  }

  // Soft gradient scrim behind the text band so the hook is legible on any
  // background without a hard rectangle. Fades toward the image center.
  const scrimPad = Math.round(fontSize * 0.6);
  const scrimTop = Math.max(0, blockTop - scrimPad);
  const scrimBottom = Math.min(H, blockTop + blockHeight + scrimPad);
  const scrimH = scrimBottom - scrimTop;
  const grad = ctx.createLinearGradient(0, scrimTop, 0, scrimBottom);
  if (position === "top") {
    grad.addColorStop(0, "rgba(0,0,0,0.62)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
  } else if (position === "bottom") {
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.62)");
  } else {
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, scrimTop, W, scrimH);

  // The text itself — white, heavy, centered, with a subtle dark stroke +
  // shadow so it stays readable even where the scrim is thin.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `800 ${fontSize}px ${fontFamily}`;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(fontSize * 0.12);
  ctx.shadowOffsetY = Math.round(fontSize * 0.03);

  lines.forEach((line, i) => {
    const y = blockTop + i * lineHeight;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.06));
    ctx.strokeText(line, W / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, W / 2, y);
  });

  try {
    return canvas.toDataURL("image/png");
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("Text hook: canvas tainted (likely CORS on AI image); returning base image", err?.name);
    return baseImageDataUri;
  }
}

