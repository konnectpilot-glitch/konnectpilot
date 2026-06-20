import "./_group.css";
import {
  Plus,
  Pencil,
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
  CalendarClock,
  AlertTriangle,
} from "lucide-react";

const BRANDS = [
  {
    id: 1,
    name: "Acme Coffee Co.",
    industry: "Coffee & Cafes",
    tone: "friendly",
    platforms: ["instagram", "facebook"],
    postTime: "09:00",
    active: true,
  },
  {
    id: 2,
    name: "Northwind Realty",
    industry: "Real Estate",
    tone: "professional",
    platforms: ["facebook", "linkedin"],
    postTime: "08:30",
    active: true,
  },
  {
    id: 3,
    name: "PulseFit Studio",
    industry: "Fitness",
    tone: "inspirational",
    platforms: ["instagram"],
    postTime: "07:00",
    active: false,
  },
];

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { icon: any; label: string; cls: string }> = {
    facebook: { icon: <Facebook className="w-3 h-3" />, label: "Facebook", cls: "bg-blue-50 text-blue-700" },
    instagram: { icon: <Instagram className="w-3 h-3" />, label: "Instagram", cls: "bg-pink-50 text-pink-700" },
    linkedin: { icon: <Linkedin className="w-3 h-3" />, label: "LinkedIn", cls: "bg-blue-50 text-blue-800" },
  };
  const c = map[platform];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function SidebarItem({ icon: Icon, label, active, badge }: any) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
        active
          ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"
          : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
          {badge}
        </span>
      )}
    </div>
  );
}

export function Current() {
  return (
    <div className="brand-merge-root flex">
      {/* Sidebar */}
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
        <SidebarItem icon={CalendarClock} label="Schedules" badge="Dup" />
        <div className="mt-3 mx-1 p-2 rounded-lg border border-amber-200 bg-amber-50/60 text-[11px] text-amber-800 flex gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Posting settings live in 2 places — Brand <em>and</em> Schedules.</span>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Brands</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Manage your brands and their posting settings
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-2 rounded-lg">
            <Plus className="w-4 h-4" />
            New Brand
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BRANDS.map((brand) => (
            <div
              key={brand.id}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[hsl(var(--primary))]/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{brand.name}</h3>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{brand.industry}</p>
                  </div>
                </div>
                <div
                  className={`w-2 h-2 rounded-full mt-1 ${brand.active ? "bg-green-500" : "bg-gray-300"}`}
                  title={brand.active ? "Active" : "Inactive"}
                />
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {brand.platforms.map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-4">
                <span className="capitalize bg-[hsl(var(--secondary))] px-2 py-0.5 rounded-full">
                  {brand.tone}
                </span>
                <span>·</span>
                <span>Posts at {brand.postTime}</span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg">
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                <button className="flex items-center justify-center gap-1.5 text-xs font-medium border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Friction callout */}
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 flex gap-3 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Friction in this flow</p>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-900/90 text-xs">
              <li>Card shows <em>postTime</em> + <em>active</em> + <em>platforms</em>, but the actual auto-posting lives on a different page.</li>
              <li>User has to leave Brands → open <em>Schedules</em> → re-pick brand → re-pick platforms.</li>
              <li>Three duplicated fields between Brand and Schedule (platforms, postTime, active).</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
