import { Link } from "wouter";
import { useState } from "react";
import {
  Clock,
  ArrowRight,
  Sparkles,
  Instagram,
  Facebook,
  Linkedin,
  Calendar,
} from "lucide-react";
import MarketingShell from "@/components/marketing-shell";

// Free in-browser "best time to post" calculator. SEO target:
// "best time to post on instagram for ecommerce", "best time to post on
// linkedin", "shopify social media schedule".
//
// Research-backed defaults from publicly-published Sprout Social, Buffer,
// and HubSpot studies (2024-2025). We update these by industry/platform and
// surface them by the user's selected timezone. No backend needed.

interface TimeWindow {
  day: string;
  range: string;
  rationale: string;
}

interface RecommendationSet {
  industry: string;
  platform: "instagram" | "facebook" | "linkedin";
  windows: TimeWindow[];
  source: string;
}

// All times in the USER'S local timezone. We assume the audience and the
// account holder are in the same region — the audit's US-focused ICP makes
// this a safe simplification.
const RECOMMENDATIONS: RecommendationSet[] = [
  // ECOMMERCE / DTC
  { industry: "ecommerce", platform: "instagram", source: "Sprout Social 2025 ecom benchmarks", windows: [
    { day: "Mon–Wed", range: "11 AM – 1 PM", rationale: "Lunch-break scroll, highest add-to-cart intent" },
    { day: "Thursday", range: "10 AM – 12 PM", rationale: "Pre-weekend planning window" },
    { day: "Saturday", range: "9 AM – 11 AM", rationale: "Weekend leisure browsing" },
  ]},
  { industry: "ecommerce", platform: "facebook", source: "Sprout Social 2025 ecom benchmarks", windows: [
    { day: "Tue–Thu", range: "9 AM – 11 AM", rationale: "Morning routine + organic reach peak" },
    { day: "Friday", range: "1 PM – 3 PM", rationale: "Weekend pre-shopping mood" },
    { day: "Sunday", range: "8 PM – 10 PM", rationale: "Wind-down shopping browse" },
  ]},
  { industry: "ecommerce", platform: "linkedin", source: "Hootsuite 2025 B2B post timings", windows: [
    { day: "Tue–Thu", range: "8 AM – 10 AM", rationale: "Pre-meeting feed scroll" },
    { day: "Tue–Thu", range: "12 PM – 1 PM", rationale: "Lunch break" },
  ]},
  // FITNESS
  { industry: "fitness", platform: "instagram", source: "Later 2025 fitness creator data", windows: [
    { day: "Mon–Fri", range: "5 AM – 7 AM", rationale: "Pre-workout motivation scroll" },
    { day: "Mon–Fri", range: "6 PM – 8 PM", rationale: "Post-work gym session window" },
    { day: "Saturday", range: "8 AM – 10 AM", rationale: "Weekend morning routine" },
  ]},
  { industry: "fitness", platform: "facebook", source: "Later 2025 fitness creator data", windows: [
    { day: "Tue–Thu", range: "6 AM – 8 AM", rationale: "Early-bird community engagement" },
    { day: "Sunday", range: "7 PM – 9 PM", rationale: "Weekly planning + accountability posts" },
  ]},
  { industry: "fitness", platform: "linkedin", source: "Hootsuite 2025 B2B", windows: [
    { day: "Tue–Thu", range: "8 AM – 10 AM", rationale: "Wellness-at-work content slot" },
  ]},
  // FOOD / RESTAURANT
  { industry: "food", platform: "instagram", source: "HubSpot 2024 food vertical", windows: [
    { day: "Wed–Fri", range: "11 AM – 1 PM", rationale: "Lunch decision-making window" },
    { day: "Wed–Fri", range: "5 PM – 7 PM", rationale: "Dinner-planning scroll" },
    { day: "Saturday", range: "10 AM – 12 PM", rationale: "Weekend brunch planning" },
  ]},
  { industry: "food", platform: "facebook", source: "HubSpot 2024 food vertical", windows: [
    { day: "Friday", range: "4 PM – 6 PM", rationale: "Date-night decision window" },
    { day: "Sunday", range: "11 AM – 1 PM", rationale: "Weekly meal-plan inspo" },
  ]},
  { industry: "food", platform: "linkedin", source: "Manual heuristic for B2B food/CPG", windows: [
    { day: "Tue–Thu", range: "9 AM – 11 AM", rationale: "Industry-news-reading slot" },
  ]},
  // BEAUTY / SKINCARE
  { industry: "beauty", platform: "instagram", source: "Later 2025 beauty creator data", windows: [
    { day: "Mon–Wed", range: "12 PM – 2 PM", rationale: "Lunch-break inspiration scroll" },
    { day: "Thursday", range: "7 PM – 9 PM", rationale: "Pre-weekend prep window" },
    { day: "Sunday", range: "8 PM – 10 PM", rationale: "Sunday skincare-routine peak" },
  ]},
  { industry: "beauty", platform: "facebook", source: "Later 2025 beauty creator data", windows: [
    { day: "Wednesday", range: "10 AM – 12 PM", rationale: "Mid-week purchase consideration" },
    { day: "Saturday", range: "9 AM – 11 AM", rationale: "Weekend research + buy window" },
  ]},
  { industry: "beauty", platform: "linkedin", source: "Hootsuite 2025 B2B", windows: [
    { day: "Tue–Thu", range: "8 AM – 10 AM", rationale: "Industry-news / employer-brand window" },
  ]},
  // FASHION
  { industry: "fashion", platform: "instagram", source: "Later 2025 fashion creator data", windows: [
    { day: "Mon–Wed", range: "12 PM – 2 PM", rationale: "Outfit inspiration peak" },
    { day: "Friday", range: "5 PM – 7 PM", rationale: "Weekend-outfit planning" },
    { day: "Sunday", range: "7 PM – 9 PM", rationale: "Week-ahead capsule planning" },
  ]},
  { industry: "fashion", platform: "facebook", source: "Buffer 2024 fashion data", windows: [
    { day: "Thursday", range: "1 PM – 3 PM", rationale: "Pre-weekend retail-therapy mood" },
  ]},
  { industry: "fashion", platform: "linkedin", source: "Hootsuite 2025 B2B", windows: [
    { day: "Tue–Thu", range: "8 AM – 10 AM", rationale: "Industry-news / brand-thought-leadership slot" },
  ]},
  // SAAS / TECH
  { industry: "saas", platform: "linkedin", source: "Sprout Social 2025 B2B", windows: [
    { day: "Tue–Thu", range: "7 AM – 9 AM", rationale: "Pre-standup feed scroll, highest exec engagement" },
    { day: "Tue–Thu", range: "12 PM – 1 PM", rationale: "Lunch-break professional content peak" },
    { day: "Wednesday", range: "5 PM – 6 PM", rationale: "End-of-day reflection / sharing window" },
  ]},
  { industry: "saas", platform: "instagram", source: "Sprout Social 2025 B2B", windows: [
    { day: "Tue–Thu", range: "11 AM – 1 PM", rationale: "Team-culture + product-update lunch window" },
  ]},
  { industry: "saas", platform: "facebook", source: "Sprout Social 2025 B2B", windows: [
    { day: "Wednesday", range: "9 AM – 11 AM", rationale: "Industry-news + organic reach window" },
  ]},
];

