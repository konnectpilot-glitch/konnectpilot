import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  Hash,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";
import MarketingShell from "@/components/marketing-shell";

// Free in-browser hashtag generator. SEO target: "hashtag generator",
// "ai hashtag generator", "instagram hashtag generator for shopify".
//
// No backend call — we keep this as a pure heuristic so anonymous traffic
// doesn't burn AI budget. The output is good enough to rank and convert
// curious visitors into sign-ups, where the real (Claude-backed) generator
// lives inside the product.
//
// Logic: combine topic-derived tags + industry-vertical tags + platform-
// specific evergreen tags + size-tier tags (small/medium/large reach).

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram, max: 30, color: "text-pink-600" },
  { id: "facebook", label: "Facebook", icon: Facebook, max: 10, color: "text-blue-600" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, max: 8, color: "text-blue-700" },
] as const;

// Curated industry → vertical hashtag dictionary. These compound with the
// user's topic to produce niche-relevant suggestions.
const INDUSTRY_TAGS: Record<string, string[]> = {
  ecommerce: ["ecommerce", "shopify", "onlineshopping", "dtcbrand", "smallbusiness", "shopsmall"],
  fashion: ["fashion", "ootd", "style", "fashionista", "outfitinspo", "wearitloveit"],
  beauty: ["beauty", "skincare", "makeup", "skincareroutine", "beautyaddict", "cleanbeauty"],
  fitness: ["fitness", "workout", "fitfam", "fitspo", "gymlife", "healthylifestyle"],
  food: ["food", "foodie", "instafood", "foodphotography", "foodporn", "homecooking"],
  coffee: ["coffee", "coffeelover", "coffeetime", "specialtycoffee", "thirdwavecoffee", "baristalife"],
  tech: ["technology", "saas", "startup", "innovation", "buildinpublic", "tech"],
  marketing: ["marketing", "digitalmarketing", "contentmarketing", "marketingstrategy", "socialmediamarketing"],
  realestate: ["realestate", "realtor", "homebuying", "luxuryhomes", "househunting", "newhome"],
  fitness_coach: ["personaltrainer", "fitnesscoach", "transformationtuesday", "fitnessmotivation"],
  travel: ["travel", "wanderlust", "travelphotography", "explore", "instatravel", "passportlife"],
  finance: ["finance", "investing", "personalfinance", "financialfreedom", "wealthbuilding"],
  wellness: ["wellness", "selfcare", "mindfulness", "holistichealing", "wellnessjourney"],
};

// Platform-specific evergreen tags that work across most topics.
const PLATFORM_EVERGREEN: Record<string, string[]> = {
  instagram: ["instagood", "photooftheday", "instadaily", "love", "follow"],
  facebook: ["community", "smallbusiness", "supportlocal"],
  linkedin: ["leadership", "professionaldevelopment", "businessgrowth", "linkedintips"],
};

function detectIndustry(input: string): string {
  const lower = input.toLowerCase();
  for (const key of Object.keys(INDUSTRY_TAGS)) {
    if (lower.includes(key.replace("_", " ")) || lower.includes(key)) return key;
  }
  // Heuristic keyword detection
  if (/coffee|cafe|espresso|latte/.test(lower)) return "coffee";
  if (/skincare|makeup|cosmetic/.test(lower)) return "beauty";
  if (/gym|workout|fitness|trainer/.test(lower)) return "fitness";
  if (/food|recipe|cook|restaurant/.test(lower)) return "food";
  if (/shop|store|ecomm|product|dtc/.test(lower)) return "ecommerce";
  if (/saas|software|api|developer|app/.test(lower)) return "tech";
  if (/style|outfit|wear|fashion|cloth/.test(lower)) return "fashion";
  if (/travel|trip|vacation/.test(lower)) return "travel";
  return "ecommerce"; // safe default for our ICP
}

function topicToTags(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "for", "with", "your", "from", "this", "that"].includes(w))
    .map((w) => w.replace(/\s+/g, ""));
}

function generateHashtags(topic: string, industry: string, platform: string, max: number): string[] {
  const topicTags = topicToTags(topic);
  const industryTags = INDUSTRY_TAGS[industry] ?? INDUSTRY_TAGS.ecommerce;
  const evergreen = PLATFORM_EVERGREEN[platform] ?? [];

  // Build compound tags: topic + industry (e.g. "summer" + "fashion" → "summerfashion")
  // Skip pairs where either side is a substring of the other to avoid
  // ugly duplications like "coffeecoffee" or "summersummer".
  const compounds: string[] = [];
  for (const t of topicTags.slice(0, 3)) {
    for (const i of industryTags.slice(0, 3)) {
      if (t === i || t.includes(i) || i.includes(t)) continue;
      compounds.push(`${t}${i}`);
    }
  }

  // Dedupe + order by tier: niche compounds first (highest engagement on smaller
  // accounts), then topic, then industry, then evergreen.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...compounds, ...topicTags, ...industryTags, ...evergreen]) {
    const tag = t.replace(/[^a-z0-9]/g, "").toLowerCase();
    if (tag.length < 3 || tag.length > 30) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(`#${tag}`);
    if (out.length >= max) break;
  }
  return out;
}

export default function HashtagGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [industryHint, setIndustryHint] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "linkedin">("instagram");
  const [copied, setCopied] = useState(false);

  const platformCfg = PLATFORMS.find((p) => p.id === platform)!;
  const industry = useMemo(
    () => detectIndustry(industryHint || topic),
    [industryHint, topic],
  );
  const hashtags = useMemo(
    () => (topic.trim() ? generateHashtags(topic, industry, platform, platformCfg.max) : []),
    [topic, industry, platform, platformCfg.max],
  );

  function handleCopy() {
    if (!hashtags.length) return;
    navigator.clipboard.writeText(hashtags.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
            AI Hashtag Generator
          </h1>
          <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">
            Smart, platform-specific hashtags for Facebook, Instagram, and LinkedIn — tuned to your industry. Free, forever.
          </p>
        </div>
      </section>

      {/* Tool */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              What's your post about? <span className="text-destructive">*</span>
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. summer skincare routine for sensitive skin"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Industry <span className="text-muted-foreground font-normal">(optional — we'll guess)</span>
            </label>
            <input
              value={industryHint}
              onChange={(e) => setIndustryHint(e.target.value)}
              placeholder="e.g. beauty, ecommerce, fitness"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
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

        {hashtags.length > 0 && (
          <div className="mt-5 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {hashtags.length} hashtags for {platformCfg.label}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: paste these at the end of your caption — Instagram's algorithm rewards relevance over volume.
            </p>
          </div>
        )}
      </section>

      {/* Upsell — the lead-magnet payoff */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-background border border-primary/30 rounded-2xl p-8 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Want hashtags inside an actual post?
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
            KonnectPilot generates the caption, the image, and the hashtags — tuned to your brand voice — and schedules it to Facebook, Instagram, and LinkedIn at the same time. 7-day free trial, no card surprises.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            Try the full product free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Or check the <Link href="/tools/best-time-to-post" className="text-primary hover:underline">best time to post calculator</Link>.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
