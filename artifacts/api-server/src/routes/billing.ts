import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
  processedStripeEventsTable,
} from "@workspace/db";
import {
  commissionPeriodFor,
  computeCommissionCents,
} from "../lib/affiliate";
import {
  ListPlansResponse,
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
  CreatePortalSessionResponse,
} from "@workspace/api-zod";
import { requireAuth, ensureUser } from "./users";
import {
  PLAN_CONFIG,
  PLAN_ORDER,
  TOP_UPS,
  ADD_ONS,
  type Plan,
} from "../lib/plans";
import { addBonusCredits } from "../lib/quotas";

const router: IRouter = Router();

// Marketing list excludes "free" — that's the default tier for unsubscribed users.
function publicPlans() {
  return PLAN_ORDER.filter((id) => id !== "free").map((id) => {
    const p = PLAN_CONFIG[id];
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      stripePriceId: p.stripePriceId,
      features: p.features,
      brandLimit: p.brands,
      socialAccountLimit: p.socialAccounts,
      creditsLimit: p.credits,
      daysAdvance: p.daysAdvance,
      popular: p.popular ?? false,
    };
  });
}

router.get("/billing/plans", async (_req, res): Promise<void> => {
  res.json(ListPlansResponse.parse(publicPlans()));
});

router.get("/billing/topups", async (_req, res): Promise<void> => {
  res.json(
    TOP_UPS.map((t) => ({
      id: t.id,
      credits: t.credits,
      priceUsd: t.priceUsd,
      configured: Boolean(t.stripePriceId),
    })),
  );
});

router.get("/billing/addons", async (_req, res): Promise<void> => {
  res.json(
    ADD_ONS.map((a) => ({
      id: a.id,
      name: a.name,
      priceUsd: a.priceUsd,
      configured: Boolean(a.stripePriceId),
    })),
  );
});

router.post("/billing/checkout", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);

  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const planId = parsed.data.planId as Plan;
  const plan = PLAN_CONFIG[planId];
  if (!plan || planId === "free") {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  if (!plan.stripePriceId) {
    res.status(500).json({ error: `Stripe price id for ${plan.name} is not configured` });
    return;
  }

  const stripe = new Stripe(stripeSecret);

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: String(user.id), clerkId: user.clerkId },
    });
    customerId = customer.id;
    await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    mode: "subscription",
    subscription_data: { trial_period_days: 7 },
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl,
    metadata: { userId: String(user.id), planId: plan.id, kind: "subscription" },
  });

  res.json(CreateCheckoutSessionResponse.parse({ url: session.url ?? "" }));
});

// One-time credit top-up checkout. Body: { topupId, successUrl, cancelUrl }
router.post("/billing/topup", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const { topupId, successUrl, cancelUrl } = req.body ?? {};
  const topup = TOP_UPS.find((t) => t.id === topupId);
  if (!topup) {
    res.status(400).json({ error: "Invalid top-up id" });
    return;
  }
  if (!topup.stripePriceId) {
    res.status(500).json({ error: `Stripe price id for top-up ${topup.id} is not configured` });
    return;
  }
  if (typeof successUrl !== "string" || typeof cancelUrl !== "string") {
    res.status(400).json({ error: "successUrl and cancelUrl required" });
    return;
  }
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }
  const stripe = new Stripe(stripeSecret);
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const c = await stripe.customers.create({
      email: user.email,
      metadata: { userId: String(user.id), clerkId: user.clerkId },
    });
    customerId = c.id;
    await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
  }
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: topup.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: String(user.id),
      kind: "topup",
      topupId: topup.id,
      credits: String(topup.credits),
    },
  });
  res.json({ url: session.url ?? "" });
});

router.post("/billing/portal", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);

  if (!user.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found. Please subscribe to a plan first." });
    return;
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const stripe = new Stripe(stripeSecret);
  const appUrl = process.env.APP_URL ?? "http://localhost:25960";
  const returnUrl = `${appUrl.replace(/\/$/, "")}/billing`;

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  res.json(CreatePortalSessionResponse.parse({ url: session.url }));
});

