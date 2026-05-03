# KonnectPilot — AI Social Media Auto-Posting SaaS

**By ClicknKonnect** | Built with React+Vite, Express 5, Drizzle ORM, Clerk Auth, Stripe, Anthropic Claude

## Architecture

### Monorepo Structure
```
artifacts/postpilot/       → React+Vite frontend (port 25960, preview /)
artifacts/api-server/      → Express 5 API server (port 8080, preview /api)
lib/db/                    → Drizzle ORM schema + migrations
lib/api-spec/              → OpenAPI spec + codegen scripts
lib/api-zod/               → Generated Zod validators
lib/api-client-react/      → Generated React Query hooks
```

### Key Technologies
- **Frontend**: React 18, Vite, Tailwind CSS, @clerk/react, TanStack Query, wouter, react-hook-form, date-fns, react-icons
- **Backend**: Express 5, @clerk/express, @anthropic-ai/sdk (Claude claude-sonnet-4-5), stripe
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Clerk (dev keys configured)
- **AI**: Anthropic Claude claude-sonnet-4-5 for content generation
- **Payments**: Stripe subscriptions (Starter $19, Pro $49, Agency $99)

### Database Schema
- `users` — Clerk users synced on first request; has plan, stripeCustomerId, stripeSubscriptionId, activeWorkspaceId
- `workspaces` — Team workspaces (name, isPersonal, requireApproval). Each user gets a Personal workspace on first request.
- `workspace_members` — User<->workspace membership with role (owner/admin/editor/viewer). Unique idx (workspaceId, userId).
- `brands` — Brand configurations scoped to workspace (workspaceId, name, industry, tone, targetAudience, keywords, platforms, postTime)
- `posts` — Generated/published post history scoped to workspace. Adds submittedById/approvedById/approvedAt and "pending_approval" + "rejected" statuses. Unique index on (scheduleId, scheduledFor, platform) for atomic slot claiming.
- `post_comments` — Threaded comments on posts (postId, userId, parentId self-FK, content)
- `posting_schedules` — Auto-post schedules scoped to workspace (workspaceId, brandId, platforms[], postTimes[] in UTC HH:MM, timezone, contentPrompt, imageStyle, isActive, lastRunAt)
- `social_accounts` — OAuth connections scoped to workspace (workspaceId, accessToken/refreshToken/platformUserId)

### Team Workspaces & Approval Workflow
- Every API request resolves the active workspace via `X-Workspace-Id` header (sent by the React frontend) or falls back to `users.activeWorkspaceId`. Middleware `requireWorkspace` populates `req.workspace`/`workspaceId`/`workspaceRole`.
- Role ranking: viewer < editor < admin < owner. Writes require editor; deletes/connects/approvals require admin.
- When `workspace.requireApproval=true`, the scheduler parks newly-published posts in `pending_approval` instead of publishing immediately. Editors can submit a `generated`/`rejected` post (`POST /posts/:id/submit`) and admins approve (`POST /posts/:id/approve`) or reject (`POST /posts/:id/reject`). Approving a non-scheduled post optionally publishes it inline.
- Workspace switcher lives in the layout header; the React `WorkspaceProvider` registers an `extraHeadersProvider` on the api-client-react custom fetch that injects `X-Workspace-Id` on every generated query/mutation.
- Threaded comments panel on the Posts page (`/posts`) lets any workspace member comment; deletes are restricted to the comment author or admins.

### Analytics & Performance Memory
- New tables in `lib/db/src/schema/analytics.ts`: `post_metrics_snapshots` (per-post time-series), `brand_daily_aggregates` (daily KPI rollups), `follower_history`, `brand_performance_memory` (distilled strategy sibling to brand_memory_profiles), `ai_insights` (recommendations queue), `analytics_reports` (weekly/monthly), `metric_fetch_cursors` (decaying scheduler state).
- Background `analytics-scheduler.ts` polls FB/IG/LinkedIn metrics on decaying cadence (1h → 6h → 24h, capped 30d), computes per-post engagement scores, refreshes daily aggregates + follower history, prunes raw snapshots >90d.
- `performance-memory.ts` distills top exemplars, best hours, best content types, winning hashtags/hook templates, and a 1-paragraph strategy via `gpt-4.1-mini` every 5 new samples.
- `buildPerformanceMemoryContext()` is concatenated alongside `buildBrandMemoryContext()` in both `routes/generate.ts` and `routes/approval.ts`. The two memories are stored separately and never merged at write time.
- `routes/analytics.ts` exposes summary, timeseries, top-posts, compare, recommendations, insights (refresh/dismiss/apply), performance-memory, weekly/monthly reports, and SEO suggestions. All gated by `requireAuth` + `requireWorkspace`.
- Analytics endpoints are defined contract-first in `lib/api-spec/openapi.yaml` and consumed via Orval-generated React Query hooks (`useGetAnalyticsSummary`, `useApplyAiInsight`, `useCompareAnalyticsPosts`, etc.).
- `lib/oauth-refresh.ts` centralizes Facebook/Instagram (`fb_exchange_token`) and LinkedIn (`refresh_token`) token refresh. Scheduler calls `ensureFreshAccessToken` proactively and `forceRefreshAccessToken` on `HttpAuthError` (401/403).
- LinkedIn collectors send `Authorization: Bearer <token>` plus `LinkedIn-Version` and `X-Restli-Protocol-Version` headers (analytics-collectors.ts).
- Frontend `/analytics` page (sidebar nav with `LineChart` icon) renders KPIs, recharts trends, follower chart, top posts (with checkbox-driven side-by-side **Compare drawer**), best-time heatmap, **content-type performance breakdown** (horizontal bar), AI insights with **Apply** + dismiss buttons, Performance Memory display, and weekly/monthly report download.

