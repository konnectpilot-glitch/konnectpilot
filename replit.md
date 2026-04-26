# PostPilot — AI Social Media Auto-Posting SaaS

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
- `users` — Clerk users synced on first request; has plan, stripeCustomerId, stripeSubscriptionId
- `brands` — Brand configurations per user (name, industry, tone, targetAudience, keywords, platforms, postTime)
- `posts` — Generated post history (brandId, platform, content, status, publishedAt)

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
- `/billing` — Subscription plans and billing management
- `/settings` — Account settings via Clerk UserProfile

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
