import "./_group.css";
import {
  Plus,
  Pencil,
  Pause,
  Play,
  Trash2,
  Facebook,
  Instagram,
  Linkedin,
  Zap,
  LayoutDashboard,
  Building2,
  FileText,
  CalendarDays,
  Link2,
  CreditCard,
  ArrowLeft,
  Clock,
  Hash,
  CheckCircle2,
  Sparkles,
  History,
} from "lucide-react";

function SidebarItem({ icon: Icon, label, active }: any) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
        active
          ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"
          : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );
}

const SCHEDULES = [
  {
    id: 1,
    name: "Daily morning carousel",
    isActive: true,
    platforms: ["instagram", "facebook"],
    postTimes: ["09:00", "13:00"],
    contentPrompt: "Behind-the-scenes shots and weekly tips",
    lastRunAt: "Today, 09:02 UTC",
  },
  {
    id: 2,
    name: "Evening engagement story",
    isActive: false,
    platforms: ["instagram"],
    postTimes: ["18:30"],
    contentPrompt: "Customer testimonials and quotes",
    lastRunAt: "Paused 2 days ago",
  },
];

const PLATFORM_COLOR: Record<string, { bg: string; fg: string; icon: any }> = {
  facebook: { bg: "#1877F220", fg: "#1877F2", icon: <Facebook className="w-3 h-3" /> },
  instagram: { bg: "#E1306C20", fg: "#E1306C", icon: <Instagram className="w-3 h-3" /> },
  linkedin: { bg: "#0A66C220", fg: "#0A66C2", icon: <Linkedin className="w-3 h-3" /> },
};

function Pill({ platform }: { platform: string }) {
  const c = PLATFORM_COLOR[platform];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: c.bg, color: c.fg }}
    >
      {c.icon}
      <span className="capitalize">{platform}</span>
    </span>
  );
}

function ScheduleCard({ s }: { s: (typeof SCHEDULES)[number] }) {
  return (
    <div
      className={`rounded-xl border bg-[hsl(var(--card))] p-4 ${
        s.isActive ? "border-[hsl(var(--border))]" : "border-[hsl(var(--border))] opacity-70"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-sm truncate">{s.name}</h3>
            {!s.isActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                Paused
              </span>
            )}
            {s.isActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Active
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {s.postTimes.length} post{s.postTimes.length === 1 ? "" : "s"}/day
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {s.postTimes.join(", ")} UTC
            </span>
            <span className="flex items-center gap-1">
              {s.platforms.map((p) => (
                <Pill key={p} platform={p} />
              ))}
            </span>
          </div>

          {s.contentPrompt && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2 italic">
              Theme: {s.contentPrompt}
            </p>
          )}
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{s.lastRunAt}</p>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-[hsl(var(--secondary))]" title="History">
            <History className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded hover:bg-[hsl(var(--secondary))]" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded hover:bg-[hsl(var(--secondary))]" title={s.isActive ? "Pause" : "Resume"}>
            {s.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Proposed() {
  return (
    <div className="brand-merge-root flex">
      {/* Sidebar — Schedules entry GONE */}
      <aside className="w-56 shrink-0 border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm">KonnectPilot</span>
        </div>
        <SidebarItem icon={LayoutDashboard} label="Dashboard" />
        <SidebarItem icon={Building2} label="Brands" active />
        <SidebarItem icon={FileText} label="Posts" />
        <SidebarItem icon={CalendarDays} label="Calendar" />
        <SidebarItem icon={Link2} label="Connections" />
        <SidebarItem icon={CreditCard} label="Billing" />
        <div className="mt-3 mx-1 p-2 rounded-lg border border-green-200 bg-green-50/70 text-[11px] text-green-800">
          <span className="font-semibold">One sidebar entry.</span> Schedules now live inside each brand.
        </div>
      </aside>

      {/* Main: Brand detail page */}
      <main className="flex-1 p-6 max-w-5xl space-y-5">
        {/* Breadcrumb / back */}
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <ArrowLeft className="w-4 h-4" />
          <span>Brands</span>
          <span>/</span>
          <span className="text-[hsl(var(--foreground))] font-medium">Acme Coffee Co.</span>
        </div>

        {/* Brand header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Acme Coffee Co.</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                Coffee &amp; Cafes · <span className="capitalize">friendly</span> tone
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-xs font-medium border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg">
              <Pencil className="w-3 h-3" /> Edit identity
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[hsl(var(--border))] flex items-center gap-1 -mb-px">
          {[
            { label: "Overview", active: false },
            { label: "Schedules", active: true, count: 2 },
            { label: "Posts", active: false, count: 47 },
            { label: "Connections", active: false, count: 3 },
          ].map((t) => (
            <button
              key={t.label}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                t.active
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    t.active ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]" : "bg-[hsl(var(--secondary))]"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Schedules tab content */}
        <div className="space-y-3 pt-1">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                Auto-post schedules for this brand
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                KonnectPilot generates an image and caption at each scheduled time.
              </p>
            </div>
            <button className="flex items-center gap-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 rounded-lg">
              <Plus className="w-3.5 h-3.5" />
              New schedule
            </button>
          </div>

          <div className="grid gap-2">
            {SCHEDULES.map((s) => (
              <ScheduleCard key={s.id} s={s} />
            ))}
          </div>

          {/* What changed callout */}
          <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 flex gap-3 text-sm text-green-900 mt-4">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">What changed</p>
              <ul className="list-disc pl-5 space-y-0.5 text-green-900/90 text-xs">
                <li>
                  Brand now stores <em>identity only</em> — name, industry, tone, audience, keywords.
                </li>
                <li>
                  <em>postTime, platforms, active</em> moved off the Brand and onto the Schedule (where they actually run).
                </li>
                <li>
                  One brand can have multiple schedules (morning carousel + evening story) — today this is impossible.
                </li>
                <li>
                  Sidebar drops the standalone "Schedules" entry. Calendar still aggregates across all brands.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
