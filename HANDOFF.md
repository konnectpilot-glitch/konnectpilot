# KonnectPilot — Project Handoff for Claude Code

You're picking up work on KonnectPilot, a Replit-built AI social media auto-posting SaaS by ClicknKonnect. The user (Ali) is on macOS, working in `~/Desktop/konnectpilot`. The user prefers Roman Urdu mixed with English. The user is non-technical — explain steps clearly, run commands yourself instead of asking them to.

## What is KonnectPilot

Monorepo SaaS that auto-generates and publishes social posts (FB/IG/LinkedIn) using AI. Stack:

- **Frontend (`artifacts/postpilot`)** — React 19 + Vite, Tailwind 4, Clerk auth, TanStack Query, wouter, Radix/shadcn UI. Runs on `localhost:25960`.
- **Backend (`artifacts/api-server`)** — Express 5, Clerk auth, Drizzle ORM, Stripe, Anthropic (Bedrock for text), Gemini Nano Banana (images). Runs on `localhost:8080` with two long-running schedulers (post + analytics).
- **Database** — Postgres via Neon, schema in `lib/db/src/schema`.
- **API contract** — OpenAPI in `lib/api-spec`, generates `lib/api-zod` (validators) and `lib/api-client-react` (TanStack Query hooks).

`pnpm-workspace.yaml` manages all workspaces. `pnpm install` is enforced via root `preinstall` script.

Most architectural detail lives in `replit.md` (read it first).

## What's already done locally

The user has:

1. **Cloned the repo** at `~/Desktop/konnectpilot`
2. **Installed pnpm 11.1.0** via `sudo npm install -g pnpm` (Node 24.15.0 from nodejs.org official installer)
3. **Removed buggy preinstall script** (it failed user-agent check on pnpm 11 — we deleted that line from root `package.json`)
4. **Removed all 5 `*-darwin-arm64` lines** from `pnpm-workspace.yaml` overrides (they blocked Mac arm64 platform binaries — user is on Apple Silicon)
5. **Approved `pnpm` build scripts** for `@clerk/shared` and `esbuild` via `pnpm approve-builds`
6. **Neon Postgres** project created, schema pushed via `cd lib/db && DATABASE_URL=... pnpm push` — all tables exist
7. **Clerk app** created with Email + Google sign-in
8. **`.env` files** created:
   - `artifacts/api-server/.env` has `PORT`, `NODE_ENV`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `SESSION_SECRET`, `APP_URL`, `CLERK_PUBLISHABLE_KEY`
   - `artifacts/postpilot/.env` has `VITE_CLERK_PUBLISHABLE_KEY`
9. **`package.json` scripts patched**:
   - `artifacts/api-server/package.json` → `start` now uses `node --env-file=.env --enable-source-maps ./dist/index.mjs`
   - `artifacts/postpilot/package.json` → `dev` / `build` / `serve` prefixed with `PORT=25960 BASE_PATH=/`
10. **User signed up** via Google in Clerk → Personal workspace auto-created in DB (verified via `/api/workspaces` returning 200 with 1 workspace named "Personal")

## What's broken right now

**Brand creation fails with 500 (empty response body).** The user fills the Create Brand form, hits submit, and gets "Failed to create brand" toast. The API returns 500 with `Content-Type: text/plain` and `Content-Length: 0`.

Likely cause: an unhandled exception in `artifacts/api-server/src/routes/brands.ts` POST handler. Pino-http logs the request with status 500 but the actual error stack isn't captured by the current `serializers` config in `app.ts` (it only logs method/url/statusCode, not the error from `req.log.error()`).

Things ruled out:
- Auth works (workspaces endpoint returns 200 for this user)
- Workspace exists (Personal, role owner)
- Plan allows brands (free plan = 1 brand, user has 0)
- Zod validation should pass with tone=`professional` (lowercase, matches enum)

Things to investigate first:
- Does `GetBrandResponse.parse({...brand, createdAt: brand.createdAt.toISOString()})` throw on insert response? Look at `lib/api-zod/src/generated/api.ts` for `GetBrandResponse` shape (note `lastBatchGeneratedAt` is `string().nullish()` but DB returns Date or null — if Date, `.parse()` will throw because it's not a string).
- Run `pnpm --filter @workspace/api-server dev` to start backend and watch logs while reproducing the bug. Server prints request errors via pino but currently swallows the original error message.
- Worst case, add a temporary `app.use((err, req, res, next) => { console.error(err); res.status(500).json({error: err.message}); })` in `app.ts` after the routes, restart, and try again.

**Also: the backend isn't running right now** — the user closed that terminal tab. Restart it before debugging.

## Current dev workflow

Two terminals needed:

```bash
# Terminal 1: backend
cd ~/Desktop/konnectpilot
pnpm --filter @workspace/api-server dev
# Wait for "Server listening port: 8080"

# Terminal 2: frontend
cd ~/Desktop/konnectpilot
pnpm --filter @workspace/postpilot dev
# Wait for "Local: http://localhost:25960/"
```

Browser: `http://localhost:25960`. User Ali is signed in via Google (Clerk).

## What user wants long-term

Build this into a "proper SaaS" they can launch publicly. Concrete goals discussed:
- Make the core flow bulletproof (sign-up → connect 1 social account → 1 brand → schedule → posts publish → analytics show)
- Production deploy (frontend on Vercel, backend on Railway/Render — they're aware Vercel can't run the long-lived schedulers natively)
- Get Facebook/IG/LinkedIn app review approval before real customers can post
- Add the boring-but-essential bits (transactional emails via SendGrid, Sentry, Terms/Privacy pages, Stripe live mode, support email)

User has NOT yet:
- Added AWS Bedrock token (`AWS_BEARER_TOKEN_BEDROCK`) → AI text generation won't work
- Added Google Gemini API key (`GOOGLE_API_KEY_NANO_BANANA`) → AI images won't work
- Added Stripe keys → billing won't work
- Created Facebook/IG/LinkedIn developer apps → social OAuth + publishing won't work

These can wait until the basic flow is solid. Don't try to set them all up at once.

## Repo gotchas

- 194 `.ts` + 156 `.tsx` files. ~18MB on disk.
- No README; `replit.md` is the architecture doc.
- No tests (`*.test.ts`, vitest/jest configs all absent).
- Some doc/code drift: `replit.md` mentions both "Bedrock + Gemini" (current) and "pollinations.ai + OpenAI GPT-4.1" (stale paragraph in the Auto-Posting Engine section). Recent commits confirm Bedrock/Gemini is current.
- `exports/konnectpilot.tar.gz` (3.3 MB) is checked into the repo and shouldn't be — leave it for now, mention to user before any cleanup commit.
- `attached_assets/` has 3.5 MB of screenshots/PRD pastes from Replit. Same deal.
- Many `@replit/vite-plugin-*` deps remain (cartographer, dev-banner, runtime-error-modal). They're harmless locally and only activate when `REPL_ID` env is set, but they'll be dead weight in production.

## What to do first when the user runs you

1. Read this file (you're already doing it)
2. `pnpm --filter @workspace/api-server dev` in one terminal (run it yourself; let it stay running)
3. Open `artifacts/api-server/src/routes/brands.ts` and `lib/api-zod/src/generated/api.ts` (the `GetBrandResponse` shape)
4. Either temporarily patch `app.ts` with a verbose error handler, or trace the brand-creation path manually
5. Once the brand-creation bug is fixed, ask the user what to tackle next
