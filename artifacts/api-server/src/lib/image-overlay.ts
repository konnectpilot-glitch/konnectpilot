// Server-side image overlay
// ──────────────────────────
// Bakes a bold, crisp TEXT HOOK (and optionally the brand logo) onto a
// generated image — on the SERVER, using pureimage (a pure-JS canvas, no
// native deps). This mirrors the browser-side overlay in postpilot's
// logo-overlay.ts, but runs in the scheduler/auto path where there is no
// browser. We never ask the AI image model to render text — diffusion models
// garble letters — so the hook is drawn here with a real font for guaranteed
// legibility and correct spelling.

import * as PImage from "pureimage";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger";

export type HookPosition = "none" | "top" | "center" | "bottom";
export type LogoPosition =
  | "none"
  | "bottom_right"
  | "bottom_left"
  | "top_right"
  | "top_left"
  | "centered_footer";

const FONT_FAMILY = "HookFont";
let fontReady = false;

/** Register + load the bundled bold font exactly once. */
function ensureFont(): void {
  if (fontReady) return;
  const dirname = (globalThis as any).__dirname as string | undefined;
  const candidates = [
    path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf"),
    dirname ? path.join(dirname, "../assets/fonts/DejaVuSans-Bold.ttf") : "",
    dirname ? path.join(dirname, "assets/fonts/DejaVuSans-Bold.ttf") : "",
  ].filter(Boolean);
  const fontPath = candidates.find((p) => fs.existsSync(p));
  if (!fontPath) throw new Error(`Hook font not found. Looked in: ${candidates.join(", ")}`);
  const f = PImage.registerFont(fontPath, FONT_FAMILY);
  // pureimage exposes a synchronous loader; fall back to async if missing.
  if (typeof f.loadSync === "function") f.loadSync();
  fontReady = true;
}

/** Decode a data URL (PNG or JPEG) into a pureimage bitmap. */
async function decodeDataUrl(dataUrl: string): Promise<any> {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(dataUrl);
  const mime = m ? m[1].toLowerCase() : "image/png";
  const b64 = m ? m[2] : dataUrl;
  const buf = Buffer.from(b64, "base64");
  const stream = Readable.from(buf);
  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return await PImage.decodeJPEGFromStream(stream);
  }
  return await PImage.decodePNGFromStream(stream);
}

/** Encode a pureimage bitmap to a PNG data URL. */
function encodePngDataUrl(bmp: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      },
    });
    sink.on("finish", () =>
      resolve("data:image/png;base64," + Buffer.concat(chunks).toString("base64")),
    );
    sink.on("error", reject);
    Promise.resolve(PImage.encodePNGToStream(bmp, sink)).catch(reject);
  });
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(cand).width <= maxWidth || !cur) cur = cand;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Draw the bold hook with a smooth dark scrim + faux outline for legibility. */
function drawHook(bmp: any, hookText: string, position: HookPosition): void {
  const ctx = bmp.getContext("2d");
  const W = bmp.width;
  const H = bmp.height;
  const hook = (hookText || "").trim().toUpperCase();
  if (!hook) return;

  const maxTextWidth = W * 0.86;
  let fontSize = Math.round(W * 0.1);
  const minFont = Math.round(W * 0.05);
  let lines: string[] = [];
  while (fontSize >= minFont) {
    ctx.font = `${fontSize}px '${FONT_FAMILY}'`;
    lines = wrapText(ctx, hook, maxTextWidth);
    if (lines.length <= 3) break;
    fontSize -= Math.max(2, Math.round(fontSize * 0.06));
  }
  ctx.font = `${fontSize}px '${FONT_FAMILY}'`;

  const lineHeight = Math.round(fontSize * 1.14);
  const blockH = lineHeight * lines.length;
  const pad = Math.round(H * 0.045);

  let blockTop: number;
  if (position === "top") blockTop = pad;
  else if (position === "center") blockTop = Math.round((H - blockH) / 2);
  else blockTop = H - blockH - pad;

  // Smooth gradient scrim: many thin rows whose alpha fades away from the text.
  const scrimPad = Math.round(fontSize * 0.75);
  const top = Math.max(0, blockTop - scrimPad);
  const bot = Math.min(H, blockTop + blockH + scrimPad);
  const rows = Math.max(1, bot - top);
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1 || 1);
    let alpha: number;
    if (position === "top") alpha = 0.62 * (1 - t);
    else if (position === "center") alpha = 0.55 * (1 - Math.abs(t - 0.5) * 2);
    else alpha = 0.62 * t;
    if (alpha <= 0.01) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
    ctx.fillRect(0, top + i, W, 1);
  }

  // Each line centered; faux outline by drawing dark copies at offsets first.
  const outline = Math.max(2, Math.round(fontSize * 0.05));
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lw = ctx.measureText(line).width;
    const x = Math.round((W - lw) / 2);
    const baseline = blockTop + li * lineHeight + fontSize;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    for (let dx = -outline; dx <= outline; dx += outline) {
      for (let dy = -outline; dy <= outline; dy += outline) {
        if (dx === 0 && dy === 0) continue;
        ctx.fillText(line, x + dx, baseline + dy);
      }
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, x, baseline);
  }
}

