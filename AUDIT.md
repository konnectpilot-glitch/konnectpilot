# KonnectPilot — Full Code & Site Audit

Audit date: May 13, 2026. Reviewed by Claude (chat). Scope: all backend routes, frontend pages, scheduler, publishers, security middleware, billing flow, env config, and a live click-through of the running app at `localhost:25960`.

Findings are tiered by severity. Each item has **what, where, and how to fix**. Hand this file to Claude Code in your terminal — it can work through items top to bottom.

---

## 🔴 CRITICAL — must fix before any real user touches this

### C1. CORS is wide open
**Where:** `artifacts/api-server/src/app.ts:31`
```js
app.use(cors({ credentials: true, origin: true }));
```
`origin: true` reflects any origin. With `credentials: true` this is exploitable — a malicious site can make authenticated calls to your API on behalf of a logged-in user (CSRF-via-CORS).
**Fix:** Allow only your frontend origin. Use `APP_URL` from env:
```js
app.use(cors({
  credentials: true,
  origin: (process.env.APP_URL ?? "http://localhost:25960").split(","),
}));
```

### C2. No global error handler (existing — being fixed by Claude Code now)
**Where:** `artifacts/api-server/src/app.ts`
Express 5 has a default handler that swallows the error message and returns an empty 500. We hit this on the brand-creation bug. Claude Code is already adding a handler — make sure it stays.

### C3. No rate limiting anywhere
**Where:** entire `api-server`
Sign-up, AI generation (expensive), webhook endpoint, login proxy — all unthrottled. One malicious user can drain your AI credit budget or DDoS the app.
**Fix:** Add `express-rate-limit`:
- Global limit: 100 req / min per IP
- `/api/generate*` and `/api/analytics/.../insights/refresh`: 10 req / min per user (these cost real money)
- Sign-up flow paths: 5 req / hour per IP

### C4. No security headers
**Where:** `artifacts/api-server/src/app.ts`
No Helmet, no CSP, no X-Frame-Options. Anyone can iframe your app and clickjack users.
**Fix:** Install `helmet`, add `app.use(helmet({ contentSecurityPolicy: false }))` (CSP needs custom config because of Clerk; do that later).

### C5. AI keys check happens late — silent failures possible
**Where:** `artifacts/api-server/src/lib/ai-providers.ts`, `routes/generate.ts`
If `AWS_BEARER_TOKEN_BEDROCK` or `GOOGLE_API_KEY_NANO_BANANA` are missing, generation fails per-request with a 500 instead of being clearly disabled. Users will burn credits on broken requests.
**Fix:** Add a startup check that logs which capabilities are enabled and returns a clean `503 ai_disabled` error from `/api/generate` when AI envs aren't set. The frontend should hide the Generate button entirely when `/api/usage/me` reports no AI providers configured.

### C6. Replit-domains assumption in Stripe portal return URL
**Where:** `artifacts/api-server/src/routes/billing.ts:194`
```js
const domains = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
```
On any non-Replit host, this falls back to `localhost`, so Stripe will redirect customers back to localhost after billing. Production users will be lost.
**Fix:** Replace with `process.env.APP_URL` (which we already have in `.env`).

---

## 🟠 PRE-LAUNCH — must fix before public launch

### P1. Health endpoint doesn't actually check anything
**Where:** `artifacts/api-server/src/routes/health.ts`
Always returns `{ status: "ok" }`. If Postgres is down, health check still passes — your hosting provider won't know to restart the container.
**Fix:** Run `SELECT 1` against the DB. Return 503 if it fails.

### P2. No request ID / correlation ID in logs
**Where:** `artifacts/api-server/src/app.ts` (pino-http config)
Logs strip everything except `id, method, url, statusCode`. When something breaks in production, you can't trace one user's request through the stack.
**Fix:** Include `userId`, `workspaceId`, and a `requestId` header in the serializer. Frontend should send the X-Request-Id header (TanStack Query has a hook for it).

### P3. No error tracking (Sentry / similar)
**Where:** missing entirely
When something breaks for a customer at 2 AM, you'll never know unless they email you. By then it's too late.
**Fix:** Sign up for free Sentry account. Add `@sentry/node` to backend, `@sentry/react` to frontend. Wire DSN via env. Total setup time: 20 min.

