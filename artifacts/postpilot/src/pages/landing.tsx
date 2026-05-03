import { Link } from "wouter";
import {
  Check,
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Bot,
  Calendar,
  BarChart3,
  Sparkles,
  Layers,
  Shield,
  ShieldCheck,
  Clock,
  Users,
  X,
  Star,
} from "lucide-react";
import MarketingShell from "@/components/marketing-shell";
import { KpMark } from "@/components/kp-logo";
import ProductMockup from "@/components/marketing/product-mockup";
import { PLANS, priceFor } from "@/lib/plans";

const HOW_STEPS = [
  {
    icon: Bot,
    title: "Set up your brand",
    text: "Add your brand voice, colors, and connected accounts once. KonnectPilot remembers everything.",
  },
  {
    icon: Sparkles,
    title: "Let AI draft a month",
    text: "Generate captions, hashtags, and on-brand images in seconds. Edit anything you want, approve the rest.",
  },
  {
    icon: Calendar,
    title: "Schedule and forget",
    text: "Drop posts on a visual calendar, queue recurring slots, and we publish them at the right time.",
  },
];

const PILLARS = [
  {
    icon: Sparkles,
    title: "AI Create",
    text: "GPT-4 captions in 5 tones, AI image generation tuned to your brand, smart hashtag suggestions.",
    bullets: ["Per-platform overrides", "5 brand voices", "AI image gen"],
    accent: "from-purple-500/20 to-blue-500/10",
  },
  {
    icon: Calendar,
    title: "Schedule",
    text: "Plan a month in an afternoon. Visual calendar, recurring queue slots, and multi-schedule.",
    bullets: ["Monthly + weekly views", "Recurring queues", "Multi-account fan-out"],
    accent: "from-blue-500/20 to-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Analyze",
    text: "Per-post and per-account analytics. Know what works without staring at six dashboards.",
    bullets: ["Engagement metrics", "Follower growth", "CSV export"],
    accent: "from-amber-500/20 to-pink-500/10",
  },
];

const PERSONAS = [
  {
    icon: Sparkles,
    title: "Solo creators",
    text: "Stay top-of-mind without spending your weekend writing posts.",
  },
  {
    icon: Users,
    title: "Small businesses",
    text: "Show up daily on every platform, even when nobody on your team is a marketer.",
  },
  {
    icon: Layers,
    title: "Agencies",
    text: "Manage every client brand in one workspace, with approvals and audit logs.",
  },
];

const COMPARE = [
  { feature: "AI captions written for you", kp: true, buffer: "Add-on", manual: false },
  { feature: "AI image generation built-in", kp: true, buffer: false, manual: false },
  { feature: "Multi-platform calendar", kp: true, buffer: true, manual: false },
  { feature: "Approval workflow + comments", kp: true, buffer: "Higher tier", manual: false },
  { feature: "Per-post analytics", kp: true, buffer: true, manual: false },
  { feature: "One subscription, no add-ons", kp: true, buffer: false, manual: true },
];

const FAQ = [
  {
    q: "Is there really a free trial?",
    a: "Yes. Every paid plan starts with a 7-day free trial. We collect a card so we can keep AI features bot-free, but you won't be charged until day 7 — and you can cancel anytime in one click from the billing portal.",
  },
  {
    q: "Which platforms do you support today?",
    a: "Facebook Pages, Instagram Business, and LinkedIn Pages. We're rolling out TikTok and X next based on customer demand.",
  },
  {
    q: "Will the AI sound like me, not a robot?",
    a: "You set a brand voice (Professional, Friendly, Witty, Bold, or Inspirational) plus optional brand keywords and banned phrases. Drafts come out tailored — and you can always edit before scheduling.",
  },
  {
    q: "What happens if I exceed my plan limits?",
    a: "We'll never silently bill you for overage. You'll see a clear upgrade prompt, and new scheduling pauses on that resource until you upgrade or the next cycle starts.",
  },
  {
    q: "Can my whole team use one workspace?",
    a: "Yes. Pro and Business include team seats with role-based permissions, threaded comments on drafts, and an approval workflow before anything goes live.",
  },
];

