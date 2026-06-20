import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  brandsTable,
  socialAccountsTable,
  brandSocialAccountsTable,
  postsTable,
  brandMemoryProfilesTable,
  postFeedbackEventsTable,
} from "@workspace/db";
import { sql, desc as drizzleDesc, gte } from "drizzle-orm";
import { getPerformanceMemory } from "../lib/performance-memory";
import { generateClaudeText } from "../lib/ai-providers";
import {
  ListBrandsResponse,
  GetBrandResponse,
  CreateBrandBody,
  UpdateBrandBody,
  GetBrandParams,
  UpdateBrandParams,
  DeleteBrandParams,
} from "@workspace/api-zod";
import { requireAuth, requireWorkspace, hasRoleAtLeast } from "./users";
import { getPlan } from "../lib/plans";

const router: IRouter = Router();

// Per-logo decoded byte cap. Each data URI grows ~33% over the raw bytes due
// to base64 encoding, so 700KB raw ≈ 950KB encoded. Keeps the brand row sane
// and the express.json() 5MB body cap comfortably above 3 max logos.
const MAX_LOGO_BYTES = 700 * 1024;
const DATA_URI_RE = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;
function validateLogos(logos: string[] | null | undefined): string | null {
  if (!logos || logos.length === 0) return null;
  if (logos.length > 3) return "Up to 3 logos allowed per brand";
  for (const [i, l] of logos.entries()) {
    const match = DATA_URI_RE.exec(l);
    if (!match) return `Logo ${i + 1} is not a valid image data URI (png, jpg, webp, or svg)`;
    const rawBytes = Math.floor((match[2].length * 3) / 4);
    if (rawBytes > MAX_LOGO_BYTES) return `Logo ${i + 1} exceeds ${Math.round(MAX_LOGO_BYTES / 1024)}KB`;
  }
  return null;
}

// Public logo endpoint — fetched by Nano Banana's server when a logo is
// used as a generation reference. Security hardening:
//
//   1. Signed URL — requires an HMAC token bound to (brandId, index, exp).
//      Tokens are minted server-side only (see signLogoUrl) and live for 1h.
//      Without a valid token, returns 403 — prevents brand-id enumeration
//      from scraping every workspace's logos.
//   2. SVG drop — SVGs can carry inline <script>, so an attacker who creates
//      a workspace could upload a malicious SVG and serve it from our origin
//      → stored XSS on anyone who visits the URL. We block SVGs from the
//      public endpoint entirely. They still work inside the app (rendered
//      via <img src=data:...> which doesn't execute scripts).
//   3. X-Content-Type-Options: nosniff — defense-in-depth against browsers
//      that try to "helpfully" interpret a JPEG as HTML.

import crypto from "crypto";

function getLogoSigningSecret(): string {
  return process.env.LOGO_URL_SECRET ?? process.env.SESSION_SECRET ?? "dev-logo-secret-do-not-use-in-prod";
}