### P4. SUPERADMIN_EMAILS isn't set — admin panel inaccessible
**Where:** `artifacts/api-server/src/routes/users.ts` (superadminEmails function), `artifacts/postpilot/src/pages/admin.tsx`
The admin page exists and is routed, but `requireSuperadmin` returns 403 to everyone because `SUPERADMIN_EMAILS` env isn't set. You can't manage users / refund / impersonate from the app.
**Fix:** Add `SUPERADMIN_EMAILS=your@email.com` to `artifacts/api-server/.env`. Restart backend. Re-sign-in once to pick up the flag.

### P5. No email service configured — silent communication failures
**Where:** `artifacts/api-server/src/lib/mailer.ts`
Mailer is built and ready (SendGrid via REST). But no `SENDGRID_API_KEY` set, so:
- Workspace invites send no email
- Approval reminders silently drop
- Weekly analytics reports never arrive
- Post failure notifications never sent
**Fix:** Create a free SendGrid account (100 emails/day free). Add `SENDGRID_API_KEY` and `EMAIL_FROM=hello@yourdomain.com` to `.env`. Verify the sender domain.

### P6. Onboarding is missing
**Where:** `artifacts/postpilot/src/pages/dashboard.tsx` and elsewhere
A brand-new user lands on an empty dashboard with no guidance — they need to know to: (1) connect a social account → (2) create a brand → (3) create a schedule. Without onboarding, drop-off will be huge.
**Fix:** Add a checklist component on the dashboard that walks new users through the 3 setup steps with clear CTAs. Hide once all 3 are done.

### P7. AI generation hard-coded fallback messages can leak
**Where:** `artifacts/api-server/src/routes/generate.ts`
If `generateClaudeText` throws (e.g. Bedrock 429), the error bubbles to the global handler. After C2 is fixed, the raw error message gets returned to the user — which may contain internal stack info or even AWS request IDs.
**Fix:** Wrap AI calls in try/catch. Return `{ error: "AI service is temporarily unavailable" }` with a 503. Log the real error.

### P8. Brand limit error message hard-codes plan name
**Where:** `artifacts/api-server/src/routes/brands.ts:50`
```js
error: `Your plan allows a maximum of ${limit} brand(s). Upgrade or add an extra brand from billing.`
```
For free-tier users this just says "upgrade" — fine. But the message should also include their current plan name and a direct link to billing. Small thing, big conversion impact.
**Fix:** Pass `plan` and `upgradeUrl` in the response body. Render a button "Upgrade to Pro →" in the frontend toast.

### P9. Plan-limit mismatch in docs vs code
**Where:** `replit.md` vs `artifacts/api-server/src/lib/plans.ts`
`replit.md` mentions "Starter: 1 brand, Pro: 5 brands" in one place but elsewhere says Starter has 3 brands. The code has Starter=1, Pro=5, Agency=10 — but make sure your pricing page matches reality before customers see it.
**Fix:** Re-read pricing page (`artifacts/postpilot/src/pages/marketing/pricing.tsx`), verify against plans.ts. Update either to match.

### P10. AI text generation has no length cap
**Where:** `artifacts/api-server/src/lib/ai-providers.ts`
A long-running Bedrock call could rack up cost and tie up the server. There's no max-tokens or timeout enforcement visible.
**Fix:** Set `maxTokens: 500` on the ConverseCommand for captions. Wrap in a 30-second timeout with AbortController.

### P11. Catch-up window only 5 minutes
**Where:** `artifacts/api-server/src/lib/scheduler.ts` (`SLOT_TOLERANCE_MS`)
If the scheduler misses a tick because the server was down or restarted, posts scheduled in that 5-min window will be missed permanently. For a SaaS, 5 min is tight.
**Fix:** Bump to 30 min. Better: add a "catch-up on startup" routine that finds missed slots from the last hour and runs them.

### P12. Facebook publishes to the first Page only
**Where:** `artifacts/api-server/src/lib/publishers.ts` (Facebook publisher)
When a user connects Facebook, the code picks the first Page returned by `/me/accounts`. If they manage multiple Pages, they have no way to choose. Real customers will complain immediately.
**Fix:** Add a Page picker UI on the Accounts page after Facebook OAuth completes. Store the chosen `pageId` in `social_accounts.platformAccountId`.

### P13. Legal pages have placeholder support email
**Where:** `artifacts/postpilot/src/pages/marketing/legal.tsx`
References `privacy@konnectpilot.com` — but no such domain/inbox exists yet.
**Fix:** Either buy `konnectpilot.com` and set up the mailbox, or temporarily replace with your real email.

