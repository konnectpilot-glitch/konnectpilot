import { Calendar, Image as ImageIcon, Sparkles, CheckCircle2, Clock } from "lucide-react";

/**
 * A pure-CSS / SVG-free stylized product mockup used on the marketing pages.
 * Renders a faux dashboard card showing a calendar tile + a generated post,
 * giving visitors a feel for the product without shipping a heavy screenshot.
 */
export default function ProductMockup() {
  return (
    <div className="relative">
      {/* Decorative gradient halo */}
      <div
        aria-hidden
        className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-blue-400/10 to-purple-400/15 blur-2xl rounded-[2rem]"
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-secondary/40">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-[11px] text-muted-foreground font-mono">app.konnectpilot.com / calendar</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
          {/* Sidebar */}
          <div className="hidden md:flex md:col-span-1 flex-col gap-1 p-3 border-r border-border bg-secondary/20">
            {[
              { label: "Dashboard", active: false },
              { label: "Calendar", active: true },
              { label: "Library", active: false },
              { label: "Brands", active: false },
              { label: "Analytics", active: false },
            ].map((i) => (
              <div
                key={i.label}
                className={`text-[11px] px-2.5 py-1.5 rounded-md ${
                  i.active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {i.label}
              </div>
            ))}
          </div>

          {/* Main */}
          <div className="md:col-span-4 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Calendar preview */}
            <div className="bg-background border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">May 2026</span>
                </div>
                <div className="flex gap-1">
                  <span className="w-5 h-5 rounded bg-secondary" />
                  <span className="w-5 h-5 rounded bg-secondary" />
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-[8px] text-muted-foreground mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 28 }).map((_, i) => {
                  const dotColors = [
                    null,
                    null,
                    "bg-blue-500",
                    null,
                    "bg-pink-500",
                    "bg-blue-700",
                    null,
                    "bg-blue-500",
                    "bg-pink-500",
                    null,
                    "bg-blue-700",
                    null,
                    "bg-pink-500",
                    "bg-blue-500",
                    null,
                    "bg-blue-700",
                    "bg-pink-500",
                    null,
                    "bg-blue-500",
                    null,
                    "bg-pink-500",
                    "bg-blue-500",
                    "bg-blue-700",
                    null,
                    "bg-pink-500",
                    null,
                    "bg-blue-500",
                    "bg-blue-700",
                  ];
                  const dot = dotColors[i];
                  const isToday = i === 12;
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded text-[8px] flex flex-col items-center justify-center ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-secondary/50 text-foreground"
                      }`}
                    >
                      <span>{i + 1}</span>
                      {dot && <span className={`w-1 h-1 rounded-full mt-0.5 ${dot}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Post preview */}
            <div className="bg-background border border-border rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-foreground">Acme Coffee · Instagram</div>
                  <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Scheduled · Today, 9:30 AM
                  </div>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                </span>
              </div>
              {/* Generated image stand-in */}
              <div className="aspect-video rounded-lg bg-gradient-to-br from-amber-200 via-orange-300 to-pink-300 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-white/70" />
                </div>
                <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                  <Sparkles className="w-2.5 h-2.5" /> AI generated
                </div>
              </div>
              <div className="text-[10.5px] leading-relaxed text-foreground">
                <span className="font-semibold">Slow mornings, fast espresso ☕</span>
                <br />
                <span className="text-muted-foreground">
                  Stop by before 10am for our weekday cappuccino — small batch, single origin, made by people who care.
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {["#localcoffee", "#smallbatch", "#morningroutine"].map((t) => (
                  <span key={t} className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
