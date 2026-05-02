import MarketingShell from "@/components/marketing-shell";
import { Link } from "wouter";
import { DollarSign, Repeat, BarChart3, Award, ArrowRight, Check } from "lucide-react";

const STATS = [
  { value: "30%", label: "Recurring commission" },
  { value: "12 mo", label: "Commission length" },
  { value: "60-day", label: "Cookie window" },
  { value: "$50", label: "Minimum payout" },
];

const PERKS = [
  { icon: Repeat, title: "Recurring revenue", text: "Earn 30% on every payment from your referrals — not just the first one." },
  { icon: BarChart3, title: "Real-time dashboard", text: "Track clicks, signups, conversions, and commissions live." },
  { icon: Award, title: "Top-tier creatives", text: "Banners, post copy, video walkthroughs — all ready to share." },
  { icon: DollarSign, title: "Monthly payouts", text: "Stripe Connect or PayPal, paid the 1st of each month." },
];

const HOW = [
  "Sign up for any KonnectPilot plan (or just a free affiliate account).",
  "Grab your unique referral link from the in-app Affiliate page.",
  "Share it on your blog, newsletter, social, course, or community.",
  "Earn 30% recurring on every paying customer for 12 months.",
];

export default function AffiliateLandingPage() {
  return (
    <MarketingShell>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 rounded-full mb-6">
          <DollarSign className="w-3.5 h-3.5" />
          Earn with KonnectPilot
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight mb-5">
          Get paid to share<br />
          <span className="text-primary">a tool people love.</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Refer creators, agencies, and small businesses. Earn 30% recurring commission for the first 12 months of every customer you bring.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
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

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
          Why partner with us
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-5 flex gap-4">
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
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
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
    </MarketingShell>
  );
}
