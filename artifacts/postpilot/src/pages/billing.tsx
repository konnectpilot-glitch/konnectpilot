import Layout from "@/components/layout";
import {
  useListPlans,
  useCreateCheckoutSession,
  useCreatePortalSession,
  useGetMyUsage,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import {
  Check,
  Loader2,
  ExternalLink,
  CreditCard,
  Zap,
  Gift,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { TOP_UPS, ADD_ONS, CREDIT_RULES } from "@/lib/plans";

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export default function BillingPage() {
  const { user } = useUser();
  const { data: plans, isLoading } = useListPlans();
  const { data: usage } = useGetMyUsage();
  const createCheckout = useCreateCheckoutSession();
  const createPortal = useCreatePortalSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingTopup, setLoadingTopup] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const currentPlan = (user?.publicMetadata?.plan as string) ?? "free";

  async function handleSubscribe(planId: string) {
    setLoadingPlan(planId);
    const origin = window.location.origin;
    createCheckout.mutate(
      {
        data: {
          planId,
          successUrl: `${origin}${basePath}/billing?success=1`,
          cancelUrl: `${origin}${basePath}/billing`,
        },
      },
      {
        onSuccess: (data) => {
          if (data.url) window.location.href = data.url;
        },
        onError: (err: any) => toast.error(err?.data?.error ?? "Failed to start checkout"),
        onSettled: () => setLoadingPlan(null),
      },
    );
  }

  async function handleTopup(topupId: string) {
    setLoadingTopup(topupId);
    const origin = window.location.origin;
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topupId,
          successUrl: `${origin}${basePath}/billing?topup=1`,
          cancelUrl: `${origin}${basePath}/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start top-up checkout");
    } finally {
      setLoadingTopup(null);
    }
  }

  async function handlePortal() {
    setLoadingPortal(true);
    createPortal.mutate(undefined as any, {
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      },
      onError: (err: any) => toast.error(err?.data?.error ?? "Failed to open billing portal"),
      onSettled: () => setLoadingPortal(false),
    });
  }

  const used = usage?.creditsUsed ?? 0;
  const limit = usage?.creditsLimit ?? 0;
  const bonus = usage?.bonusCredits ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your KonnectPilot subscription and credits
          </p>
        </div>

        {/* Current plan + usage */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Current plan</h2>
                </div>
                <p className="text-2xl font-bold text-foreground capitalize mt-1">
                  {currentPlan === "free" ? "Free" : currentPlan}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentPlan === "free"
                    ? "Upgrade to unlock more brands and credits"
                    : "Your subscription is active"}
                </p>
              </div>
              {currentPlan !== "free" && (
                <button
                  onClick={handlePortal}
                  disabled={loadingPortal}
                  className="flex items-center gap-1.5 text-sm font-medium border border-border px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  {loadingPortal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage
                </button>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Credits this month</h2>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold text-foreground">
                {fmt(used)}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / {limit}
                </span>
              </span>
              {bonus > 0 && (
                <span className="text-xs flex items-center gap-1 text-primary font-medium">
                  <Gift className="w-3.5 h-3.5" /> +{fmt(bonus)} top-up
                </span>
              )}
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="font-semibold text-foreground mb-4">Choose a plan</h2>
          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-6 animate-pulse"
                >
                  <div className="h-5 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-8 bg-muted rounded w-1/2 mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-3 bg-muted rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {plans?.map((plan) => {
                const isCurrent = currentPlan === plan.id;
                const isPopular = plan.popular ?? false;
                const order = ["free", "starter", "pro", "agency"];
                const planIdx = order.indexOf(plan.id);
                const currIdx = order.indexOf(currentPlan);
                const isDowngrade = currIdx > -1 && planIdx < currIdx;
                const ctaLabel = isCurrent
                  ? "Current plan"
                  : currentPlan === "free" || currIdx === -1
                  ? "Start 7-day free trial"
                  : isDowngrade
                  ? "Downgrade"
                  : "Upgrade";
                return (
                  <div
                    key={plan.id}
                    className={`relative bg-card border rounded-xl p-6 flex flex-col ${
                      isPopular ? "border-primary ring-1 ring-primary/20" : "border-border"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                          Most popular
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <ul className="space-y-2 flex-1 mb-5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => !isCurrent && handleSubscribe(plan.id)}
                      disabled={loadingPlan === plan.id || isCurrent}
                      className={`w-full flex items-center justify-center gap-2 font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm ${
                        isCurrent
                          ? "border border-border text-muted-foreground cursor-default"
                          : isPopular
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-border text-foreground hover:bg-secondary"
                      } disabled:opacity-60`}
                    >
                      {loadingPlan === plan.id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {ctaLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top-up packs */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Need more credits?</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Top-ups are one-time purchases that roll over month to month.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {TOP_UPS.map((t) => (
              <div
                key={t.id}
                className="bg-card border border-border rounded-xl p-4 flex flex-col"
              >
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold text-foreground">{t.credits}</span>
                  <span className="text-sm text-muted-foreground">credits</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  ${t.priceUsd} one-time
                </p>
                <button
                  onClick={() => handleTopup(t.id)}
                  disabled={loadingTopup === t.id || currentPlan === "free"}
                  className="w-full mt-auto flex items-center justify-center gap-2 border border-border text-foreground font-medium px-3 py-2 rounded-lg hover:bg-secondary text-sm disabled:opacity-60"
                  title={currentPlan === "free" ? "Subscribe to a plan first" : ""}
                >
                  {loadingTopup === t.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  Buy ${t.priceUsd}
                </button>
              </div>
            ))}
          </div>
          {currentPlan === "free" && (
            <p className="text-xs text-muted-foreground mt-2">
              Subscribe to a plan first to purchase credit top-ups.
            </p>
          )}
        </div>

        {/* Add-ons */}
        <div>
          <h2 className="font-semibold text-foreground mb-3">Optional add-ons</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {ADD_ONS.map((a) => (
              <div
                key={a.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
                <span className="font-semibold text-foreground">${a.priceUsd}/mo</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Manage add-ons from the Stripe customer portal.
          </p>
        </div>

        {/* Credit rules */}
        <div className="bg-secondary/40 border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-2">How credits work</h3>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-foreground">
            {CREDIT_RULES.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Secure payments powered by Stripe. Cancel anytime. No hidden fees.
        </p>
      </div>
    </Layout>
  );
}