/** Mint a signed token for (brandId, index) that expires in `ttlSeconds`. */
function signLogoToken(brandId: number, index: number, ttlSeconds = 3600): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${brandId}:${index}:${exp}`;
  const mac = crypto
    .createHmac("sha256", getLogoSigningSecret())
    .update(payload)
    .digest("base64url");
  return { token: `${exp}.${mac}`, exp };
}

function verifyLogoToken(brandId: number, index: number, raw: string | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  const [expStr, mac] = raw.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac("sha256", getLogoSigningSecret())
    .update(`${brandId}:${index}:${exp}`)
    .digest("base64url");
  // Constant-time compare — protects against timing-attack token guessing.
  const a = Buffer.from(mac ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Exported so other modules (image-brief callers in generate/scheduler) can
 *  mint URLs to attach to Nano Banana requests. */
export function buildSignedLogoUrl(brandId: number, index: number): string | null {
  const base = process.env.BACKEND_PUBLIC_URL;
  if (!base) return null;
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)/i.test(base)) return null;
  const { token } = signLogoToken(brandId, index);
  return `${base.replace(/\/$/, "")}/api/public/brands/${brandId}/logos/${index}?t=${encodeURIComponent(token)}`;
}

router.get("/public/brands/:brandId/logos/:index", async (req, res): Promise<void> => {
  const brandId = Number(req.params.brandId);
  const index = Number(req.params.index);
  if (!Number.isFinite(brandId) || !Number.isFinite(index)) {
    res.status(400).end();
    return;
  }
  // Signed-URL check — no token, no access. Prevents brand-id enumeration.
  if (!verifyLogoToken(brandId, index, req.query?.t as string | undefined)) {
    res.status(403).end();
    return;
  }
  const [brand] = await db
    .select({ logos: brandsTable.logos })
    .from(brandsTable)
    .where(eq(brandsTable.id, brandId));
  const logo = brand?.logos?.[index];
  if (!logo) {
    res.status(404).end();
    return;
  }
  const match = DATA_URI_RE.exec(logo);
  if (!match) {
    res.status(404).end();
    return;
  }
  // Block SVG from the public endpoint — they can carry inline <script>
  // and would XSS anyone visiting the URL from our origin.
  if (match[1] === "svg+xml") {
    res.status(415).end();
    return;
  }
  res.setHeader("Content-Type", `image/${match[1]}`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(Buffer.from(match[2], "base64"));
});

router.get("/brands", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brands = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId))
    .orderBy(brandsTable.createdAt);

  res.json(ListBrandsResponse.parse(brands.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }))));
});

router.post("/brands", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const logoErr = validateLogos(parsed.data.logos);
  if (logoErr) {
    res.status(400).json({ error: logoErr });
    return;
  }

  // Plan limits scoped per workspace, plus add-on extra brands purchased.
  const planLimit = getPlan(req.user.plan).brands;
  const limit = planLimit + (req.user.extraBrands ?? 0);
  const existing = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(eq(brandsTable.workspaceId, req.workspaceId));
  if (existing.length >= limit) {
    res.status(403).json({
      error: `Your plan allows a maximum of ${limit} brand(s). Upgrade or add an extra brand from billing.`,
      code: "brand_limit_reached",
    });
    return;
  }

  // Content pillars come in as optional partial fields from the Zod schema,
  // but the db column expects a complete shape. Fill any missing key with 0
  // so we never write a half-shaped object that downstream selectors can't
  // safely read.
  const pillarsInput = parsed.data.contentPillars;
  const normalizedPillars = pillarsInput
    ? {
        educate: pillarsInput.educate ?? 0,
        spotlight: pillarsInput.spotlight ?? 0,
        reviews: pillarsInput.reviews ?? 0,
        bts: pillarsInput.bts ?? 0,
        promo: pillarsInput.promo ?? 0,
      }
    : null;

  const [brand] = await db
    .insert(brandsTable)
    .values({
      userId: req.user.id,
      workspaceId: req.workspaceId,
      name: parsed.data.name,
      industry: parsed.data.industry,
      tone: parsed.data.tone ?? "friendly",
      targetAudience: parsed.data.targetAudience,
      keywords: parsed.data.keywords,
      voiceDescription: parsed.data.voiceDescription ?? null,
      examplePosts: parsed.data.examplePosts ?? null,
      doDontRules: parsed.data.doDontRules ?? null,
      logos: parsed.data.logos ?? null,
      websiteUrl: parsed.data.websiteUrl ?? null,
      brandColorPrimary: parsed.data.brandColorPrimary ?? null,
      brandColorSecondary: parsed.data.brandColorSecondary ?? null,
      contentPillars: normalizedPillars,
      platformOverrides: parsed.data.platformOverrides ?? null,
      platforms: parsed.data.platforms ?? [],
      postTime: parsed.data.postTime ?? "09:00",
      approvalMode: parsed.data.approvalMode ?? "manual",
      autoGenerateEnabled: parsed.data.autoGenerateEnabled ?? false,
    })
    .returning();

  res.status(201).json(GetBrandResponse.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  }));
});

router.get("/brands/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const params = GetBrandParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)));

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.json(GetBrandResponse.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  }));
});

router.patch("/brands/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const params = UpdateBrandParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.logos !== undefined && parsed.data.logos !== null) {
    const logoErr = validateLogos(parsed.data.logos);
    if (logoErr) {
      res.status(400).json({ error: logoErr });
      return;
    }
  }

  const updates: Partial<typeof brandsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.industry != null) updates.industry = parsed.data.industry;
  if (parsed.data.tone != null) updates.tone = parsed.data.tone;
  if (parsed.data.targetAudience != null) updates.targetAudience = parsed.data.targetAudience;
  if (parsed.data.keywords != null) updates.keywords = parsed.data.keywords;
  if (parsed.data.voiceDescription !== undefined) updates.voiceDescription = parsed.data.voiceDescription;
  if (parsed.data.examplePosts !== undefined) updates.examplePosts = parsed.data.examplePosts;
  if (parsed.data.doDontRules !== undefined) updates.doDontRules = parsed.data.doDontRules;
  if (parsed.data.logos !== undefined) updates.logos = parsed.data.logos;
  if (parsed.data.websiteUrl !== undefined) updates.websiteUrl = parsed.data.websiteUrl;
  if (parsed.data.brandColorPrimary !== undefined) updates.brandColorPrimary = parsed.data.brandColorPrimary;
  if (parsed.data.brandColorSecondary !== undefined) updates.brandColorSecondary = parsed.data.brandColorSecondary;
  if (parsed.data.contentPillars !== undefined) {
    // Same normalization as the create path — fill any missing pillar with 0
    // so the db column always sees a complete object.
    const p = parsed.data.contentPillars;
    updates.contentPillars = p
      ? {
          educate: p.educate ?? 0,
          spotlight: p.spotlight ?? 0,
          reviews: p.reviews ?? 0,
          bts: p.bts ?? 0,
          promo: p.promo ?? 0,
        }
      : null;
  }
  if (parsed.data.platformOverrides !== undefined) updates.platformOverrides = parsed.data.platformOverrides;
  if (parsed.data.platforms != null) updates.platforms = parsed.data.platforms;
  if (parsed.data.postTime != null) updates.postTime = parsed.data.postTime;
  if (parsed.data.active != null) updates.active = parsed.data.active;
  if (parsed.data.approvalMode != null) updates.approvalMode = parsed.data.approvalMode;
  if (parsed.data.autoGenerateEnabled != null) updates.autoGenerateEnabled = parsed.data.autoGenerateEnabled;

  const [brand] = await db
    .update(brandsTable)
    .set(updates)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)))
    .returning();

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.json(GetBrandResponse.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  }));
});

router.delete("/brands/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const params = DeleteBrandParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(brandsTable)
    .where(and(eq(brandsTable.id, params.data.id), eq(brandsTable.workspaceId, req.workspaceId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.sendStatus(204);
});

// ── Promote post content to brand voice example ──────────────────────────
// When the user picks a published or approved post they're proud of, this
// appends its content to brand.examplePosts so future caption generations
// few-shot from it. Capped + deduped so the field stays useful (and the
// prompt stays small).
//
// Compounds the brand-memory moat: every promoted example sharpens future
// drafts in a visible way — the user controls what becomes canonical.
const MAX_EXAMPLE_POSTS = 8;
router.post("/brands/:id/examples/promote", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const brandId = Number(req.params.id);
  if (!Number.isInteger(brandId)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }
  const content = String(req.body?.content ?? "").trim();
  if (!content || content.length < 20) {
    res.status(400).json({ error: "Content too short to be a useful example" });
    return;
  }

  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  // examplePosts is a single text field with `---` separators between posts.
  // Parse, dedupe, prepend the new one, cap at MAX_EXAMPLE_POSTS, re-join.
  const existing = (brand.examplePosts ?? "")
    .split(/\n---+\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (existing.some((s) => s === content)) {
    res.json({ already: true, count: existing.length });
    return;
  }
  const next = [content, ...existing].slice(0, MAX_EXAMPLE_POSTS);
  const joined = next.join("\n\n---\n\n");

  // Defense in depth — the brand was already workspace-scoped on the select
  // above, but a future refactor that drops the load could break tenancy.
  // Pin the update to (id AND workspaceId) so this can NEVER touch another
  // tenant's row even if the select moves.
  await db
    .update(brandsTable)
    .set({ examplePosts: joined })
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));

  res.json({ promoted: true, count: next.length });
});

// ── Brand optimal posting times ───────────────────────────────────────────
// Reads brand_performance_memory.bestHoursByPlatform (auto-distilled from
// post analytics in the analytics scheduler) and returns the next concrete
// timestamp that hits each platform's best-performing hour, in the user's
// timezone. The schedule dialog uses this to pre-fill its time picker.
//
// Falls back gracefully when no data exists yet — returns null so the UI
// can keep its existing "1 hour from now" default.
import { brandPerformanceMemoryTable } from "@workspace/db";

router.get(
  "/brands/:id/optimal-times",
  requireAuth,
  requireWorkspace,
  async (req: any, res): Promise<void> => {
    const brandId = Number(req.params.id);
    if (!Number.isInteger(brandId)) {
      res.status(400).json({ error: "Invalid brand id" });
      return;
    }
    // Workspace-scoped — confirm brand belongs to this tenant.
    const [brand] = await db
      .select({ id: brandsTable.id })
      .from(brandsTable)
      .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    const [memory] = await db
      .select()
      .from(brandPerformanceMemoryTable)
      .where(eq(brandPerformanceMemoryTable.brandId, brandId));

    const hoursByPlatform = (memory?.bestHoursByPlatform ?? {}) as Record<string, number[]>;
    const samplesAnalyzed = memory?.samplesAnalyzed ?? 0;

    // Compute next-occurrence ISO timestamps for each platform's best hour.
    // We don't know the user's tz here, so we return UTC; the UI converts.
    const now = new Date();
    const result: Record<string, { hour: number; nextIso: string } | null> = {};
    for (const platform of ["facebook", "instagram", "linkedin"]) {
      const hours = hoursByPlatform[platform];
      if (!hours || hours.length === 0) {
        result[platform] = null;
        continue;
      }
      // Use the first listed hour (it's already ranked by historical performance).
      const targetHour = hours[0];
      const next = new Date(now);
      next.setUTCHours(targetHour, 0, 0, 0);
      // If that hour has already passed today, roll forward to tomorrow.
      if (next.getTime() <= now.getTime() + 5 * 60_000) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      result[platform] = { hour: targetHour, nextIso: next.toISOString() };
    }

    res.json({ samplesAnalyzed, perPlatform: result, hasMemory: samplesAnalyzed > 0 });
  },
);

// ── Brand voice auto-extract from URL ─────────────────────────────────────
// Scrapes the public site at the given URL, extracts title/meta/og tags +
// visible body text (limited), then asks Claude to distill it into
// {industry, voice, targetAudience, keywords}. Frontend uses this to
// auto-fill the brand creation form — eliminates the 12-field cold-start.
//
// Defense-in-depth (SSRF protection):
//   - http(s) protocol allowlist
//   - String-prefix blocklist for obvious private hostnames
//   - DNS resolution + every resolved IP checked against private ranges.
//     Defeats DNS rebinding ("evil.com" → 10.0.0.5), hex/oct/decimal IP
//     encodings, IPv6 ::ffff:127.0.0.1 mapped addresses
//   - 8s fetch timeout, response size cap, redirects followed manually
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|fc00:|fd00:|metadata\.google\.internal)/i;

import dns from "node:dns/promises";
import net from "node:net";

/** Returns true if the IP (v4 or v6) falls inside a private / reserved /
 *  loopback / link-local / metadata-service range that must NOT be reachable
 *  via a user-supplied URL. */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  // IPv4 mapped in IPv6 form
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivateIp(mapped[1]);
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + AWS/GCP/Azure metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lc = ip.toLowerCase();
    if (lc === "::1" || lc === "::") return true;
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // ULA
    if (lc.startsWith("fe80:")) return true; // link-local
    if (lc.startsWith("ff")) return true; // multicast
    return false;
  }
  // Unparseable → treat as private (safe default)
  return true;
}

/** Resolves the hostname's A + AAAA records and confirms NONE point to
 *  private ranges. Throws on any private IP, missing records, or DNS error. */
async function assertPublicHost(hostname: string): Promise<void> {
  // Skip DNS check for IP literals — already validated against the regex.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Private IP literal");
    return;
  }
  let v4: string[] = [];
  let v6: string[] = [];
  try { v4 = await dns.resolve4(hostname); } catch { /* may not have A records */ }
  try { v6 = await dns.resolve6(hostname); } catch { /* may not have AAAA records */ }
  const all = [...v4, ...v6];
  if (all.length === 0) throw new Error("DNS resolution returned no records");
  for (const ip of all) {
    if (isPrivateIp(ip)) {
      throw new Error(`Hostname resolves to a private IP (${ip})`);
    }
  }
}

router.post("/brands/extract", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const body = req.body ?? {};
  const urlInput = String(body.url ?? "").trim();
  if (!urlInput) { res.status(400).json({ error: "Provide a website URL" }); return; }

  let parsed: URL;
  try { parsed = new URL(urlInput.startsWith("http") ? urlInput : `https://${urlInput}`); }
  catch { res.status(400).json({ error: "That doesn't look like a valid URL" }); return; }
  if (!/^https?:$/.test(parsed.protocol)) { res.status(400).json({ error: "Only http and https URLs are supported" }); return; }
  if (BLOCKED_HOSTS.test(parsed.hostname)) { res.status(400).json({ error: "That host can't be scraped (private/internal address)" }); return; }
  // DNS-resolve and reject if any returned IP is private — defeats DNS
  // rebinding + alternate IP encodings that bypass the hostname regex.
  try {
    await assertPublicHost(parsed.hostname);
  } catch (err: any) {
    res.status(400).json({ error: `That host can't be scraped (${err?.message ?? "private network"})` });
    return;
  }

  // Fetch with timeout + size cap
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let html = "";
  try {
    const r = await fetch(parsed.toString(), {
      signal: ctl.signal,
      headers: {
        "User-Agent": "KonnectPilot/1.0 (+brand-extract; contact: hello@konnectpilot.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!r.ok) { res.status(502).json({ error: `Site responded ${r.status}` }); return; }
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 2_000_000) { res.status(413).json({ error: "Page is too large to analyze" }); return; }
    html = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 200_000);
  } catch (err: any) {
    res.status(502).json({ error: err?.name === "AbortError" ? "Site took too long to respond" : "Couldn't fetch that URL" });
    return;
  } finally {
    clearTimeout(timer);
  }

  // Crude but effective: extract <title>, meta tags, h1/h2 text, og:* values.
  // We deliberately avoid pulling a DOM parser dependency — regex on the
  // bounded slice is sufficient for the signal we need.
  function pick(re: RegExp): string | null {
    const m = html.match(re);
    return m ? m[1]?.trim() ?? null : null;
  }
  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const desc =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const h1 = Array.from(html.matchAll(/<h1[^>]*>([^<]{3,180})<\/h1>/gi)).map((m) => m[1].trim()).slice(0, 5);
  const h2 = Array.from(html.matchAll(/<h2[^>]*>([^<]{3,180})<\/h2>/gi)).map((m) => m[1].trim()).slice(0, 10);
  // Strip tags from a chunk of body for general voice signal
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  const signal = JSON.stringify(
    { url: parsed.toString(), title, ogTitle, desc, ogDesc, h1, h2, bodyText },
    null,
    2,
  );

  const prompt = `You are a brand strategist analyzing a company's website to seed a social-media tool.

Given this signal scraped from ${parsed.hostname}:

${signal}

Return ONLY a JSON object with these exact keys (no commentary, no markdown fences):

{
  "name": "the brand name as a human would write it (not the URL)",
  "industry": "specific industry/niche, 2-6 words",
  "voice": "3-4 sentences describing the brand voice the AI should match: tone, energy, common phrases. Be concrete.",
  "targetAudience": "1-2 sentences describing the ideal customer",
  "keywords": "comma-separated list of 6-10 keywords/topics the brand owns"
}

If signal is too thin, still produce best-effort defaults. Never refuse. Never apologize. Return the JSON only.`;

  try {
    const result = await generateClaudeText(prompt, { maxTokens: 800 });
    // Tolerant JSON parse — Claude sometimes wraps in ```json fences despite instructions.
    let raw = result.content.trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) raw = fence[1].trim();
    const parsedJson = JSON.parse(raw);
    res.json({
      name: String(parsedJson.name ?? "").trim(),
      industry: String(parsedJson.industry ?? "").trim(),
      voice: String(parsedJson.voice ?? "").trim(),
      targetAudience: String(parsedJson.targetAudience ?? "").trim(),
      keywords: String(parsedJson.keywords ?? "").trim(),
      sourceUrl: parsed.toString(),
    });
  } catch (err: any) {
    res.status(502).json({ error: `AI couldn't analyze that site: ${err?.message ?? "unknown"}` });
  }
});

