import MarketingShell from "@/components/marketing-shell";
import { Link } from "wouter";
import {
  Bot, Calendar, Image as ImageIcon, BarChart3, Users, Shield,
  Sparkles, Layers, Zap, ArrowRight, Check,
} from "lucide-react";

const PILLARS = [
  {
    icon: Sparkles,
    title: "AI Create",
    blurb: "Captions, hashtags, and on-brand images generated in seconds.",
    bullets: [
      "GPT-4 captions in 5 tones (Professional, Friendly, Witty, Bold, Inspirational)",
      "AI image generation per brand color & style",
      "Hashtag suggestions tuned to platform & audience",
      "Per-platform overrides — one post, perfect everywhere",
    ],
  },
  {
    icon: Calendar,
    title: "Schedule",
    blurb: "Plan a month in an afternoon. Queue, calendar, and multi-schedule.",
    bullets: [
      "Monthly + weekly calendar view",
      "Recurring queue slots per account",
      "Multi-schedule: fan one post out to many accounts at many times",
      "Timezone-aware scheduling",
    ],
  },
  {
    icon: BarChart3,
    title: "Analyze",
    blurb: "Know what works. Stop guessing what to post next.",
    bullets: [
      "Per-post impressions, reach, likes, comments, shares",
      "Per-account follower growth & engagement",
      "Workspace overview with growth trends",
      "Export to CSV",
    ],
  },
];

const FEATURES = [
  { icon: Bot, title: "AI captions & images", text: "ChatGPT for words, AI image gen for visuals — built into the composer." },
  { icon: Calendar, title: "Visual calendar", text: "Drag-and-drop monthly grid. See your whole month at a glance." },
  { icon: Layers, title: "Multi-schedule", text: "Send one post to many accounts at many times in a single action." },
  { icon: ImageIcon, title: "Content library", text: "Reusable assets, AI generations, and templates in one place." },
  { icon: Users, title: "Team collaboration", text: "Roles, approval workflow, and threaded comments on drafts." },
  { icon: Shield, title: "Built for trust", text: "Encrypted tokens, audit log, GDPR data export — agency-ready." },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" />
          Everything you need to grow
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight mb-5">
          One tool. Three pillars.<br />
          <span className="text-primary">Endless content.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          KonnectPilot brings AI creation, multi-platform scheduling, and real analytics into one polished workflow.
        </p>
      </section>

      {PILLARS.map(({ icon: Icon, title, blurb, bullets }, i) => (
        <section
          key={title}
          className={`py-16 ${i % 2 === 1 ? "bg-secondary/40" : ""}`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className={i % 2 === 1 ? "md:order-2" : ""}>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{title}</h2>
              <p className="text-muted-foreground mb-5">{blurb}</p>
              <ul className="space-y-2.5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`bg-card border border-border rounded-2xl shadow-sm aspect-[4/3] flex items-center justify-center ${i % 2 === 1 ? "md:order-1" : ""}`}>
              <Icon className="w-24 h-24 text-primary/20" />
            </div>
          </div>
        </section>
      ))}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
          Plus everything else you'd expect
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-5">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-primary rounded-2xl px-8 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3">
            Ready to fly on autopilot?
          </h2>
          <p className="text-primary-foreground/80 mb-6 max-w-lg mx-auto">
            Start your 7-day free trial. No charge until day 7. Cancel anytime.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg hover:bg-white/90 transition-colors"
          >
            Start free trial
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
