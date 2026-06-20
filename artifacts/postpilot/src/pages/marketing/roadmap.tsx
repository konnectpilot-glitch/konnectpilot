import { Link } from "wouter";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Clock,
  Brain,
  ShoppingBag,
  Smartphone,
  Globe,
  Zap,
  MessageSquare,
  BarChart3,
  Image as ImageIcon,
  Mail,
  Pin,
  Music,
  type LucideIcon,
} from "lucide-react";
import MarketingShell from "@/components/marketing-shell";

// Public roadmap page. Linear / Vercel / Beehiiv-style 3-column layout
// (Shipped / In progress / Planned) with concrete items, icons, and short
// descriptions. Three goals:
//   1. Premium SaaS signal — sophisticated B2B buyers expect a public roadmap.
//   2. Distribution lever — "vote for what we build next" implicit invitation
//      builds list of engaged early customers.
//   3. Sales objection handler — when prospects ask "do you have X?", the
//      answer is now "yes, it ships in Q3, here's the plan".
//
// Items are hardcoded for v1. Once we have 50+ items we'd back this with a
// CMS or a /roadmap.json file.

type Status = "shipped" | "in_progress" | "planned";
interface Item {
  status: Status;
  title: string;
  description: string;
  icon: LucideIcon;
  // Optional rough timing — only used for in_progress / planned.
  eta?: string;
}

const ROADMAP: Item[] = [
  // Shipped — most recent first
  {
    status: "shipped",
    title: "AI image variants",
    description: "Generate 3 distinct image options per request, pick the best. Different angles, lighting, mood — never re-rolls of the same composition.",
    icon: ImageIcon,
  },
  {
    status: "shipped",
    title: "Caption hook variants",
    description: "Get 3 caption alternatives in different hook archetypes (contrarian, story-tease, stat) for any platform.",
    icon: Sparkles,
  },
  {
    status: "shipped",
    title: "AI brand memory + performance loop",
    description: "Every approval, edit, and published-post analytic flows back as future context. The AI gets sharper every week.",
    icon: Brain,
  },
  {
    status: "shipped",
    title: "Multi-platform generate",
    description: "One click writes platform-specific drafts for Facebook, Instagram, and LinkedIn at the same time.",
    icon: Zap,
  },
  {
    status: "shipped",
    title: "Brand voice auto-extract from URL",
    description: "Paste your store URL — we infer brand name, industry, audience, voice, and keywords in 10 seconds.",
    icon: Globe,
  },
  {
    status: "shipped",
    title: "AI comment reply drafter",
    description: "Paste a comment from any of your posts — AI drafts three brand-voice replies in different tones.",
    icon: MessageSquare,
  },
  {
    status: "shipped",
    title: "Brand Intelligence panel",
    description: "Per-brand dashboard showing what KonnectPilot has learned: approved samples, distilled guidelines, top hooks, recent signals.",
    icon: BarChart3,
  },

  // In progress
  {
    status: "in_progress",
    title: "Shopify App Store listing",
    description: "Native install from the Shopify App Store. Auto-imports your products, voice, and brand colors on first sync.",
    icon: ShoppingBag,
    eta: "Q2 2026",
  },
  {
    status: "in_progress",
    title: "Real comment inbox",
    description: "Auto-fetch comments from your Facebook + Instagram + LinkedIn posts. Surface them in an inbox with AI-drafted replies waiting for your approval.",
    icon: MessageSquare,
    eta: "Q2 2026",
  },
  {
    status: "in_progress",
    title: "Bulk monthly content wizard",
    description: "Generate a month of platform-specific posts in one click. Content pillars + AI variation produce 30 unique, on-brand posts.",
    icon: Zap,
    eta: "Q2 2026",
  },

  // Planned
  {
    status: "planned",
    title: "Pinterest publishing",
    description: "Native publishing to Pinterest boards. Huge US DTC channel — especially for product brands.",
    icon: Pin,
    eta: "Q3 2026",
  },
  {
    status: "planned",
    title: "TikTok integration",
    description: "Schedule and post videos to TikTok directly. AI-generated hooks tuned to TikTok's vertical, fast-cut format.",
    icon: Music,
    eta: "Q3 2026",
  },
  {
    status: "planned",
    title: "AI email campaigns",
    description: "Same brand-memory engine, but for transactional and broadcast emails. Resend-powered, brand-voice tuned.",
    icon: Mail,
    eta: "Q3 2026",
  },
  {
    status: "planned",
    title: "Post performance prediction",
    description: "Before you publish, the AI predicts likely engagement based on your brand's past performance memory.",
    icon: BarChart3,
    eta: "Q3 2026",
  },
  {
    status: "planned",
    title: "PWA / mobile app",
    description: "Approve drafts, review comments, and check analytics from your phone — without a separate native app.",
    icon: Smartphone,
    eta: "Q4 2026",
  },
];

// Dark-mode-aware column headers.
const STATUS_META: Record<Status, { label: string; icon: LucideIcon; tint: string }> = {
  shipped: { label: "Shipped", icon: CheckCircle2, tint: "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15" },
  in_progress: { label: "In progress", icon: Loader2, tint: "text-primary bg-primary/10" },
  planned: { label: "Planned", icon: Clock, tint: "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15" },
};

function Column({ status, items }: { status: Status; items: Item[] }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3 border-b border-border ${meta.tint}`}>
        <Icon className={`w-4 h-4 ${status === "in_progress" ? "animate-spin" : ""}`} />
        <span className="text-sm font-semibold uppercase tracking-wider">{meta.label}</span>
        <span className="ml-auto text-xs font-medium">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={i} className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                  {item.eta && (
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{item.eta}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const shipped = ROADMAP.filter((r) => r.status === "shipped");
  const inProgress = ROADMAP.filter((r) => r.status === "in_progress");
  const planned = ROADMAP.filter((r) => r.status === "planned");

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-card border border-border text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            We ship weekly
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight mb-3">
            Roadmap
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            What we've shipped, what's in flight, and what's next. Want to vote on what we build next? Drop us a note —{" "}
            <a href="mailto:hello@konnectpilot.com" className="text-primary hover:underline">hello@konnectpilot.com</a>.
          </p>
        </div>
      </section>

      {/* Columns */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid lg:grid-cols-3 gap-6">
          <Column status="shipped" items={shipped} />
          <Column status="in_progress" items={inProgress} />
          <Column status="planned" items={planned} />
        </div>
      </section>

      {/* Process note */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-2">How we pick what to build</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Three filters, in this order:
          </p>
          <ol className="text-sm text-foreground space-y-1.5 list-decimal list-inside">
            <li>What our paying customers ask for most often.</li>
            <li>What unblocks new customers from saying yes (the "I'd use this if it had X" objection).</li>
            <li>What sharpens the AI brand-memory loop — the one moat we can't be matched on.</li>
          </ol>
          <p className="text-sm text-muted-foreground leading-relaxed mt-4">
            We deliberately don't try to match competitor features one-for-one. We'd rather have three things that work perfectly than thirty that work OK.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="relative bg-gradient-to-br from-primary via-blue-600 to-indigo-600 rounded-3xl px-8 py-12 text-center overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%),radial-gradient(circle_at_70%_80%,white,transparent_50%)]"
          />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3 tracking-tight">
              Try the shipped half right now.
            </h2>
            <p className="text-primary-foreground/85 mb-7 max-w-lg mx-auto text-sm">
              Free 7-day trial. Everything in the "Shipped" column above is yours immediately.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg hover:bg-white/90 transition-colors shadow-md"
            >
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
