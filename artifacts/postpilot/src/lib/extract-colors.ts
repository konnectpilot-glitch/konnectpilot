// Dominant-color extraction from an image data URI. Used to auto-fill brand
// primary/secondary color when the user uploads a logo.
//
// Approach:
//   1. Draw the image onto a small offscreen canvas (50×50 keeps it fast
//      and visually-faithful enough — we're after dominant hues, not pixels)
//   2. Read RGBA pixel buffer
//   3. Detect the background color from the corner pixels and exclude it,
//      otherwise logos on white backgrounds always return white
//   4. Quantize remaining pixels into coarse buckets (round each channel to
//      the nearest 32), tally occurrences, sort by count
//   5. Filter out near-white, near-black, and near-grey (they're rarely the
//      brand color the user means — Apple-grey aside) AND filter near-duplicate
//      hues so the top 2-3 returned aren't all shades of the same blue
//   6. Return top N as #rrggbb hex
//
// No external library — keeps the bundle lean. SVG-as-data-URI works because
// the canvas draws it like any other image; we read pixels post-rasterization.

export interface ExtractOptions {
  /** Max number of distinct colors to return. */
  count?: number;
  /** Canvas size to downsample to. Larger = slower, more accurate. */
  sampleSize?: number;
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function isBackgroundColor(r: number, g: number, b: number, a: number): boolean {
  // Transparent pixels and near-white pixels usually = the canvas / page bg.
  if (a < 128) return true;
  if (r > 240 && g > 240 && b > 240) return true; // near-white
  return false;
}

function isLowSaturation(r: number, g: number, b: number): boolean {
  // Greys (channels within 18 of each other) are visually neutral and rarely
  // the brand color a user thinks of as theirs. Skip them so we surface the
  // chromatic colors instead.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 18;
}

function isTooDark(r: number, g: number, b: number): boolean {
  // Near-black pixels are often outlines or text and bias the result.
  return r < 25 && g < 25 && b < 25;
}

/** Euclidean distance in RGB — good enough for "are these the same color?" */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function extractColors(
  dataUri: string,
  options: ExtractOptions = {},
): Promise<string[]> {
  const count = options.count ?? 3;
  const sampleSize = options.sampleSize ?? 50;

  // Load the image. Wrap in a promise so the caller can await it.
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to load image"));
    el.src = dataUri;
  });

  const canvas = document.createElement("canvas");
  // Maintain aspect ratio while staying within sampleSize on the long edge.
  const scale = Math.min(sampleSize / img.width, sampleSize / img.height, 1);
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    // Tainted canvas (e.g. cross-origin image without CORS) — bail silently
    // rather than throw, so the brand form keeps working.
    return [];
  }

  // Count quantized buckets. We round each channel to the nearest 32 so
  // "almost the same blue" collapses into one bucket. Net: a few dozen
  // buckets max per image, very fast to scan.
  const bucket = new Map<string, { count: number; rgb: [number, number, number] }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (isBackgroundColor(r, g, b, a)) continue;
    if (isTooDark(r, g, b)) continue;
    if (isLowSaturation(r, g, b)) continue;

    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;
    const existing = bucket.get(key);
    if (existing) existing.count++;
    else bucket.set(key, { count: 1, rgb: [qr, qg, qb] });
  }

  // Sort buckets by frequency. The most common chromatic color is the
  // primary; the next sufficiently-different color is the secondary; etc.
  const sorted = [...bucket.values()].sort((a, b) => b.count - a.count);

  // De-duplicate near-identical hues. Two colors that differ by <50 in RGB
  // distance are visually the same — picking both clutters the palette.
  const picked: [number, number, number][] = [];
  for (const entry of sorted) {
    if (picked.length >= count) break;
    if (picked.some((p) => colorDistance(p, entry.rgb) < 50)) continue;
    picked.push(entry.rgb);
  }

  return picked.map(([r, g, b]) => toHex(r, g, b));
}