export default function LandingPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Decorative background */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-card border border-border text-primary text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            AI captions, AI images & auto-scheduling — in one tool
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.05] mb-6">
            Post daily on every platform
            <span className="block bg-gradient-to-r from-primary via-blue-600 to-indigo-500 bg-clip-text text-transparent pb-2">
              without lifting a finger.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            KonnectPilot writes, illustrates, schedules, and publishes platform-specific
            social media content for your brands — every single day, automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              Start 7-day free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center justify-center gap-2 border border-border bg-card text-foreground font-semibold px-6 py-3 rounded-lg hover:bg-secondary transition-colors"
            >
              See how it works
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground mb-12">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> 7-day free trial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> No charge until day 7
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime
            </span>
          </div>

          {/* Hero product visual */}
          <div className="max-w-5xl mx-auto px-2 sm:px-0">
            <ProductMockup />
          </div>
        </div>
      </section>

      {/* Trusted-by / platform integrations band */}
      <section className="border-y border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
            Publishes natively to
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-foreground/70">
            <div className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">Facebook</span>
            </div>
            <div className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              <span className="font-semibold">Instagram</span>
            </div>
            <div className="flex items-center gap-2">
              <Linkedin className="w-5 h-5 text-blue-700" />
              <span className="font-semibold">LinkedIn</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm">TikTok & X — coming soon</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            From blank calendar to a month of posts<br className="hidden sm:block" /> in one afternoon.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 relative">
          <div
            aria-hidden
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent"
          />
          {HOW_STEPS.map(({ icon: Icon, title, text }, i) => (
            <div
              key={title}
              className="relative bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all"
            >
              <div className="absolute -top-3 left-6 inline-flex items-center justify-center w-7 h-7 bg-foreground text-background text-xs font-bold rounded-full">
                {i + 1}
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-lg mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Three pillars */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              One tool. Three pillars.
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Stop juggling AI tools, schedulers, and analytics dashboards.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map(({ icon: Icon, title, text, bullets, accent }) => (
              <div
                key={title}
                className="relative bg-card border border-border rounded-2xl p-6 overflow-hidden group"
              >
                <div
                  aria-hidden
                  className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${accent} blur-2xl opacity-70 group-hover:opacity-100 transition-opacity`}
                />
                <div className="relative">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{text}</p>
                  <ul className="space-y-1.5">
                    {bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2 text-xs font-medium text-foreground/80"
                      >
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Explore every feature
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Personas */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
            Built for
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Anyone who needs to post — and doesn't have time to.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PERSONAS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-lg mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Why KonnectPilot
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              All-in-one, not bolt-on.
            </h2>
          </div>
          <div className="overflow-x-auto bg-card border border-border rounded-2xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-semibold text-foreground">Capability</th>
                  <th className="p-4 font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <KpMark className="w-4 h-4" color="currentColor" /> KonnectPilot
                    </span>
                  </th>
                  <th className="p-4 font-semibold text-foreground">Buffer-style tools</th>
                  <th className="p-4 font-semibold text-foreground">Doing it manually</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 1 ? "bg-secondary/30" : ""}>
                    <td className="p-4 text-foreground">{row.feature}</td>
                    <td className="p-4 text-center">
                      {row.kp === true ? (
                        <Check className="w-4 h-4 text-primary mx-auto" />
                      ) : (
                        <span className="text-sm">{row.kp}</span>
                      )}
                    </td>
                    <td className="p-4 text-center text-muted-foreground">
                      {row.buffer === true ? (
                        <Check className="w-4 h-4 text-foreground/50 mx-auto" />
                      ) : row.buffer === false ? (
                        <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                      ) : (
                        <span className="text-xs">{row.buffer}</span>
                      )}
                    </td>
                    <td className="p-4 text-center text-muted-foreground">
                      {row.manual === true ? (
                        <Check className="w-4 h-4 text-foreground/50 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">
            Simple, honest pricing.
          </h2>
          <p className="text-muted-foreground">
            7-day free trial on every plan. No charge until day 7. Cancel anytime.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card border rounded-2xl p-6 transition-all ${
                plan.popular
                  ? "border-primary shadow-xl ring-1 ring-primary/20 md:-translate-y-2"
                  : "border-border hover:border-primary/30"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                    Most popular
                  </span>
                </div>
              )}
              <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4 min-h-[2.5rem]">{plan.blurb}</p>
              <div className="mb-5">
                <span className="text-4xl font-bold text-foreground">
                  ${priceFor(plan, "monthly")}
                </span>
                <span className="text-muted-foreground">/mo</span>
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
                {plan.features.slice(0, 5).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            See full feature comparison
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: "Encrypted at rest",
              text: "Social tokens are encrypted; per-workspace isolation enforced everywhere.",
            },
            {
              icon: ShieldCheck,
              title: "GDPR-friendly",
              text: "One-click data export and account deletion. No data sold, ever.",
            },
            {
              icon: Star,
              title: "Honest pricing",
              text: "No silent overages, no surprise upsells. Cancel from one button.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Answers, before you ask.
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="bg-card border border-border rounded-xl p-5 group open:shadow-md transition-shadow"
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

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="relative bg-gradient-to-br from-primary via-blue-600 to-indigo-600 rounded-3xl px-8 py-14 text-center overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%),radial-gradient(circle_at_70%_80%,white,transparent_50%)]"
          />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4 tracking-tight">
              Your social calendar, on autopilot.
            </h2>
            <p className="text-primary-foreground/85 mb-8 max-w-lg mx-auto">
              Try KonnectPilot free for 7 days. Plan a month of content in one afternoon and
              never stare at an empty composer again.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg hover:bg-white/90 transition-colors shadow-md"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
              >
                See pricing
              </Link>
            </div>
            <p className="text-primary-foreground/70 text-xs mt-5">
              No charge until day 7 · Cancel anytime · Card required
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
