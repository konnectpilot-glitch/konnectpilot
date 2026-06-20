import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useCreateBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useWorkspace } from "@/lib/workspaceContext";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import {
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  Building2,
  Link2,
  Send,
  Facebook,
  Instagram,
  Linkedin,
  Wand2,
} from "lucide-react";

/**
 * Three-step onboarding wizard shown to first-time users (zero brands).
 *
 * Step 1 — Brand basics: name + website URL. Minimal friction; the long
 *           "describe your brand voice" form lives on the full brand-edit
 *           page and is hidden behind progressive disclosure.
 * Step 2 — Connect social accounts: deep-links to /accounts so the user
 *           can run the FB+IG and LinkedIn OAuth flows. We keep the wizard
 *           visible in a new tab/window mental model — they come back to
 *           click "Done" once at least one platform is connected.
 * Step 3 — Generate first post: CTA into /generate?brandId=… so they hit
 *           the AI "wow" moment within seconds of finishing onboarding.
 *
 * Dismissable, but persists the dismissal in localStorage so we don't pester
 * users who deliberately closed it (the audit's "rage-quit before aha-moment"
 * problem is what this fixes).
 */
const DISMISS_KEY = "konnectpilot:onboarding:dismissed";

export function shouldShowOnboarding(brandsCount: number): boolean {
  if (typeof window === "undefined") return false;
  if (brandsCount > 0) return false;
  if (localStorage.getItem(DISMISS_KEY) === "1") return false;
  return true;
}

export default function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  // Voice + audience get filled by auto-extract; we don't show them as inputs
  // in the wizard (keep step 1 minimal) but pass them through to create-brand.
  const [autoVoice, setAutoVoice] = useState("");
  const [autoAudience, setAutoAudience] = useState("");
  const [autoKeywords, setAutoKeywords] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [newBrandId, setNewBrandId] = useState<number | null>(null);
  const createBrand = useCreateBrand();
  const qc = useQueryClient();

  async function handleAutoFill() {
    const raw = website.trim();
    if (!raw) {
      toast.error("Paste your website URL first");
      return;
    }
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setExtracting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/brands/extract", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
        },
        body: JSON.stringify({ url: normalized }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `Couldn't read that page (${res.status})`);
      }
      const data = await res.json();
      if (data.name) setName(data.name);
      if (data.industry) setIndustry(data.industry);
      if (data.voice) setAutoVoice(data.voice);
      if (data.targetAudience) setAutoAudience(data.targetAudience);
      if (data.keywords) setAutoKeywords(data.keywords);
      setWebsite(normalized);
      toast.success("Filled from your site — looks good?");
    } catch (err: any) {
      toast.error(friendlyError(err, "Couldn't read that page — try a different URL or fill in manually."));
    } finally {
      setExtracting(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    onClose();
  }

  // Escape-to-close — standard modal a11y. Captures on document so it works
  // even when focus is inside an input within the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateBrand() {
    if (!name.trim() || !industry.trim()) {
      toast.error("Brand name and industry are required");
      return;
    }
    createBrand.mutate(
      {
        data: {
          name: name.trim(),
          industry: industry.trim(),
          tone: "friendly",
          // Prefer AI-extracted values if the user used Auto-fill — they're
          // far better than the generic placeholders we'd otherwise send.
          targetAudience: autoAudience.trim() || "Customers who care about quality and value",
          keywords: autoKeywords.trim() || industry.trim(),
          voiceDescription: autoVoice.trim() || null,
          websiteUrl: website.trim() || null,
        } as any,
      },
      {
        onSuccess: (b: any) => {
          qc.invalidateQueries({ queryKey: getListBrandsQueryKey() });
          setNewBrandId(b?.id ?? null);
          setStep(2);
          toast.success(`Created ${name}`);
        },
        onError: (err: any) => toast.error(friendlyError(err, "Couldn't create the brand. Please try again.")),
      }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-br from-primary/10 to-purple-500/10 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Welcome to KonnectPilot
            </span>
          </div>
          <h2 id="onboarding-wizard-title" className="text-xl font-bold text-foreground">Let's get your first post live in 3 steps</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We'll set up your brand, connect a social account, and have AI write your first post — together it takes about 2 minutes.
          </p>
          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    step > n
                      ? "bg-primary text-primary-foreground"
                      : step === n
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {step > n ? <Check className="w-3.5 h-3.5" /> : n}
                </div>
                {n < 3 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full ${
                      step > n ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-foreground" />
                  <h3 className="font-semibold text-foreground">Tell us about your brand</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Just the basics. You can refine the voice later — the AI also learns from every post you approve.
                </p>
              </div>
              {/* Auto-fill: the fastest path. Most ecommerce sellers already
                  have a public site, and reading it gives the AI a way more
                  useful prior than whatever they type in two minutes. */}
              <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">Fastest setup — auto-fill from your website</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!extracting) handleAutoFill();
                      }
                    }}
                    placeholder="yourstore.com"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    disabled={extracting}
                  />
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={extracting || !website.trim()}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
                  >
                    {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {extracting ? "Reading…" : "Auto-fill"}
                  </button>
                </div>
                {autoVoice && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Voice + audience + keywords pulled — review fields below
                  </p>
                )}
              </div>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground uppercase tracking-wider">or fill manually</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Brand name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ClicknKonnect"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Industry *</label>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. E-commerce training, DTC skincare, SaaS"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={dismiss}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip onboarding
                </button>
                <button
                  onClick={handleCreateBrand}
                  disabled={createBrand.isPending}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {createBrand.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Create brand & continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Link2 className="w-4 h-4 text-foreground" />
                  <h3 className="font-semibold text-foreground">Connect your social accounts</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  KonnectPilot publishes directly to your accounts. Connect at least one to continue — you can add more later.
                </p>
              </div>
              <div className="grid gap-2">
                <PlatformCard icon={<Facebook className="w-5 h-5 text-blue-600" />} title="Facebook + Instagram" subtitle="Connect Pages + linked IG Business in one flow" />
                <PlatformCard icon={<Linkedin className="w-5 h-5 text-blue-700" />} title="LinkedIn" subtitle="Post to your profile (Company Pages coming soon)" />
              </div>
              <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground">
                💡 Tip: opens in a new tab. Come back here when done and click "I've connected my accounts".
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
                <div className="flex gap-2">
                  <a
                    href="/accounts"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary"
                  >
                    Open Social Accounts
                  </a>
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
                  >
                    I've connected my accounts <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-foreground" />
                  <h3 className="font-semibold text-foreground">You're ready — let's make your first post</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  We'll take you to the Generate page with your brand pre-selected. The AI will write a draft for Facebook, Instagram, and LinkedIn in one click.
                </p>
              </div>
              <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-lg p-4 border border-primary/20">
                <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">What happens next</p>
                <ol className="text-sm text-foreground space-y-1.5 list-decimal list-inside">
                  <li>Pick a topic (or leave blank — AI will choose one for your brand)</li>
                  <li>AI generates a platform-specific draft for each social account</li>
                  <li>Hit <strong>Publish</strong>, <strong>Schedule</strong>, or <strong>Send to approval</strong></li>
                </ol>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    dismiss();
                    setLocation(newBrandId ? `/generate?brandId=${newBrandId}` : "/generate");
                  }}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
                >
                  <Send className="w-4 h-4" />
                  Generate my first post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