// ── Brand Intelligence ─────────────────────────────────────────────────────
// Surface what the AI has learned about this brand — counts, top platforms,
// distilled guidelines, post performance. This is the "killer feature visible"
// fix from the audit: the brand_memory + performance_memory engines run today
// but were never surfaced in the UI. Now they are.
router.get("/brands/:id/intelligence", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brandId = Number(req.params.id);
  if (!Number.isInteger(brandId)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }
  const [brand] = await db
    .select({ id: brandsTable.id, name: brandsTable.name })
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  // Memory profile (approvedCount, rejectedCount, editedCount, distilledGuidelines)
  const [memory] = await db
    .select()
    .from(brandMemoryProfilesTable)
    .where(eq(brandMemoryProfilesTable.brandId, brandId));

  // Post counts by status (last 90 days for "recent activity")
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const postCounts = await db
    .select({
      status: postsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(postsTable)
    .where(and(
      eq(postsTable.brandId, brandId),
      gte(postsTable.createdAt, ninetyDaysAgo),
    ))
    .groupBy(postsTable.status);

  // Posts per platform (which platforms are actually being used)
  const platformCounts = await db
    .select({
      platform: postsTable.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(postsTable)
    .where(and(
      eq(postsTable.brandId, brandId),
      eq(postsTable.status, "published"),
    ))
    .groupBy(postsTable.platform)
    .orderBy(drizzleDesc(sql`count(*)`));

  // Recent feedback events — last 5 actions, to show "what you've taught it lately"
  const recentFeedback = await db
    .select({
      action: postFeedbackEventsTable.action,
      reason: postFeedbackEventsTable.reason,
      createdAt: postFeedbackEventsTable.createdAt,
    })
    .from(postFeedbackEventsTable)
    .where(eq(postFeedbackEventsTable.brandId, brandId))
    .orderBy(drizzleDesc(postFeedbackEventsTable.createdAt))
    .limit(5);

  // Performance memory snapshot — top hooks, best content types, etc.
  const perf = await getPerformanceMemory(brandId);

  // Compute the "AI has learned N things about your brand" headline
  // (approvedSamples + rejectedSamples + editPatterns are the raw signals).
  const learnedThings =
    (memory?.approvedSamples?.length ?? 0) +
    (memory?.rejectedSamples?.length ?? 0) +
    (memory?.editPatterns?.length ?? 0);

  // Top platform by published count
  const topPlatform = platformCounts[0]?.platform ?? null;
  const totalPublished = platformCounts.reduce((s, p) => s + Number(p.count), 0);

  res.json({
    brandId,
    brandName: brand.name,
    headline: learnedThings > 0
      ? `KonnectPilot has learned ${learnedThings} things about ${brand.name}`
      : `KonnectPilot is still learning ${brand.name}. Approve a few posts to start.`,
    counts: {
      approved: memory?.approvedCount ?? 0,
      rejected: memory?.rejectedCount ?? 0,
      edited: memory?.editedCount ?? 0,
      learnedThings,
      totalPublished,
    },
    topPlatform,
    platformBreakdown: platformCounts.map((p) => ({ platform: p.platform, count: Number(p.count) })),
    statusBreakdown: postCounts.map((p) => ({ status: p.status, count: Number(p.count) })),
    distilledGuidelines: memory?.distilledGuidelines ?? null,
    recentFeedback: recentFeedback.map((f) => ({
      action: f.action,
      reason: f.reason,
      createdAt: f.createdAt.toISOString(),
    })),
    performance: perf ? {
      topHooks: (perf as any)?.topHooks ?? null,
      bestContentTypesByPlatform: (perf as any)?.bestContentTypesByPlatform ?? null,
      bestPostingTimes: (perf as any)?.bestPostingTimes ?? null,
      avgEngagementRate: (perf as any)?.avgEngagementRate ?? null,
    } : null,
  });
});

// ── Brand ↔ Social Account assignment ──────────────────────────────────────
// Many-to-many: a connected social account can serve multiple brands
// (e.g. an agency's own LinkedIn shared across clients), and a brand can
// have multiple platforms wired up. The brand_social_accounts join table is
// the authoritative source of which accounts each brand publishes from.

// List accounts assigned to a brand.
router.get("/brands/:id/social-accounts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const brandId = Number(req.params.id);
  if (!Number.isInteger(brandId)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }
  const [brand] = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  const rows = await db
    .select({ account: socialAccountsTable })
    .from(socialAccountsTable)
    .innerJoin(
      brandSocialAccountsTable,
      eq(brandSocialAccountsTable.socialAccountId, socialAccountsTable.id),
    )
    .where(eq(brandSocialAccountsTable.brandId, brandId));
  res.json(rows.map((r) => ({
    id: r.account.id,
    platform: r.account.platform,
    accountType: r.account.accountType,
    accountName: r.account.accountName,
    accountHandle: r.account.accountHandle,
    profilePictureUrl: r.account.profilePictureUrl,
    isActive: r.account.isActive,
  })));
});

// Assign an existing social account to a brand. Both must belong to the
// same workspace. Idempotent: re-posting the same pair returns 200 with no
// duplicate row (handled by primary key + ON CONFLICT DO NOTHING).
router.post("/brands/:id/social-accounts/:accountId", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const brandId = Number(req.params.id);
  const accountId = Number(req.params.accountId);
  if (!Number.isInteger(brandId) || !Number.isInteger(accountId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [brand] = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  const [account] = await db
    .select({ id: socialAccountsTable.id })
    .from(socialAccountsTable)
    .where(and(eq(socialAccountsTable.id, accountId), eq(socialAccountsTable.workspaceId, req.workspaceId)));
  if (!account) {
    res.status(404).json({ error: "Social account not found in this workspace" });
    return;
  }
  await db
    .insert(brandSocialAccountsTable)
    .values({ brandId, socialAccountId: accountId })
    .onConflictDoNothing();
  res.sendStatus(204);
});

// One-time backfill — assign every active social_account to every brand in the
// same workspace. Idempotent (ON CONFLICT DO NOTHING). Run once after schema
// push to preserve "all accounts available to all brands" behavior, then
// users curate per-brand assignment going forward. Owner-only.
router.post("/admin/backfill-brand-social-accounts", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "owner")) {
    res.status(403).json({ error: "Owner role required" });
    return;
  }
  const pairs = await db
    .select({ brandId: brandsTable.id, accountId: socialAccountsTable.id })
    .from(brandsTable)
    .innerJoin(
      socialAccountsTable,
      eq(socialAccountsTable.workspaceId, brandsTable.workspaceId),
    )
    .where(and(
      eq(brandsTable.workspaceId, req.workspaceId),
      eq(socialAccountsTable.isActive, true),
    ));
  if (pairs.length === 0) {
    res.json({ assigned: 0 });
    return;
  }
  await db
    .insert(brandSocialAccountsTable)
    .values(pairs.map((p) => ({ brandId: p.brandId, socialAccountId: p.accountId })))
    .onConflictDoNothing();
  res.json({ assigned: pairs.length });
});

// Unassign an account from a brand. Does not delete the underlying account.
router.delete("/brands/:id/social-accounts/:accountId", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "editor")) {
    res.status(403).json({ error: "Editor role required" });
    return;
  }
  const brandId = Number(req.params.id);
  const accountId = Number(req.params.accountId);
  if (!Number.isInteger(brandId) || !Number.isInteger(accountId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [brand] = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), eq(brandsTable.workspaceId, req.workspaceId)));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  await db
    .delete(brandSocialAccountsTable)
    .where(and(
      eq(brandSocialAccountsTable.brandId, brandId),
      eq(brandSocialAccountsTable.socialAccountId, accountId),
    ));
  res.sendStatus(204);
});

export default router;
