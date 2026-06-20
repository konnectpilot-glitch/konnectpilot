// Marketing-side plan catalog. Must stay in sync with
// artifacts/api-server/src/lib/plans.ts (server is source of truth for limits).

export type PlanId = "starter" | "pro" | "agency";
export type BillingCycle = "monthly" | "yearly";

export interface MarketingPlan {
  id: PlanId;
  name: string;
  blurb: string;
  /** Monthly price USD. Yearly = monthly * 10 (2 months free) per industry default. */
  price: { monthly: number; yearly: number };
  popular?: boolean;
  credits: number;
  brands: number;
  socialAccounts: number;
  daysAdvance: number;
  features: string[];
}

// Audit v2 US-market pricing. Anchors:
//   $29 — above hobbyist floor, half of Predis/Ocoya entry
//   $79 — premium-but-accessible, "most ecom DTC owner" tier
//   $199 — agency-tier psychological anchor, undercuts Hootsuite Team
export const PLANS: MarketingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Solo founders running one Shopify or DTC store.",
    price: { monthly: 29, yearly: 290 },
    credits: 200,
    brands: 1,
    socialAccounts: 3,
    daysAdvance: 15,
    features: [
      "1 brand",
      "3 connected social accounts",
      "200 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "AI brand voice from your website",
      "Manual + auto approval modes",
      "15 days of advance scheduling",
      "Post history, analytics, brand memory",
      "7-day free trial",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Growing DTC brands posting daily across platforms.",
    price: { monthly: 79, yearly: 790 },
    popular: true,
    credits: 600,
    brands: 5,
    socialAccounts: 15,
    daysAdvance: 30,
    features: [
      "5 brands",
      "15 connected social accounts",
      "600 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "AI brand voice from your website",
      "AI brand memory (learns from approvals)",
      "Multi-platform generate (one click)",
      "Bulk approve / reject / reschedule",
      "30 days of advance scheduling",
      "Analytics dashboard",
      "Priority email support",
      "7-day free trial",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    blurb: "Agencies and operators managing multiple client brands.",
    price: { monthly: 199, yearly: 1990 },
    credits: 2000,
    brands: 25,
    socialAccounts: 75,
    daysAdvance: 60,
    features: [
      "25 brands",
      "75 connected social accounts",
      "2,000 AI credits / month",
      "Everything in Pro",
      "Team access (3 seats included)",
      "Advanced approval workflow",
      "60 days of advance scheduling",
      "Per-brand analytics + export",
      "White-label client reports",
      "Priority chat support",
      "7-day free trial",
    ],
  },
];

export interface TopUp {
  id: "credits_100" | "credits_250" | "credits_500";
  credits: number;
  priceUsd: number;
}
export const TOP_UPS: TopUp[] = [
  { id: "credits_100", credits: 100, priceUsd: 9 },
  { id: "credits_250", credits: 250, priceUsd: 19 },
  { id: "credits_500", credits: 500, priceUsd: 35 },
];

export interface AddOn {
  id: "extra_brand" | "extra_seat";
  name: string;
  priceUsd: number;
  description: string;
}
export const ADD_ONS: AddOn[] = [
  { id: "extra_brand", name: "Extra brand", priceUsd: 5, description: "Add one extra brand to any plan." },
  { id: "extra_seat", name: "Extra teammate", priceUsd: 5, description: "Invite an additional team member." },
];

export const COMPARE_ROWS: ReadonlyArray<readonly [string, string | boolean, string | boolean, string | boolean]> = [
  ["Brands", "1", "5", "25"],
  ["Connected social accounts", "3", "15", "75"],
  ["AI credits / month", "200", "600", "2,000"],
  ["Days of advance scheduling", "15", "30", "60"],
  ["Facebook, Instagram, LinkedIn", true, true, true],
  ["AI brand voice from website", true, true, true],
  ["AI brand memory", false, true, true],
  ["Multi-platform generate", false, true, true],
  ["Bulk actions in approval queue", false, true, true],
  ["Team access", false, false, true],
  ["White-label client reports", false, false, true],
  ["Priority support", false, true, true],
  ["7-day free trial", true, true, true],
];

export function priceFor(plan: MarketingPlan, cycle: BillingCycle): number {
  return cycle === "monthly" ? plan.price.monthly : Math.round(plan.price.yearly / 12);
}

// Credit consumption rules (display only; enforced on the server).
export const CREDIT_RULES = [
  "1 AI image post + caption = 1 credit",
  "1 text-only post = 0.5 credit",
  "Regenerate image or caption = 0.5 credit",
  "1 AI blog article = 4 credits",
  "Scheduling and publishing are free",
];
