import Layout from "@/components/layout";
import { useState, useEffect } from "react";
import {
  DollarSign,
  Copy,
  Check,
  MousePointerClick,
  UserPlus,
  TrendingUp,
  Wallet,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetAffiliateMe,
  useUpdateAffiliatePayout,
  getGetAffiliateMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const ASSETS = [
  {
    title: "Hero copy",
    body:
      "I just discovered KonnectPilot — it writes & schedules my social posts on autopilot. 7-day free trial, no credit risk.",
  },
  {
    title: "Newsletter blurb",
    body:
      "If posting consistently across Facebook, Instagram, and LinkedIn feels like a second job, try KonnectPilot. AI captions, AI images, calendar, and analytics in one tool.",
  },
  {
    title: "Tweet",
    body:
      "Stopped writing social posts manually. KonnectPilot does it for me — captions, images, scheduling. Worth a look. {referralLink}",
  },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AffiliatePage() {
  const { data, isLoading } = useGetAffiliateMe();
  const queryClient = useQueryClient();
  const updatePayout = useUpdateAffiliatePayout();

  const code = data?.code ?? "";
  const link =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/?ref=${code}`
      : "";

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAsset, setCopiedAsset] = useState<string | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<"paypal" | "stripe_connect">(
    "paypal",
  );
  const [paypalEmail, setPaypalEmail] = useState("");
  const [stripeAcct, setStripeAcct] = useState("");

  useEffect(() => {
    if (!data) return;
    const pm = data.payoutMethod;
    setPayoutMethod(pm === "stripe_connect" ? "stripe_connect" : "paypal");
    setPaypalEmail(data.paypalEmail ?? "");
    setStripeAcct(data.stripeConnectAccountId ?? "");
  }, [data]);

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function copyAsset(title: string, text: string) {
    await navigator.clipboard.writeText(text.replace("{referralLink}", link));
    setCopiedAsset(title);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedAsset(null), 2000);
  }

  function savePayout() {
    updatePayout.mutate(
      {
        data: {
          payoutMethod,
          paypalEmail: payoutMethod === "paypal" ? paypalEmail || null : null,
          stripeConnectAccountId:
            payoutMethod === "stripe_connect" ? stripeAcct || null : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Payout details saved");
          queryClient.invalidateQueries({ queryKey: getGetAffiliateMeQueryKey() });
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed to save"),
      },
    );
  }

  const stats = data?.stats;
  const config = data?.config;
  const cards = [
    {
      label: "Clicks",
      value: stats?.clicks ?? 0,
      icon: MousePointerClick,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Signups",
      value: stats?.signups ?? 0,
      icon: UserPlus,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Conversions",
      value: stats?.conversions ?? 0,
      icon: TrendingUp,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Lifetime earned",
      value: formatCents(stats?.lifetimeEarnedCents ?? 0),
      icon: Wallet,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" /> Affiliate Program
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Earn {config?.ratePct ?? 30}% recurring commission for the first{" "}
            {config?.months ?? 12} months on every customer you refer.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Your referral link</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={link}
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono"
                />
                <button
                  onClick={copyLink}
                  className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Your code: <span className="font-mono text-foreground">{code}</span> ·{" "}
                {config?.cookieDays ?? 60}-day cookie window
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Payouts</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Pending balance
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCents(stats?.pendingCents ?? 0)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Lifetime paid
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCents(stats?.paidCents ?? 0)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Payout method
                  </label>
                  <div className="mt-1 flex gap-2">
                    {(
                      [
                        { id: "paypal", label: "PayPal" },
                        { id: "stripe_connect", label: "Stripe Connect" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPayoutMethod(opt.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          payoutMethod === opt.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {payoutMethod === "paypal" ? (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      PayPal email
                    </label>
                    <input
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="payouts@yourdomain.com"
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Stripe Connect account ID
                    </label>
                    <input
                      type="text"
                      value={stripeAcct}
                      onChange={(e) => setStripeAcct(e.target.value)}
                      placeholder="acct_..."
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">
                    Minimum payout:{" "}
                    <span className="text-foreground font-medium">
                      {formatCents(config?.minPayoutCents ?? 5000)}
                    </span>{" "}
                    · Paid monthly
                  </p>
                  <button
                    onClick={savePayout}
                    disabled={updatePayout.isPending}
                    className="inline-flex items-center gap-1.5 bg-foreground text-background px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {updatePayout.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save payout details
                  </button>
                </div>
              </div>
            </div>

            {data && data.recentReferrals.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">Recent referrals</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-5 py-2 text-left">Status</th>
                      <th className="px-5 py-2 text-left">Clicked</th>
                      <th className="px-5 py-2 text-left">Signed up</th>
                      <th className="px-5 py-2 text-left">Converted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recentReferrals.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-2 capitalize">{r.status.replace(/_/g, " ")}</td>
                        <td className="px-5 py-2 text-muted-foreground">
                          {new Date(r.clickAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-2 text-muted-foreground">
                          {r.signupAt ? new Date(r.signupAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-2 text-muted-foreground">
                          {r.convertedAt ? new Date(r.convertedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Marketing assets</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Copy any of these and share — your link is automatically inserted.
                </p>
              </div>
              <div className="divide-y divide-border">
                {ASSETS.map((a) => (
                  <div key={a.title} className="px-5 py-4 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        {a.title}
                      </p>
                      <p className="text-sm text-foreground">
                        {a.body.replace("{referralLink}", link)}
                      </p>
                    </div>
                    <button
                      onClick={() => copyAsset(a.title, a.body)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary"
                    >
                      {copiedAsset === a.title ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedAsset === a.title ? "Copied" : "Copy"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Questions?{" "}
              <a
                href="mailto:affiliates@konnectpilot.com"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Contact affiliate team <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
