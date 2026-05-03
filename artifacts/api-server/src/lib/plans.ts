// Single source of truth for plan packaging. Mirrored to the marketing /
// pricing page (artifacts/postpilot/src/lib/plans.ts) and the public
// /billing/plans API response.

export type Plan = "free" | "starter" | "pro" | "agency";

export interface PlanConfig {
  id: Plan;
  name: string;
  /** USD per month, integer dollars. Free is 0. */
  price: number;
  /** Stripe price id for the recurring subscription, loaded from env. */
  stripePriceId: string;
  /** Monthly AI credit allowance. */
  credits: number;
  /** Brand cap (no plan is unlimited per product spec). */
  brands: number;
  /** Connected social account cap. */
  socialAccounts: number;
  /** How far ahead users can schedule / batch-generate posts. */
  daysAdvance: number;
  /** Marketing bullet points shown on pricing + billing pages. */
  features: string[];
  popular?: boolean;
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    stripePriceId: "",
    credits: 5,
    brands: 1,
    socialAccounts: 1,
    daysAdvance: 7,
    features: [
      "1 brand",
      "1 connected account",
      "5 trial credits",
      "Basic scheduling",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 19,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? "",
    credits: 120,
    brands: 1,
    socialAccounts: 3,
    daysAdvance: 15,
    features: [
      "1 brand",
      "3 connected social accounts",
      "120 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "Auto + Manual approval",
      "15 days of advance generation",
      "Basic scheduling, history, analytics",
      "7-day free trial",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 49,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    credits: 400,
    brands: 5,
    socialAccounts: 15,
    daysAdvance: 30,
    popular: true,
    features: [
      "5 brands",
      "15 connected social accounts",
      "400 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "Auto + Manual approval",
      "30 days of advance generation",
      "Bulk approve / reject / reschedule",
      "Brand filtering + AI brand memory",
      "Analytics dashboard",
      "7-day free trial",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 99,
    stripePriceId: process.env.STRIPE_AGENCY_PRICE_ID ?? "",
    credits: 1000,
    brands: 10,
    socialAccounts: 30,
    daysAdvance: 30,
    features: [
      "10 brands",
      "30 connected social accounts",
      "1000 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "Auto + Manual approval",
      "30 days of advance generation",
      "Advanced approval queue + bulk actions",
      "Advanced brand separation",
      "Team access",
      "Advanced analytics",
      "Priority support",
      "7-day free trial",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "agency"];

export function getPlan(plan: string): PlanConfig {
  return PLAN_CONFIG[(plan as Plan) in PLAN_CONFIG ? (plan as Plan) : "free"];
}

// ---- Credit costs (per spec) ----
// Use a discriminated key, NOT the raw kind, so we can add new operations
// (blog, regenerate) without ambiguity.
export const CREDIT_COST = {
  text_post: 0.5, // text-only post / caption
  image_post: 1, // AI image (post + caption combo)
  regenerate: 0.5, // re-roll a caption or image
  blog: 4, // long-form blog article
} as const;
export type CreditOp = keyof typeof CREDIT_COST;

// ---- Top-up packages (one-time credit purchases) ----
export interface TopUp {
  id: "credits_100" | "credits_250" | "credits_500";
  credits: number;
  priceUsd: number;
  stripePriceId: string;
}

export const TOP_UPS: TopUp[] = [
  {
    id: "credits_100",
    credits: 100,
    priceUsd: 9,
    stripePriceId: process.env.STRIPE_TOPUP_100_PRICE_ID ?? "",
  },
  {
    id: "credits_250",
    credits: 250,
    priceUsd: 19,
    stripePriceId: process.env.STRIPE_TOPUP_250_PRICE_ID ?? "",
  },
  {
    id: "credits_500",
    credits: 500,
    priceUsd: 35,
    stripePriceId: process.env.STRIPE_TOPUP_500_PRICE_ID ?? "",
  },
];

// ---- Recurring add-ons ($5/mo each) ----
export interface AddOn {
  id: "extra_brand" | "extra_seat";
  name: string;
  priceUsd: number;
  stripePriceId: string;
}

export const ADD_ONS: AddOn[] = [
  {
    id: "extra_brand",
    name: "Extra brand",
    priceUsd: 5,
    stripePriceId: process.env.STRIPE_ADDON_BRAND_PRICE_ID ?? "",
  },
  {
    id: "extra_seat",
    name: "Extra teammate",
    priceUsd: 5,
    stripePriceId: process.env.STRIPE_ADDON_SEAT_PRICE_ID ?? "",
  },
];