## API Routes

### Auth (all protected via Clerk JWT)
- `GET /api/users/me` — Get current user
- `PATCH /api/users/me` — Update user profile

### Brands
- `GET /api/brands` — List brands for user
- `POST /api/brands` — Create brand (plan limit enforced)
- `GET /api/brands/:id` — Get specific brand
- `PATCH /api/brands/:id` — Update brand
- `DELETE /api/brands/:id` — Delete brand

### Posts
- `GET /api/posts` — List posts (filter by platform/status)
- `DELETE /api/posts/:id` — Delete post

### Generate
- `POST /api/generate` — Generate AI post content with Claude
- `POST /api/generate/save` — Save generated post to history

### Auto-Post Schedules
- `GET /api/schedules` — List user's posting schedules
- `POST /api/schedules` — Create schedule (brandId, platforms[], postTimes[] HH:MM UTC, contentPrompt, imageStyle)
- `GET /api/schedules/:id` — Get specific schedule
- `PATCH /api/schedules/:id` — Update schedule (re-validates brand ownership)
- `DELETE /api/schedules/:id` — Delete schedule
- `GET /api/schedules/:id/posts` — Past published posts for a schedule

### Social Accounts (OAuth)
- `GET /api/social-accounts` — List connected accounts
- `GET /api/social-accounts/:platform/oauth-url` — Start OAuth flow (facebook/instagram/linkedin)
- `GET /api/social-accounts/:platform/callback` — OAuth callback
- `DELETE /api/social-accounts/:id` — Disconnect account

### Billing
- `GET /api/billing/plans` — List available plans (public)
- `POST /api/billing/checkout` — Create Stripe checkout session
- `POST /api/billing/portal` — Create Stripe billing portal session
- `POST /api/billing/webhooks` — Handle Stripe webhooks

### Dashboard
- `GET /api/dashboard/stats` — Dashboard statistics
- `GET /api/dashboard/recent-posts` — Recent posts (last 10)
- `GET /api/dashboard/platform-breakdown` — Posts by platform

## Frontend Pages
- `/` — Landing page (public)
- `/sign-in` — Clerk sign-in
- `/sign-up` — Clerk sign-up
- `/dashboard` — Main dashboard with stats, recent posts
- `/brands` — Brand management list
- `/brands/new` — Create brand form
- `/brands/:id` — Edit brand form
- `/generate` — AI post generation interface
- `/posts` — Post history with filtering
- `/accounts` — Connect Facebook / Instagram / LinkedIn OAuth accounts
- `/schedules` — Auto-post schedules: pick brand, platforms, daily times (UTC), pause/resume, view history
- `/billing` — Subscription plans and billing management
- `/settings` — Account settings via Clerk UserProfile

## Auto-Posting Engine
- **Scheduler**: `artifacts/api-server/src/lib/scheduler.ts` — runs every 60s. For each active schedule, finds slot times within a 5-minute tolerance of "now" and atomically claims each `(scheduleId, scheduledFor, platform)` slot via insert with unique-index protection. Concurrent ticks racing the same slot get a unique violation and skip. The claimed row is then filled in by background generation (image via pollinations.ai, caption via OpenAI GPT-4.1) and publishing. All scheduling is UTC; the `timezone` field is stored but currently ignored — UI hardcodes UTC.
- **Publishers**: `artifacts/api-server/src/lib/publishers.ts` — Facebook (`/me/accounts` → first Page → `/{page-id}/photos`), Instagram (`/me/accounts` → linked IG Business account → media container + `/media_publish`), LinkedIn (`registerUpload` → PUT image bytes → `/v2/ugcPosts`, parses `x-restli-id` header for post id). All publish image+caption only — no video/TikTok yet.
- **MVP limitations** (deferred): timezone support, Facebook Page picker (currently auto-selects first Page), TikTok / video posting, retry on transient failures, catch-up for slots missed during downtime > 5min.

## Plan Limits
- **Free**: 1 brand
- **Starter ($19/mo)**: 1 brand
- **Pro ($49/mo)**: 5 brands
- **Agency ($99/mo)**: Unlimited brands

## Environment Variables Required
### Already Configured
- `CLERK_SECRET_KEY` (secret)
- `CLERK_PUBLISHABLE_KEY` (secret)
- `VITE_CLERK_PUBLISHABLE_KEY` (env var)
- `SESSION_SECRET` (secret)
- `DATABASE_URL` (runtime managed)

### Still Needed for Full Functionality
- `ANTHROPIC_API_KEY` — Required for AI content generation
- `STRIPE_SECRET_KEY` — Required for billing
- `STRIPE_WEBHOOK_SECRET` — Required for Stripe webhook verification
- `STRIPE_STARTER_PRICE_ID` — Stripe price ID for Starter plan
- `STRIPE_PRO_PRICE_ID` — Stripe price ID for Pro plan
- `STRIPE_AGENCY_PRICE_ID` — Stripe price ID for Agency plan

## Vite Proxy (Development)
The postpilot frontend proxies `/api` and `/__clerk` to `http://localhost:8080` for local development.
