import MarketingShell from "@/components/marketing-shell";
import { Link } from "wouter";
import { useState } from "react";
import { Check, ArrowRight, Minus } from "lucide-react";

type Cycle = "monthly" | "yearly";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: { monthly: 19, yearly: 190 },
    blurb: "Solo creators dipping their toes in AI scheduling.",
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
    price: { monthly: 49, yearly: 490 },
    blurb: "Small teams shipping consistent content.",
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
    price: { monthly: 129, yearly: 1290 },
    blurb: "Agencies and growing brands at scale.",
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

const COMPARE_ROWS = [
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

const FAQ = [
  {
    q: "Is there a free plan?",
    a: "No — every plan starts with a 7-day free trial. We require a card upfront so we can deliver AI-powered features without bots and abuse. Cancel before day 7 and you're never charged.",
  },
  {
    q: "What happens if I exceed my plan limits?",
    a: "We'll never silently overage-bill you. When you reach a cap we'll show a clear upgrade prompt and pause new scheduling on that resource until you upgrade or the next cycle starts.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes, instantly. Upgrade and we'll prorate; downgrade and the change applies at the start of your next billing cycle.",
  },
  {
    q: "What if I need more than Business?",
    a: "Talk to us. Enterprise customers get custom limits, dedicated support, security review, and an SLA.",
  },
];

function cell(v: boolean | string) {
  if (v === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (v === false) return <Minus className="w-4 h-4 text-muted-foreground/50 mx-auto" />;
  return <span className="text-sm text-foreground">{v}</span>;
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <MarketingShell>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight mb-5">
          Simple, honest pricing
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          7-day free trial on every plan. No charge until day 7. Cancel anytime.
        </p>
        <div className="inline-flex items-center bg-secondary p-1 rounded-xl">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                cycle === c
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
              {c === "yearly" && <span className="ml-1.5 text-xs text-primary font-semibold">−17%</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card border rounded-2xl p-6 ${
                plan.popular ? "border-primary shadow-xl ring-1 ring-primary/20" : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most popular
                  </span>
                </div>
              )}
              <h3 className="font-bold text-foreground text-xl">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.blurb}</p>
              <div className="mb-5">
                <span className="text-4xl font-bold text-foreground">
                  ${cycle === "monthly" ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                </span>
                <span className="text-muted-foreground">/mo</span>
                {cycle === "yearly" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed ${plan.price.yearly}/year
                  </p>
                )}
              </div>
              <Link
                href="/sign-up"
                className={`block text-center font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm mb-5 ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                Start 7-day free trial
              </Link>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-secondary/50 border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Need more? Talk to us.</h3>
            <p className="text-sm text-muted-foreground">Enterprise plans come with custom caps, SSO, and dedicated support.</p>
          </div>
          <a
            href="mailto:sales@konnectpilot.com"
            className="inline-flex items-center gap-2 border border-border text-foreground bg-card font-semibold px-5 py-2.5 rounded-lg hover:bg-background text-sm"
          >
            Contact sales
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
          Compare plans
        </h2>
        <div className="overflow-x-auto bg-card border border-border rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 font-semibold text-foreground">Feature</th>
                <th className="p-4 font-semibold text-foreground">Starter</th>
                <th className="p-4 font-semibold text-primary">Pro</th>
                <th className="p-4 font-semibold text-foreground">Business</th>
                <th className="p-4 font-semibold text-foreground">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-secondary/30" : ""}>
                  <td className="p-4 text-foreground">{row[0] as string}</td>
                  <td className="p-4 text-center">{cell(row[1] as boolean | string)}</td>
                  <td className="p-4 text-center">{cell(row[2] as boolean | string)}</td>
                  <td className="p-4 text-center">{cell(row[3] as boolean | string)}</td>
                  <td className="p-4 text-center">{cell(row[4] as boolean | string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="bg-card border border-border rounded-xl p-5 group"
            >
              <summary className="font-semibold text-foreground cursor-pointer list-none flex justify-between items-center">
                {f.q}
                <span className="text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