### P14. No copy-paste-able feedback / bug-report path
**Where:** UI lacks support widget
Users will hit issues. Right now they have no way to tell you.
**Fix:** Add a small "Send feedback" button in the bottom-right (Intercom is overkill; even a `mailto:` link is fine for v1).

### P15. Affiliate tracking is open-redirect-able
**Where:** `artifacts/api-server/src/routes/affiliate.ts:1` (`/affiliate/track-click` is unauthenticated)
Without auth it's correct (clicks happen pre-signup) but check that the redirect target is hard-coded, not user-supplied. If it's user-supplied, attackers can use you as a phishing redirector.
**Fix:** Review that path, ensure target URL is server-determined.

---

## 🟡 PRODUCTION-READINESS

### R1. Replit-only deps still in package.json
**Where:** `artifacts/postpilot/package.json`
`@replit/vite-plugin-cartographer`, `dev-banner`, `runtime-error-modal`. They're gated by `REPL_ID` env so they don't activate outside Replit, but they bloat install size by ~5 MB. Safe to remove for production builds.
**Fix:** Remove from dependencies, remove imports from `vite.config.ts`.

### R2. `exports/konnectpilot.tar.gz` (3.3 MB) checked into repo
**Where:** repo root
A pre-built archive shouldn't be in version control. Adds 3.3 MB to every clone.
**Fix:** Delete the file. Add `exports/` to `.gitignore`. Commit.

### R3. `attached_assets/` folder (~3.5 MB) of Replit screenshots and PRD pastes
**Where:** repo root
Looks like dumped reference material that landed in the repo. Useful as historical reference, but not source code.
**Fix:** Move to a separate `_archive/` folder outside the repo, or delete if not needed.

### R4. No tests anywhere
**Where:** missing entirely. No `*.test.ts`, no `vitest.config.ts`, no `jest.config.ts`.
Without tests, every change risks breaking something that already worked.
**Fix:** Don't aim for 100% coverage. Just add tests for the critical paths first:
- Scheduler slot claiming (the unique-index race-condition logic)
- Publisher success/error paths (mock fetch)
- Brand creation Zod validation
- Workspace authorization (no cross-workspace data leak)
Install `vitest` + `supertest`, target ~20 tests total.

### R5. No CI / lint / typecheck on every commit
**Where:** no `.github/workflows/`
If something breaks the build, you find out when you deploy.
**Fix:** Add a single `.github/workflows/ci.yml` that runs `pnpm typecheck` on push. 10 minutes setup, saves hours later.

### R6. No README
**Where:** missing
A future you (or a contractor) opens the repo and has zero idea how to start.
**Fix:** Generate a short README from `replit.md`'s contents. Cover: what it is, how to run locally (the steps we just went through), how to deploy. Drop `replit.md` afterward, or keep it as `ARCHITECTURE.md`.

### R7. `replit.md` has stale info
**Where:** `replit.md`
Says image generation uses pollinations.ai and captions use OpenAI GPT-4.1. Actually it's Gemini Nano Banana for images and Claude Opus 4.7 via Bedrock for captions (recent commits confirm).
**Fix:** Update or replace this file. Keep it as a single source of truth.

### R8. Drizzle migrations folder vs `pnpm push`
**Where:** `lib/db/drizzle.config.ts`
We used `pnpm push` for local setup, which auto-syncs schema. In production, schema changes should go through proper migrations (so you can roll back). Pushing in prod is dangerous.
**Fix:** Switch to `drizzle-kit generate` → review migration SQL → commit → run `migrate` on deploy. Document the workflow in README.

### R9. Long-running Express processes need a process manager
**Where:** deployment target (Railway/Render/Fly.io)
The schedulers run inside the same process as the API. If the process crashes for any reason, schedulers stop. With no restart strategy, missed posts.
**Fix:** Deploy with a restart policy enabled (Railway, Render, and Fly.io all do this by default — just verify). Also: configure structured uncaught-exception/unhandled-rejection handlers that log to Sentry and exit cleanly so the platform can restart.

### R10. Environment variable inventory
**Where:** `.env` files
Currently you have only what's needed for local. Full prod will also need: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`, `STRIPE_TOPUP_100/250/500_PRICE_ID`, `STRIPE_ADDON_BRAND_PRICE_ID`, `STRIPE_ADDON_SEAT_PRICE_ID`, `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION`, `GOOGLE_API_KEY_NANO_BANANA`, `SENDGRID_API_KEY`, `EMAIL_FROM`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `SUPERADMIN_EMAILS`, `SENTRY_DSN`.
**Fix:** Create a `.env.example` at repo root listing every env var the app reads, with comments. Anyone setting up the project can copy → fill in.