/** Composite the brand logo at a chosen corner. */
async function drawLogo(bmp: any, logoDataUrl: string, position: LogoPosition): Promise<void> {
  const logo = await decodeDataUrl(logoDataUrl);
  const ctx = bmp.getContext("2d");
  const W = bmp.width;
  const H = bmp.height;
  const shortSide = Math.min(W, H);
  const targetH = Math.round(shortSide * 0.16);
  const aspect = (logo.width || 1) / (logo.height || 1);
  const targetW = Math.round(targetH * aspect);
  const pad = Math.round(shortSide * 0.04);

  let x = 0;
  let y = 0;
  switch (position) {
    case "bottom_right":
      x = W - targetW - pad;
      y = H - targetH - pad;
      break;
    case "bottom_left":
      x = pad;
      y = H - targetH - pad;
      break;
    case "top_right":
      x = W - targetW - pad;
      y = pad;
      break;
    case "top_left":
      x = pad;
      y = pad;
      break;
    case "centered_footer":
      x = Math.round((W - targetW) / 2);
      y = H - targetH - pad;
      break;
  }
  ctx.drawImage(logo, x, y, targetW, targetH);
}

export interface BakeOptions {
  hookText?: string | null;
  hookPosition?: HookPosition;
  logoDataUrl?: string | null;
  logoPosition?: LogoPosition;
}

/**
 * Bake the hook (and optionally the logo) onto a base image data URL.
 * Returns a PNG data URL. On any failure, returns the base image unchanged
 * so a render hiccup never blocks a post from publishing.
 */
export async function bakeImageOverlays(
  baseDataUrl: string,
  opts: BakeOptions,
): Promise<string> {
  const hookPosition = opts.hookPosition ?? "bottom";
  const logoPosition = opts.logoPosition ?? "none";
  const hasHook = !!(opts.hookText && opts.hookText.trim()) && hookPosition !== "none";
  const hasLogo = !!opts.logoDataUrl && logoPosition !== "none";
  if (!hasHook && !hasLogo) return baseDataUrl;

  try {
    ensureFont();
    const bmp = await decodeDataUrl(baseDataUrl);
    if (hasLogo) {
      try {
        await drawLogo(bmp, opts.logoDataUrl as string, logoPosition);
      } catch (err) {
        logger.warn({ err: (err as any)?.message }, "Logo overlay (server) failed; continuing without logo");
      }
    }
    if (hasHook) drawHook(bmp, opts.hookText as string, hookPosition);
    return await encodePngDataUrl(bmp);
  } catch (err) {
    logger.warn({ err: (err as any)?.message }, "Image overlay bake failed; returning base image");
    return baseDataUrl;
  }
}
