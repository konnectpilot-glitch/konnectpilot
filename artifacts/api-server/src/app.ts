import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app: Express = express();

// Behind a load balancer (Railway, Render, Vercel front-door) so
// express-rate-limit reads the real client IP from X-Forwarded-For
// instead of bucketing every request as the LB's IP.
app.set("trust proxy", 1);

// CSP disabled — Clerk + Stripe + AI providers each need allowlist entries;
// configure properly before launch. Other helmet defaults are safe to enable now.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = (process.env.APP_URL ?? "http://localhost:25960")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
logger.info({ allowedOrigins }, "CORS allowed origins");
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Allow requests with no Origin (curl, server-to-server, same-origin).
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
  }),
);

// Stripe webhooks need raw body — must be before express.json()
app.use("/api/billing/webhooks", express.raw({ type: "application/json" }));

// Logos are uploaded as base64 data URIs inside the brand payload —
// 3 logos × ~700KB each ≈ ~2.5MB max. 5MB ceiling for safety.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use(clerkMiddleware());

// ── Rate limiting ──────────────────────────────────────────────────────────
// In-memory store: resets on restart, single-process only. Switch to a Redis
// store before scaling beyond one backend instance.
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Per-user when authenticated (so multiple users on the same NAT/office IP
  // don't drain each other's budget); per-IP otherwise.
  keyGenerator: (req) => {
    const auth = getAuth(req);
    return auth?.userId ?? req.ip ?? "anon";
  },
  message: {
    code: "rate_limit_ai",
    error: "Too many AI generation requests. Wait a minute and try again.",
  },
});
app.use("/api/generate", aiLimiter);
app.use("/api/analytics", (req, res, next) => {
  // Only the expensive insights-refresh endpoint, not all analytics reads.
  if (req.path.endsWith("/insights/refresh")) return aiLimiter(req, res, next);
  return next();
});
// Every other Claude-burning endpoint gets the same protection. Without
// this, the global 300/min limiter is the only ceiling and a single user
// can rack up significant API spend in minutes.
app.use("/api/predict", aiLimiter);
app.use("/api/topic-suggester", aiLimiter);
app.use("/api/reply-drafter", aiLimiter);
app.use("/api/insights", aiLimiter);
app.use("/api/brands/extract", aiLimiter);

const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    code: "rate_limit_global",
    error: "Too many requests. Slow down and try again.",
  },
});
app.use("/api", globalLimiter);

// In-memory image cache for serving data-URL images via public HTTPS URL.
// Instagram's /media endpoint requires a public image_url and cannot fetch
// data: URLs. We register the decoded bytes here under a random key and
// expose them at /img/:key for Meta's servers to fetch.
type CachedImage = { bytes: Buffer; mime: string; expiresAt: number };
const imageCache = new Map<string, CachedImage>();
const IMAGE_TTL_MS = 30 * 60 * 1000; // 30 minutes — long enough for Meta to fetch

export function registerImageBlob(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)(?:;base64)?,(.*)$/);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1] || "image/png";
  const bytes = Buffer.from(match[2] || "", "base64");
  const key = Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  imageCache.set(key, { bytes, mime, expiresAt: Date.now() + IMAGE_TTL_MS });
  // Cheap GC: drop expired entries on each register
  const now = Date.now();
  for (const [k, v] of imageCache) {
    if (v.expiresAt < now) imageCache.delete(k);
  }
  return key;
}

app.get("/img/:key", (req, res) => {
  const entry = imageCache.get(req.params.key);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(404).type("text/plain").send("Image not found or expired");
    return;
  }
  res.set("Content-Type", entry.mime);
  res.set("Cache-Control", "public, max-age=300");
  res.send(entry.bytes);
});

