import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
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
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? "",
    features: [
      "1 brand",
      "4 platforms (Facebook, Instagram, LinkedIn, TikTok)",
      "Daily AI-generated posts",
      "Post history",
      "Copy-to-clipboard",
    ],
    brandLimit: 1,
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    features: [
      "5 brands",
      "All platforms",
      "Custom posting time",
      "Basic analytics",
      "Post history",
      "Priority email support",
    ],
    brandLimit: 5,
  },
  {
    id: "agency",
    name: "Agency",
    price: 99,
    stripePriceId: process.env.STRIPE_AGENCY_PRICE_ID ?? "",
    features: [
      "Unlimited brands",
      "All platforms",
      "White-label reports",
      "Priority support",
      "Team access",
      "Advanced analytics",
    ],
    brandLimit: null,
  },
];

router.get("/billing/plans", async (_req, res): Promise<void> => {
  res.json(ListPlansResponse.parse(PLANS));
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

  const plan = PLANS.find(p => p.id === parsed.data.planId);
  if (!plan) {
    res.status(400).json({ error: "Invalid plan" });
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
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl,
    metadata: { userId: String(user.id), planId: plan.id },
  });

  res.json(CreateCheckoutSessionResponse.parse({ url: session.url ?? "" }));
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
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
  const returnUrl = `https://${domains}/billing`;

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
    event = req.body;
  }

  const PLAN_MAP: Record<string, string> = {
    [process.env.STRIPE_STARTER_PRICE_ID ?? ""]: "starter",
    [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro",
    [process.env.STRIPE_AGENCY_PRICE_ID ?? ""]: "agency",
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = Number(session.metadata?.userId);
      const planId = session.metadata?.planId ?? "starter";
      if (userId) {
        await db.update(usersTable).set({
          plan: planId,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: "active",
        }).where(eq(usersTable.id, userId));

        // Mark affiliate referral as converted on first paid checkout.
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
        // Suppress only Postgres unique-constraint violations (code 23505),
        // which happen when Stripe re-delivers the same invoice webhook.
        // Any other error must propagate so Stripe can retry the webhook
        // and we don't silently drop real commission revenue.
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
      const invoiceId =
        typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
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
