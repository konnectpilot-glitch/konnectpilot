import MarketingShell from "@/components/marketing-shell";
import { Link } from "wouter";
import { useState } from "react";
import { DollarSign, Repeat, BarChart3, Award, ArrowRight, Check, Calculator } from "lucide-react";

const STATS = [
  { value: "30%", label: "Recurring commission" },
  { value: "12 mo", label: "Commission length" },
  { value: "60-day", label: "Cookie window" },
  { value: "$50", label: "Minimum payout" },
];

const PERKS = [
  { icon: Repeat, title: "Recurring revenue", text: "Earn 30% on every payment from your referrals — not just the first one." },
  { icon: BarChart3, title: "Real-time dashboard", text: "Track clicks, signups, conversions, and commissions live." },
  { icon: Award, title: "Top-tier creatives", text: "Banners, post copy, and ready-made marketing assets — all on the in-app affiliate page." },
  { icon: DollarSign, title: "Monthly payouts", text: "Stripe Connect or PayPal, paid the 1st of each month once you hit the $50 minimum." },
];

const HOW = [
  "Sign up for any KonnectPilot plan (or just a free affiliate account).",
  "Grab your unique referral link from the in-app Affiliate page.",
  "Share it on your blog, newsletter, social, course, or community.",
  "Earn 30% recurring on every paying customer for 12 months.",
];

const FAQ = [
  {
    q: "How and when do you pay out?",
    a: "Payouts are processed on the 1st of every month for any pending balance over $50, via PayPal or Stripe Connect (your choice). Below the minimum, your balance rolls forward to the next month.",
  },
  {
    q: "How long does the cookie last?",
    a: "60 days. If someone clicks your link and signs up within 60 days, the referral is attributed to you — even if they sign up from a different device, as long as they use the same browser session.",
  },
  {
    q: "Do refunds claw back my commission?",
    a: "Yes. If a referred customer is refunded, the corresponding commission is reversed. We never claw back beyond the refunded payment, and any commissions already paid out are deducted from future payouts (never the other way around).",
  },
  {
    q: "Can I refer myself?",
    a: "No. Self-referrals are blocked at signup time and any that slip through will be reversed. We want to reward real referrals, not loophole-hunting.",
  },
  {
    q: "Are there banned promotion methods?",
    a: "Yes — no spam, no incentivized signups (cashback / coupon sites), no brand-name keyword bidding, and no fake reviews. Violations end the partnership and forfeit pending commissions.",
  },
];

const PLAN_PRICES = [19, 49, 129];

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AffiliateLandingPage() {
  const [customers, setCustomers] = useState(10);
  const [planIdx, setPlanIdx] = useState(1); // Pro by default

  const monthlyEarn = customers * PLAN_PRICES[planIdx] * 0.3;
  const yearEarn = monthlyEarn * 12;

  return (
    <MarketingShell>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 rounded-full mb-6">
          <DollarSign className="w-3.5 h-3.5" />
          Earn with KonnectPilot
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight leading-[1.05] mb-5">
          Get paid to share<br />
          <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-500 bg-clip-text text-transparent">
            a tool people love.
          </span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Refer creators, agencies, and small businesses. Earn 30% recurring commission for the first 12 months on every customer you bring.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-md"
        >
          Become an affiliate
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings calculator */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">
              Earnings calculator
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-6">
            See what you could be earning.
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="aff-customers"
                className="text-xs font-medium text-muted-foreground"
              >
                Paying customers you refer:{" "}
                <span className="text-foreground font-semibold">{customers}</span>
              </label>
              <input
                id="aff-customers"
                type="range"
                min={1}
                max={100}
                value={customers}
                onChange={(e) => setCustomers(Number(e.target.value))}
                className="w-full mt-2 accent-primary"
                aria-label="Number of paying customers referred"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1</span><span>50</span><span>100</span>
              </div>

              <label className="text-xs font-medium text-muted-foreground mt-5 block">
                Average plan they pick
              </label>
              <div className="mt-2 flex gap-2">
                {(["Starter", "Pro", "Business"] as const).map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setPlanIdx(i)}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      planIdx === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {label}
                    <span className="block text-[10px] font-normal opacity-80">
                      {fmt(PLAN_PRICES[i])}/mo
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/10 via-blue-500/5 to-indigo-500/10 rounded-xl p-5 flex flex-col justify-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                You'd earn
              </p>
              <p className="text-4xl sm:text-5xl font-bold text-foreground mt-1">
                {fmt(monthlyEarn)}
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ≈ <span className="font-semibold text-foreground">{fmt(yearEarn)}</span> in
                year one alone.
              </p>
              <p className="text-[11px] text-muted-foreground mt-3">
                Estimate based on 30% commission on {customers} active monthly customer{customers === 1 ? "" : "s"} for 12 months.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10 tracking-tight">
          Why partner with us
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-xl p-5 flex gap-4 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 tracking-tight">
          How it works
        </h2>
        <ol className="space-y-4">
          {HOW.map((step, i) => (
            <li key={step} className="flex items-start gap-4 bg-card border border-border rounded-xl p-5">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-foreground pt-1">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 tracking-tight">
          Affiliate FAQ
        </h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="bg-card border border-border rounded-xl p-5 group"
            >
              <summary className="font-semibold text-foreground cursor-pointer list-none flex justify-between items-center gap-4">
                {f.q}
                <span className="text-muted-foreground group-open:rotate-45 transition-transform text-2xl leading-none flex-shrink-0">
                  +
                </span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-bold text-foreground mb-4">Program rules</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Self-referrals are not allowed and will be reversed.",
            "Refunded customers don't generate commissions.",
            "Spam and brand-bid keyword campaigns are prohibited.",
            "We reserve the right to remove affiliates who violate the program rules.",
          ].map((r) => (
            <li key={r} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-gradient-to-br from-primary via-blue-600 to-indigo-600 rounded-3xl px-8 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3 tracking-tight">
            Start earning this month.
          </h2>
          <p className="text-primary-foreground/85 mb-6 max-w-lg mx-auto">
            Sign up, grab your link from the in-app affiliate page, and share. Commissions accrue from your very first conversion.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg hover:bg-white/90 shadow-md"
          >
            Become an affiliate <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
