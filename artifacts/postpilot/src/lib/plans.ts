export type PlanId = "starter" | "pro" | "business";
export type BillingCycle = "monthly" | "yearly";

export interface MarketingPlan {
  id: PlanId;
  name: string;
  blurb: string;
  price: { monthly: number; yearly: number };
  popular?: boolean;
  features: string[];
}

export const PLANS: MarketingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Solo creators dipping their toes in AI scheduling.",
    price: { monthly: 19, yearly: 190 },
    features: [
      "1 team seat",
      "3 social accounts",
      "60 scheduled posts / month",
      "30 AI captions / month",
      "15 AI images / month",
      "2 GB media storage",
      "30-day analytics history",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Small teams shipping consistent content.",
    price: { monthly: 49, yearly: 490 },
    popular: true,
    features: [
      "3 team seats",
      "10 social accounts",
      "300 scheduled posts / month",
      "200 AI captions / month",
      "80 AI images / month",
      "20 GB media storage",
      "12 months analytics",
      "Approval workflow",
      "Email support",
    ],
  },
  {
    id: "business",
    name: "Business",
    blurb: "Agencies and growing brands at scale.",
    price: { monthly: 129, yearly: 1290 },
    features: [
      "10 team seats",
      "25 social accounts",
      "1,000 scheduled posts / month",
      "800 AI captions / month",
      "300 AI images / month",
      "100 GB media storage",
      "24 months analytics",
      "Approval workflow + audit log",
      "Email + chat support",
    ],
  },
];

export const COMPARE_ROWS: ReadonlyArray<readonly [string, string | boolean, string | boolean, string | boolean, string | boolean]> = [
  ["Team seats", "1", "3", "10", "Custom"],
  ["Social accounts", "3", "10", "25", "Custom"],
  ["Scheduled posts / mo", "60", "300", "1,000", "Custom"],
  ["AI captions / mo", "30", "200", "800", "Custom"],
  ["AI images / mo", "15", "80", "300", "Custom"],
  ["Media storage", "2 GB", "20 GB", "100 GB", "Custom"],
  ["Analytics history", "30 days", "12 months", "24 months", "Custom"],
  ["Calendar + multi-schedule", true, true, true, true],
  ["Approval workflow", false, true, true, true],
  ["Audit log", false, false, true, true],
  ["Priority support", false, "Email", "Email + chat", "Dedicated"],
];

export function priceFor(plan: MarketingPlan, cycle: BillingCycle): number {
  return cycle === "monthly" ? plan.price.monthly : Math.round(plan.price.yearly / 12);
}
