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

export const PLANS: MarketingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Individuals and small businesses managing one brand.",
    price: { monthly: 19, yearly: 190 },
    credits: 120,
    brands: 1,
    socialAccounts: 3,
    daysAdvance: 15,
    features: [
      "1 brand",
      "3 connected social accounts",
      "120 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "Auto + Manual approval mode",
      "15 days of advance generation",
      "Basic scheduling, history, analytics",
      "7-day free trial",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Growing businesses and serious marketers.",
    price: { monthly: 49, yearly: 490 },
    popular: true,
    credits: 400,
    brands: 5,
    socialAccounts: 15,
    daysAdvance: 30,
    features: [
      "5 brands",
      "15 connected social accounts",
      "400 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "Auto + Manual approval mode",
      "30 days of advance generation",
      "Bulk approve / reject / reschedule",
      "Brand filtering + AI brand memory",
      "Analytics dashboard",
      "7-day free trial",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    blurb: "Agencies and teams managing multiple client brands.",
    price: { monthly: 99, yearly: 990 },
    credits: 1000,
    brands: 10,
    socialAccounts: 30,
    daysAdvance: 30,
    features: [
      "10 brands",
      "30 connected social accounts",
      "1000 AI credits / month",
      "Facebook, Instagram, LinkedIn",
      "Auto + Manual approval mode",
      "30 days of advance generation",
      "Advanced approval queue + bulk actions",
      "Advanced brand separation",
      "Team access",
      "Advanced analytics",
      "Priority support",
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
  ["Brands", "1", "5", "10"],
  ["Connected social accounts", "3", "15", "30"],
  ["AI credits / month", "120", "400", "1000"],
  ["Days of advance generation", "15", "30", "30"],
  ["Facebook, Instagram, LinkedIn", true, true, true],
  ["Auto + Manual approval", true, true, true],
  ["Bulk actions in approval queue", false, true, true],
  ["AI brand memory", false, true, true],
  ["Team access", false, false, true],
  ["Advanced analytics", false, false, true],
  ["Priority support", false, false, true],
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
