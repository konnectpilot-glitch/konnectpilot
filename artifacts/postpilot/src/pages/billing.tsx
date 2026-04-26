import Layout from "@/components/layout";
import { useListPlans, useCreateCheckoutSession, useCreatePortalSession } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Check, Loader2, ExternalLink, CreditCard, Zap } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function BillingPage() {
  const { user } = useUser();
  const { data: plans, isLoading } = useListPlans();
  const createCheckout = useCreateCheckoutSession();
  const createPortal = useCreatePortalSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
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
      }
    );
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

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your PostPilot subscription</p>
        </div>

        {/* Current plan card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Current Plan</h2>
              </div>
              <p className="text-2xl font-bold text-foreground capitalize mt-1">
                {currentPlan === "free" ? "Free" : currentPlan}
              </p>
              {currentPlan === "free" ? (
                <p className="text-sm text-muted-foreground mt-1">Upgrade to unlock more brands and features</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Your subscription is active</p>
              )}
            </div>
            {currentPlan !== "free" && (
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="flex items-center gap-1.5 text-sm font-medium border border-border px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
              >
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage subscription
              </button>
            )}
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="font-semibold text-foreground mb-4">Choose a Plan</h2>
          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
                  <div className="h-5 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-8 bg-muted rounded w-1/2 mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(j => <div key={j} className="h-3 bg-muted rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {plans?.map((plan, i) => {
                const isCurrent = currentPlan === plan.id;
                const isPopular = i === 1;
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
                      {loadingPlan === plan.id && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isCurrent ? "Current plan" : "Upgrade"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Powered by Stripe note */}
        <p className="text-xs text-muted-foreground text-center">
          Secure payments powered by Stripe. Cancel anytime. No hidden fees.
        </p>
      </div>
    </Layout>
  );
}
