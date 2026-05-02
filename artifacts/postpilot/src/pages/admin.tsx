import Layout from "@/components/layout";
import { useState, useMemo } from "react";
import {
  useAdminListUsers,
  useAdminResetTrial,
  useAdminSetPlan,
  useAdminSetSuperadmin,
  useAdminImpersonate,
  useGetMe,
  getAdminListUsersQueryKey,
} from "@workspace/api-client-react";
import { startImpersonation } from "@/lib/impersonation";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminUserSummary } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Redirect } from "wouter";
import { Loader2, Search, Shield, RotateCcw, Crown, ChevronDown, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-50 text-blue-700",
  pro: "bg-purple-50 text-purple-700",
  agency: "bg-amber-50 text-amber-700",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}>
      {plan}
    </span>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    status === "active"
      ? "bg-green-50 text-green-700"
      : status === "trialing"
      ? "bg-blue-50 text-blue-700"
      : status === "past_due"
      ? "bg-amber-50 text-amber-700"
      : status === "canceled"
      ? "bg-gray-100 text-gray-600"
      : "bg-secondary text-muted-foreground";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminPage() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: users, isLoading } = useAdminListUsers({
    query: { enabled: !!me?.isSuperadmin, queryKey: getAdminListUsersQueryKey() },
  });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const resetTrial = useAdminResetTrial();
  const setPlan = useAdminSetPlan();
  const setSuperadmin = useAdminSetSuperadmin();
  const impersonate = useAdminImpersonate();

  const handleImpersonate = (u: AdminUserSummary) => {
    impersonate.mutate(
      { id: u.id },
      {
        onSuccess: (session) => {
          startImpersonation(session.userId, session.email);
          toast.success(`Now viewing as ${session.email}`);
          queryClient.invalidateQueries();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed to impersonate"),
      },
    );
  };

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        u.plan.toLowerCase().includes(q),
    );
  }, [users, search]);

  const totalMrrCents = useMemo(
    () => (users ?? []).reduce((sum, u) => sum + (u.mrrCents ?? 0), 0),
    [users],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });

  const handleResetTrial = (u: AdminUserSummary) => {
    resetTrial.mutate(
      { id: u.id },
      {
        onSuccess: () => {
          toast.success(`Trial reset for ${u.email}`);
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed to reset trial"),
      },
    );
  };

  const handleSetPlan = (u: AdminUserSummary, plan: "free" | "starter" | "pro" | "agency") => {
    if (plan === u.plan) return;
    setPlan.mutate(
      { id: u.id, data: { plan } },
      {
        onSuccess: () => {
          toast.success(`${u.email} → ${plan}`);
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed to change plan"),
      },
    );
  };

  const handleToggleSuperadmin = (u: AdminUserSummary) => {
    setSuperadmin.mutate(
      { id: u.id, data: { isSuperadmin: !u.isSuperadmin } },
      {
        onSuccess: () => {
          toast.success(
            u.isSuperadmin
              ? `Removed superadmin from ${u.email}`
              : `${u.email} is now a superadmin`,
          );
          invalidate();
        },
        onError: (err: any) =>
          toast.error(err?.message ?? "Failed to toggle superadmin"),
      },
    );
  };

  if (meLoading) {
    return (
      <Layout>
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      </Layout>
    );
  }

  if (!me?.isSuperadmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Super Admin
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Customer overview and account controls
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-card border border-border rounded-lg px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Total users</p>
              <p className="text-xl font-bold text-foreground">{users?.length ?? 0}</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Estimated MRR</p>
              <p className="text-xl font-bold text-foreground">
                ${(totalMrrCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or plan…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading users…
            </div>
          ) : (filtered?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No users match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border bg-secondary/30">
                    <th className="text-left font-medium px-4 py-3">User</th>
                    <th className="text-left font-medium px-4 py-3">Plan</th>
                    <th className="text-left font-medium px-4 py-3">Status</th>
                    <th className="text-right font-medium px-4 py-3">Brands</th>
                    <th className="text-right font-medium px-4 py-3">Posts</th>
                    <th className="text-right font-medium px-4 py-3">Usage (mo)</th>
                    <th className="text-left font-medium px-4 py-3">Last activity</th>
                    <th className="text-right font-medium px-4 py-3 w-px">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-foreground flex items-center gap-1">
                              {u.email}
                              {u.isSuperadmin && (
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              )}
                            </p>
                            {u.name && (
                              <p className="text-xs text-muted-foreground">{u.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                      <td className="px-4 py-3"><StatusPill status={u.subscriptionStatus} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.brandCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.postCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {u.captionUsed}c · {u.imageUsed}i
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.lastActivityAt
                          ? formatDistanceToNow(new Date(u.lastActivityAt), { addSuffix: true })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border border-border hover:bg-secondary">
                              Actions
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                              Change plan
                            </DropdownMenuLabel>
                            {(["free", "starter", "pro", "agency"] as const).map((p) => (
                              <DropdownMenuItem
                                key={p}
                                onClick={() => handleSetPlan(u, p)}
                                className="capitalize text-sm"
                                disabled={p === u.plan}
                              >
                                {p === u.plan ? `${p} ✓` : p}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleImpersonate(u)}
                              className="text-sm"
                              disabled={u.id === me?.id}
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              Impersonate user
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetTrial(u)} className="text-sm">
                              <RotateCcw className="w-3.5 h-3.5 mr-2" />
                              Reset 14-day trial
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleSuperadmin(u)}
                              className="text-sm"
                            >
                              <Crown className="w-3.5 h-3.5 mr-2" />
                              {u.isSuperadmin ? "Remove superadmin" : "Make superadmin"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