---

## 🟢 UX / POLISH

### U1. Free plan only gets 5 credits — too tight
**Where:** `artifacts/api-server/src/lib/plans.ts:33`
Free users get 5 credits. That's enough for ~5–10 captions. Before users see real value, they're already out.
**Fix:** Either bump to 25, or restructure so the free tier gets *unlimited captions but limited images*. Image generation is what costs you real money.

### U2. Brand-form validation gives no inline feedback
**Where:** `artifacts/postpilot/src/pages/brand-form.tsx`
Saw it personally — user fills the form, hits submit, gets a toast. Frontend Zod schemas could validate inline (e.g. "Brand name must be at least 1 character") before the request.
**Fix:** Use `react-hook-form` with Zod resolver (both are already installed). Show errors per field.

### U3. Dashboard empty state is bland
**Where:** `artifacts/postpilot/src/pages/dashboard.tsx`
First-time users see a mostly empty dashboard with zeros. Ties into P6 (onboarding) — combine into one improvement.
**Fix:** Replace empty stats with a "Getting started in 3 steps" card.

### U4. Several pages have no skeleton / loading state
**Where:** Various pages — `analytics.tsx`, `library.tsx`, etc.
While data loads, the UI flashes blank then snaps in. Feels broken.
**Fix:** Add `<Skeleton>` placeholders (shadcn has them ready).

### U5. Sidebar is fixed-width — mobile is broken
**Where:** `artifacts/postpilot/src/components/sidebar.tsx` (likely)
On screens narrower than ~900px the sidebar covers the content. Many real customers will check pricing / sign up on mobile.
**Fix:** Make sidebar collapse into a hamburger menu under 768px.

### U6. No 404 page for unknown routes (or it's the bare "NotFound")
**Where:** `artifacts/postpilot/src/pages/not-found.tsx`
Worth a quick look — does it have links back to dashboard / landing?
**Fix:** Add prominent "Back to dashboard" CTA. Branded styling.

### U7. Affiliate page exists but flow not yet useful
**Where:** `artifacts/postpilot/src/pages/affiliate.tsx`
Without Stripe live mode and actual payouts wired, an affiliate page just confuses users. Hide it from the sidebar until billing is live.
**Fix:** Feature-flag with `import.meta.env.VITE_ENABLE_AFFILIATE`. Default off.

### U8. Cookie banner missing
**Where:** missing
For EU visitors you'll legally need a cookie consent banner. Even though privacy policy mentions cookies, that's not enough.
**Fix:** Add a simple cookie banner. Cookiebot, Termly, or just a homegrown component for v1.

---

## ARCHITECTURE NOTES (no immediate action, but worth understanding)

- **Auth provider is Clerk** — good choice, but it locks billing-related-features to per-user accounts. For B2B (agency reselling) you may want workspaces as the billing unit. Code is already workspace-aware; just confirm the Stripe customer ID is on `workspaces` not `users` before launch. (Looking at `lib/db/src/schema/workspaces.ts` would confirm.)
- **AI cost control is per-user, not per-workspace** — `usersTable.creditsUsed` not `workspacesTable.creditsUsed`. If you ever support team billing, this needs a migration.
- **Image generation returns base64 data URIs** (`artifacts/api-server/src/lib/ai-providers.ts`). Fine for now, but at scale these blow up your DB and response payloads. Eventually move to S3/R2 + signed URLs.
- **Schedulers run in the API process.** Works for v1. At scale (>50 active brands), extract them into a worker (separate Railway service consuming the same DB).

---

## How to use this report

1. Open Claude Code in your terminal in `~/Desktop/konnectpilot`.
2. Paste this prompt:

   > Read AUDIT.md and work through the 🔴 CRITICAL issues first. For each item, propose the change, then apply it once I approve. After all 🔴 are done, stop and let me decide whether to continue with 🟠 PRE-LAUNCH.

3. Work through it across multiple sessions. Don't try to do it all in one sitting.

You don't have to do every item. The **🔴 CRITICAL** section is non-negotiable. The **🟠 PRE-LAUNCH** section blocks public launch. **🟡** and **🟢** are post-launch refinements.

---

*Generated by Claude on May 13, 2026. If something here looks wrong, push back — I may have misread a file.*
