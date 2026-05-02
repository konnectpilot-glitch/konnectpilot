import Layout from "@/components/layout";
import { useUser } from "@clerk/react";
import { useState } from "react";
import {
  DollarSign, Copy, Check, MousePointerClick, UserPlus,
  TrendingUp, Wallet, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

function deriveCode(userId: string | undefined) {
  if (!userId) return "KP-DEMO";
  const tail = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return `KP-${tail || "DEMO"}`;
}

const ASSETS = [
  {
    title: "Hero copy",
    body: "I just discovered KonnectPilot — it writes & schedules my social posts on autopilot. 7-day free trial, no credit risk.",
  },
  {
    title: "Newsletter blurb",
    body: "If posting consistently across Facebook, Instagram, and LinkedIn feels like a second job, try KonnectPilot. AI captions, AI images, calendar, and analytics in one tool.",
  },
  {
    title: "Tweet",
    body: "Stopped writing social posts manually. KonnectPilot does it for me — captions, images, scheduling. Worth a look. {referralLink}",
  },
];

export default function AffiliatePage() {
  const { user } = useUser();
  const code = deriveCode(user?.id);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${code}`
      : `https://konnectpilot.com/?ref=${code}`;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAsset, setCopiedAsset] = useState<string | null>(null);

  async function copyLink() {
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

  // Placeholder stats — real backend ingestion is post-MVP
  const stats = [
    { label: "Clicks", value: 0, icon: MousePointerClick, color: "text-blue-600 bg-blue-50" },
    { label: "Signups", value: 0, icon: UserPlus, color: "text-purple-600 bg-purple-50" },
    { label: "Conversions", value: 0, icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "Earned", value: "$0.00", icon: Wallet, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" /> Affiliate Program
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Earn 30% recurring commission for the first 12 months on every customer you refer.
          </p>
        </div>

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
            Your code: <span className="font-mono text-foreground">{code}</span> · 60-day cookie window
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

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

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3">Payouts</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Pending balance</p>
              <p className="text-xl font-bold text-foreground">$0.00</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Lifetime paid</p>
              <p className="text-xl font-bold text-foreground">$0.00</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Minimum payout: <span className="text-foreground font-medium">$50</span> · Paid monthly via Stripe Connect or PayPal
            </p>
            <a
              href="mailto:affiliates@konnectpilot.com"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Contact affiliate team <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
