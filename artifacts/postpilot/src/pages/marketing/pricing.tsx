import MarketingShell from "@/components/marketing-shell";
import { Link } from "wouter";
import { useState } from "react";
import { Check, ArrowRight, Minus, Zap } from "lucide-react";
import { PLANS, COMPARE_ROWS, TOP_UPS, ADD_ONS, CREDIT_RULES, priceFor, type BillingCycle } from "@/lib/plans";

const FAQ = [
  {
    q: "How do credits work?",
    a: "Each plan gives you a monthly credit allowance. AI image post + caption costs 1 credit, a text-only post costs 0.5, regenerating an image or caption costs 0.5, and a full AI blog article costs 4. Scheduling and publishing are always free.",
  },
  {
    q: "Is there a free plan?",
    a: "No — every paid plan starts with a 7-day free trial. Cancel before day 7 and you're never charged.",
  },
  {
    q: "What if I run out of credits?",
    a: "Buy a top-up pack any time (100 credits = $9, 250 = $19, 500 = $35). Top-up credits roll over month to month and are used after your monthly allocation.",
  },
  {
    q: "Can I add extra brands or teammates?",
    a: "Yes — extra brands and extra teammates are $5/month each, on top of any plan.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes, instantly. Upgrade and we'll prorate; downgrade and the change applies at the start of your next billing cycle.",
  },
];

function cell(v: boolean | string) {
  if (v === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (v === false) return <Minus className="w-4 h-4 text-muted-foreground/50 mx-auto" />;
  return <span className="text-sm text-foreground">{v}</span>;
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <MarketingShell>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight mb-5">
          Simple, credit-based pricing
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          7-day free trial on every plan. Pay only for AI generation — scheduling and publishing are always free.
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

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
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
                  ${priceFor(plan, cycle)}
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
      </section>

      {/* How credits work */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="bg-secondary/40 border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">How credits work</h3>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-foreground">
            {CREDIT_RULES.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Top-ups + add-ons */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <h2 className="text-2xl font-bold text-foreground mb-4">Top-ups & add-ons</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-1">Credit top-ups</h3>
            <p className="text-sm text-muted-foreground mb-4">
              One-time purchases that roll over month to month.
            </p>
            <div className="space-y-2">
              {TOP_UPS.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border border-border rounded-lg px-4 py-3 text-sm"
                >
                  <span className="font-medium text-foreground">{t.credits} credits</span>
                  <span className="font-semibold text-foreground">${t.priceUsd}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-1">Optional add-ons</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Stack on top of any plan.
            </p>
            <div className="space-y-2">
              {ADD_ONS.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border border-border rounded-lg px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <span className="font-semibold text-foreground">${a.priceUsd}/mo</span>
                </div>
              ))}
            </div>
          </div>
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
                <th className="p-4 font-semibold text-foreground">Agency</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-secondary/30" : ""}>
                  <td className="p-4 text-foreground">{row[0] as string}</td>
                  <td className="p-4 text-center">{cell(row[1] as boolean | string)}</td>
                  <td className="p-4 text-center">{cell(row[2] as boolean | string)}</td>
                  <td className="p-4 text-center">{cell(row[3] as boolean | string)}</td>
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
        <div className="mt-10 bg-secondary/50 border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Need a custom plan?</h3>
            <p className="text-sm text-muted-foreground">Get in touch for higher caps or dedicated support.</p>
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
    </MarketingShell>
  );
}