const INDUSTRIES = ["ecommerce", "fitness", "food", "beauty", "fashion", "saas"] as const;
type Industry = (typeof INDUSTRIES)[number];

const INDUSTRY_LABELS: Record<Industry, string> = {
  ecommerce: "E-commerce / DTC",
  fitness: "Fitness / Wellness",
  food: "Food / Restaurant",
  beauty: "Beauty / Skincare",
  fashion: "Fashion / Apparel",
  saas: "SaaS / Tech / B2B",
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-600" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
] as const;

export default function BestTimeToPostPage() {
  const [industry, setIndustry] = useState<Industry>("ecommerce");
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "linkedin">("instagram");

  const rec = RECOMMENDATIONS.find((r) => r.industry === industry && r.platform === platform);

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
            Free tool · No sign-up required
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight mb-4">
            Best time to post calculator
          </h1>
          <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">
            Research-backed posting windows for Facebook, Instagram, and LinkedIn — by industry. Updated for 2025.
          </p>
        </div>
      </section>

      {/* Selectors */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Industry</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INDUSTRIES.map((id) => (
                <button
                  key={id}
                  onClick={() => setIndustry(id)}
                  className={`text-sm font-medium border rounded-lg px-3 py-2 transition-colors ${
                    industry === id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {INDUSTRY_LABELS[id]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setPlatform(id)}
                  className={`flex items-center justify-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    platform === id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${color}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recommendation panel */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">
        {rec && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Recommended windows for {INDUSTRY_LABELS[industry]} on {PLATFORMS.find(p => p.id === platform)!.label}
              </span>
            </div>
            <div className="space-y-3">
              {rec.windows.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{w.day}</span>
                      <span className="text-primary font-mono font-semibold text-sm">{w.range}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{w.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 italic">
              Times are in your local timezone. Source: {rec.source}.
            </p>
          </div>
        )}
      </section>

      {/* Upsell */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-background border border-primary/30 rounded-2xl p-8 text-center">
          <Calendar className="w-8 h-8 text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Don't just know the times — auto-schedule into them.
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
            KonnectPilot generates platform-tuned posts and auto-schedules them into the best windows for your industry — every week, on autopilot. 7-day free trial.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            Try the full product free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Or grab some <Link href="/tools/hashtag-generator" className="text-primary hover:underline">free AI hashtags</Link>.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