// Temporary debug endpoint — returns last 5 posts with errorMessage exposed.
// Bypasses Clerk middleware and Zod schemas to surface failure reasons during
// the OAuth integration test phase. Remove before production.
app.get("/debug/posts", async (_req, res) => {
  try {
    const { db, postsTable } = await import("@workspace/db");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select({
      id: postsTable.id,
      platform: postsTable.platform,
      status: postsTable.status,
      errorMessage: postsTable.errorMessage,
      scheduledFor: postsTable.scheduledFor,
      publishedAt: postsTable.publishedAt,
      platformPostId: postsTable.platformPostId,
      createdAt: postsTable.createdAt,
    }).from(postsTable).orderBy(desc(postsTable.id)).limit(5);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// Public legal pages — served from backend so they're reachable via the public
// ngrok URL for OAuth provider validators (LinkedIn, Meta) that crawl these
// URLs during app review. Plain HTML, no JS, no client-side rendering.
app.get("/privacy", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>KonnectPilot — Privacy Policy</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}h1{font-size:28px}h2{font-size:20px;margin-top:32px}</style>
</head><body>
<h1>Privacy Policy</h1>
<p><strong>Last updated: May 17, 2026</strong></p>
<p>KonnectPilot ("we", "us", "our") is an AI-powered social media scheduling tool operated by Etycons. This Privacy Policy explains how we collect, use, and protect information when you use KonnectPilot.</p>
<h2>Information we collect</h2>
<ul><li>Account info you provide (name, email) via Clerk authentication.</li>
<li>Brand and content data you create inside the app (products, posts, schedules).</li>
<li>OAuth access tokens for connected social platforms (Facebook Pages, Instagram Business, LinkedIn) — used solely to publish content you authorize. Stored encrypted.</li>
<li>Usage analytics (post performance, engagement) returned by the social platforms you connect.</li></ul>
<h2>How we use information</h2>
<ul><li>To generate, schedule, and publish content you create.</li>
<li>To display analytics back to you.</li>
<li>To send transactional emails about your account.</li></ul>
<h2>Sharing</h2>
<p>We do not sell your data. We share data with: (a) the social platforms you connect, only to fulfil your publishing requests; (b) infrastructure providers (database, AI inference) under standard data-processing terms.</p>
<h2>Retention</h2>
<p>Data is retained while your account is active. On account deletion, your content and tokens are removed within 30 days.</p>
<h2>Your rights</h2>
<p>You may export or delete your data at any time from Settings, or by emailing <a href="mailto:hello@konnectpilot.com">hello@konnectpilot.com</a>.</p>
<h2>Contact</h2>
<p>Etycons (KonnectPilot), Lahore, Pakistan. Email: <a href="mailto:hello@konnectpilot.com">hello@konnectpilot.com</a>.</p>
</body></html>`);
});

app.get("/terms", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>KonnectPilot — Terms of Service</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}h1{font-size:28px}h2{font-size:20px;margin-top:32px}</style>
</head><body>
<h1>Terms of Service</h1>
<p><strong>Last updated: May 17, 2026</strong></p>
<p>By using KonnectPilot, you agree to these terms. KonnectPilot is operated by Etycons.</p>
<h2>Use of service</h2>
<p>You must comply with the terms of every social platform you connect (Meta Platform Terms, LinkedIn Marketing API Terms, etc.). You are responsible for the content you publish through KonnectPilot.</p>
<h2>Acceptable use</h2>
<p>No spam, no automated mass actions beyond platform rate limits, no illegal content, no impersonation.</p>
<h2>Account & data</h2>
<p>You retain ownership of all content you create. We may revoke access for terms violations.</p>
<h2>Disclaimer</h2>
<p>Service provided "as is" without warranty. We are not liable for content published through your connected accounts or for outages of third-party platforms.</p>
<h2>Contact</h2>
<p>Etycons (KonnectPilot), Lahore, Pakistan. Email: <a href="mailto:hello@konnectpilot.com">hello@konnectpilot.com</a>.</p>
</body></html>`);
});

app.use("/api", router);

// ── SPA static serving (Railway / production) ──────────────────────────────
// In production the API server also serves the pre-built React frontend.
// Static assets first, then a catch-all that returns index.html for client-side
// routing (wouter). In dev, Vite's dev server handles this instead.
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Vite builds into artifacts/postpilot/dist/public; relative to
  // artifacts/api-server/dist/ that's ../../postpilot/dist/public
  const frontendDir = path.resolve(__dirname, "../../postpilot/dist/public");
  logger.info({ frontendDir }, "Serving SPA static files");

  app.use(express.static(frontendDir, { maxAge: "1d", index: false }));

  // SPA fallback — any GET that didn't match an API route or static file
  // gets index.html so client-side routing works.
  app.get("*", (_req, res, next) => {
    // Don't catch /api or /img routes that fell through
    if (_req.path.startsWith("/api") || _req.path.startsWith("/img")) {
      return next();
    }
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

// Verbose error handler — surfaces the real error to logs AND response body.
// Without this, async route exceptions bubble to Express's default handler
// which sends an empty 500 (Content-Length: 0) and pino-http's serializer
// strips the error before logging.
app.use((err: any, req: any, res: any, _next: any) => {
  req.log?.error({ err: { message: err?.message, stack: err?.stack, name: err?.name } }, "unhandled route error");
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message ?? "Internal server error" });
});

export default app;