router.post("/billing/webhooks", async (req: any, res): Promise<void> => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const stripe = new Stripe(stripeSecret);
  let event: Stripe.Event;

  if (webhookSecret) {
    const sig = req.headers["stripe-signature"] as string;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      req.log.warn({ err: err.message }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  } else {
    // In production we MUST refuse unsigned webhooks — accepting them would
    // let an attacker mint subscriptions or top-up credits via forged JSON.
    if (process.env.NODE_ENV === "production") {
      req.log.error("STRIPE_WEBHOOK_SECRET is not set in production; rejecting webhook");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }
    event = req.body;
  }

  // Idempotency: Stripe retries deliveries; the unique PK on event_id makes
  // duplicate processing a no-op (insert fails with 23505).
  try {
    await db.insert(processedStripeEventsTable).values({
      eventId: event.id,
      type: event.type,
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string } | null)?.code;
    if (pgCode === "23505") {
      req.log.info({ eventId: event.id, type: event.type }, "Skipped duplicate Stripe webhook");
      res.json({ status: "duplicate" });
      return;
    }
    throw err;
  }

  // Map Stripe price ids back to our plan ids for subscription updates.
  const PLAN_MAP: Record<string, Plan> = {};
  for (const id of PLAN_ORDER) {
    const sp = PLAN_CONFIG[id].stripePriceId;
    if (sp) PLAN_MAP[sp] = id;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = Number(session.metadata?.userId);
      const kind = session.metadata?.kind;

      if (!userId) break;

      if (kind === "topup") {
        const credits = Number(session.metadata?.credits ?? 0);
        if (credits > 0) {
          await addBonusCredits(userId, credits);
          req.log.info({ userId, credits, sessionId: session.id }, "Top-up credited");
        }
        break;
      }

      // Subscription checkout — assign plan + mark referral as converted.
      const planId = (session.metadata?.planId ?? "starter") as Plan;
      await db.update(usersTable).set({
        plan: planId,
        stripeSubscriptionId: session.subscription as string,
        subscriptionStatus: "active",
      }).where(eq(usersTable.id, userId));

      const [ref] = await db
        .select()
        .from(affiliateReferralsTable)
        .where(eq(affiliateReferralsTable.referredUserId, userId));
      if (ref && !ref.convertedAt) {
        await db
          .update(affiliateReferralsTable)
          .set({ convertedAt: new Date(), status: "converted" })
          .where(eq(affiliateReferralsTable.id, ref.id));
      }
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (!customerId) break;
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.stripeCustomerId, customerId));
      if (!user) break;
      const [ref] = await db
        .select()
        .from(affiliateReferralsTable)
        .where(eq(affiliateReferralsTable.referredUserId, user.id));
      if (!ref || !ref.convertedAt) break;

      const invoiceDate = new Date((invoice.created ?? 0) * 1000);
      const periodIndex = commissionPeriodFor(ref.convertedAt, invoiceDate);
      if (periodIndex === null) break;

      const amountPaid = invoice.amount_paid ?? 0;
      if (amountPaid <= 0) break;
      const commissionCents = computeCommissionCents(amountPaid);
      try {
        await db.insert(affiliateCommissionsTable).values({
          affiliateId: ref.affiliateId,
          referralId: ref.id,
          stripeInvoiceId: invoice.id ?? null,
          amountCents: commissionCents,
          currency: invoice.currency ?? "usd",
          periodIndex,
          status: "pending",
        });
        req.log.info(
          {
            affiliateId: ref.affiliateId,
            referralId: ref.id,
            invoiceId: invoice.id,
            commissionCents,
            periodIndex,
          },
          "Affiliate commission recorded",
        );
      } catch (err: unknown) {
        const pgCode = (err as { code?: string } | null)?.code;
        if (pgCode === "23505") {
          req.log.info(
            { invoiceId: invoice.id },
            "Skipped duplicate affiliate commission (idempotent webhook delivery)",
          );
        } else {
          req.log.error(
            { err, invoiceId: invoice.id, affiliateId: ref.affiliateId },
            "Failed to record affiliate commission",
          );
          throw err;
        }
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const chargeInvoice = (charge as unknown as { invoice?: string | { id?: string } | null }).invoice;
      const invoiceId =
        typeof chargeInvoice === "string"
          ? chargeInvoice
          : chargeInvoice && typeof chargeInvoice === "object"
            ? chargeInvoice.id
            : undefined;
      if (!invoiceId) break;
      await db
        .update(affiliateCommissionsTable)
        .set({ status: "reversed" })
        .where(eq(affiliateCommissionsTable.stripeInvoiceId, invoiceId));
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id ?? "";
      const planId = PLAN_MAP[priceId] ?? "starter";
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.stripeCustomerId, sub.customer as string));
      if (user) {
        await db.update(usersTable).set({
          plan: planId,
          subscriptionStatus: sub.status,
          stripeSubscriptionId: sub.id,
        }).where(eq(usersTable.id, user.id));
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.stripeCustomerId, sub.customer as string));
      if (user) {
        await db.update(usersTable).set({
          plan: "free",
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
        }).where(eq(usersTable.id, user.id));
      }
      break;
    }
    default:
      req.log.info({ type: event.type }, "Unhandled Stripe event");
  }

  res.json({ status: "ok" });
});

export default router;
