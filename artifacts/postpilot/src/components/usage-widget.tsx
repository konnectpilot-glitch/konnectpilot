import { useGetMyUsage } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Sparkles, ArrowRight, Gift } from "lucide-react";

function fmt(n: number): string {
  // Show up to 1 decimal place, drop trailing .0 for clean display.
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export default function UsageWidget() {
  const { data, isLoading } = useGetMyUsage();

  if (isLoading || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">This Month's Credits</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const used = data.creditsUsed;
  const limit = data.creditsLimit;
  const bonus = data.bonusCredits;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const danger = pct >= 90;
  const warn = pct >= 75 && pct < 90;
  const barColor = danger ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary";
  const maxed = used >= limit;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-foreground">This Month's Credits</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary capitalize text-muted-foreground">
          {data.plan}
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              Monthly credits
            </span>
            <span className="font-medium text-foreground">
              {fmt(used)} / {limit}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {fmt(remaining)} credits remaining this month
          </p>
        </div>
        {bonus > 0 && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-secondary/50 border border-border">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Gift className="w-3.5 h-3.5" />
              Top-up balance
            </span>
            <span className="font-medium text-foreground">{fmt(bonus)} credits</span>
          </div>
        )}
      </div>
      {maxed && (
        <Link
          href="/billing"
          className="mt-4 flex items-center justify-between text-sm font-medium text-primary hover:underline"
        >
          You've used all monthly credits — top up or upgrade
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
