import { useGetMyUsage } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Sparkles, Image as ImageIcon, ArrowRight } from "lucide-react";

function Bar({ used, limit, label, icon: Icon }: { used: number; limit: number | null | undefined; label: string; icon: any }) {
  const isUnlimited = limit === null || limit === undefined;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const danger = !isUnlimited && pct >= 90;
  const warn = !isUnlimited && pct >= 75 && pct < 90;
  const barColor = danger ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </span>
        <span className="font-medium text-foreground">
          {used}
          {isUnlimited ? " / ∞" : ` / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: isUnlimited ? "8%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function UsageWidget() {
  const { data, isLoading } = useGetMyUsage();

  if (isLoading || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">This Month's Usage</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const captionMaxed =
    data.captionLimit != null && data.captionUsed >= data.captionLimit;
  const imageMaxed = data.imageLimit != null && data.imageUsed >= data.imageLimit;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-foreground">This Month's Usage</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary capitalize text-muted-foreground">
          {data.plan}
        </span>
      </div>
      <div className="space-y-3">
        <Bar
          used={data.captionUsed}
          limit={data.captionLimit}
          label="Captions"
          icon={Sparkles}
        />
        <Bar
          used={data.imageUsed}
          limit={data.imageLimit}
          label="Images"
          icon={ImageIcon}
        />
      </div>
      {(captionMaxed || imageMaxed) && (
        <Link
          href="/billing"
          className="mt-4 flex items-center justify-between text-sm font-medium text-primary hover:underline"
        >
          You've hit a limit — upgrade
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
