import React, { useEffect } from "react";
import { 
  Bell, 
  Search, 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  FileText, 
  BarChart3, 
  Inbox, 
  Users, 
  Settings,
  ChevronDown,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Plus
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const colors = {
  sky: "#1E5BE0",
  sky600: "#1A4FC4",
  sky100: "#E5EDFE",
  coral: "#FF8A6B",
  brass: "#D4A24C",
  cream: "#FFF7EE",
  surface: "#FFFFFF",
  ink: "#1A2236",
  inkMuted: "#5A6478",
  border: "#F0E6D6",
  success: "#3DB07A",
  warning: "#D49636",
  error: "#C13E45",
};

export function Action() {
  useEffect(() => {
    // Add Google Font
    if (!document.getElementById("plus-jakarta-sans")) {
      const link = document.createElement("link");
      link.id = "plus-jakarta-sans";
      link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div 
      className="min-h-[2200px] w-full flex justify-center pb-16"
      style={{ 
        backgroundColor: colors.cream,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: colors.ink
      }}
    >
      <div className="w-full max-w-[1280px] px-12 pt-12 flex flex-col gap-8">
        
        {/* Top App Bar */}
        <header className="flex items-center justify-between bg-white rounded-2xl px-6 py-4" style={{ border: `1px solid ${colors.border}`, boxShadow: "0 1px 2px rgba(26,34,54,0.04)" }}>
          <div className="flex items-center gap-12">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.sky }}>
                <div className="w-3 h-3 bg-white rounded-sm"></div>
              </div>
              <span className="font-bold text-[20px] tracking-tight">KonnectPilot</span>
            </div>
            
            {/* Workspace Switcher */}
            <button className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors">
              <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center text-[11px] font-bold text-orange-600">A</div>
              <span className="font-semibold text-[15px]">Acme Bakery</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.inkMuted }} />
              <input 
                type="text" 
                placeholder="Search posts..." 
                className="pl-9 pr-4 py-2 rounded-lg text-[15px] outline-none w-64"
                style={{ backgroundColor: colors.cream, border: `1px solid ${colors.border}` }}
              />
            </div>
            
            <div className="w-[1px] h-6" style={{ backgroundColor: colors.border }}></div>

            <button className="relative p-2 hover:bg-gray-50 rounded-full transition-colors">
              <Bell size={20} style={{ color: colors.inkMuted }} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: colors.coral, border: "2px solid white" }}></span>
            </button>

            <Avatar className="h-9 w-9 border cursor-pointer" style={{ borderColor: colors.border }}>
              <AvatarImage src="https://i.pravatar.cc/150?u=sara" alt="Sara" />
              <AvatarFallback>SR</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex gap-8 items-start">
          {/* Left Sidebar */}
          <aside className="w-64 flex-shrink-0 flex flex-col gap-2">
            {[
              { icon: LayoutDashboard, label: "Overview", active: true },
              { icon: CalendarIcon, label: "Calendar" },
              { icon: FileText, label: "Drafts", count: 3 },
              { icon: BarChart3, label: "Analytics" },
              { icon: Inbox, label: "Inbox" },
              { icon: Users, label: "Connections" },
              { icon: Settings, label: "Settings" }
            ].map((item, i) => (
              <button 
                key={i}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all"
                style={{ 
                  backgroundColor: item.active ? colors.sky100 : "transparent",
                  color: item.active ? colors.sky : colors.inkMuted,
                  fontWeight: item.active ? 600 : 500
                }}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} />
                  <span className="text-[15px]">{item.label}</span>
                </div>
                {item.count && (
                  <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold" style={{ backgroundColor: colors.cream, color: colors.ink, fontVariantNumeric: "tabular-nums" }}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col gap-8">
            <h1 className="text-[40px] font-bold leading-[44px] tracking-tight">
              Good morning, Sara. Here's your week.
            </h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Scheduled this week", value: "24", change: "+2", isPositive: true },
                { label: "Reach last 7d", value: "12,847", change: "+14%", isPositive: true },
                { label: "Engagement", value: "4.2%", change: "-0.4%", isPositive: false },
                { label: "Drafts waiting", value: "3", change: "Need review", isNeutral: true }
              ].map((kpi, i) => (
                <div key={i} className="rounded-2xl p-6 flex flex-col gap-2" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: "0 1px 2px rgba(26,34,54,0.04)" }}>
                  <span className="text-[15px] font-medium" style={{ color: colors.inkMuted }}>{kpi.label}</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[28px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold mt-1">
                    {!kpi.isNeutral && (
                      kpi.isPositive ? 
                        <TrendingUp size={14} style={{ color: colors.success }} /> : 
                        <TrendingDown size={14} style={{ color: colors.error }} />
                    )}
                    <span style={{ 
                      color: kpi.isNeutral ? colors.inkMuted : (kpi.isPositive ? colors.success : colors.error),
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {kpi.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-8 items-start">
              {/* Left Column (Calendar & Drafts) */}
              <div className="flex-1 flex flex-col gap-8">
                
                {/* Calendar Strip */}
                <div className="rounded-2xl p-8" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: "0 1px 2px rgba(26,34,54,0.04)" }}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-[20px] font-bold">This week</h2>
                    <Button variant="outline" className="h-9 px-4 rounded-lg text-[15px] font-semibold" style={{ borderColor: colors.border, color: colors.ink }}>
                      View Calendar
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-3">
                    {[
                      { day: "Mon", date: "12", posts: [{ channel: "instagram", time: "9am" }, { channel: "linkedin", time: "2pm" }] },
                      { day: "Tue", date: "13", posts: [{ channel: "facebook", time: "11am" }] },
                      { day: "Wed", date: "14", posts: [{ channel: "instagram", time: "10am" }, { channel: "twitter", time: "1pm" }, { channel: "linkedin", time: "4pm" }] },
                      { day: "Thu", date: "15", posts: [{ channel: "instagram", time: "9am" }] },
                      { day: "Fri", date: "16", posts: [{ channel: "linkedin", time: "10am" }, { channel: "facebook", time: "3pm" }] },
                      { day: "Sat", date: "17", posts: [] },
                      { day: "Sun", date: "18", posts: [{ channel: "instagram", time: "11am" }] },
                    ].map((col, i) => (
                      <div key={i} className="flex flex-col gap-3">
                        <div className="text-center flex flex-col gap-1">
                          <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: colors.inkMuted }}>{col.day}</span>
                          <span className="text-[17px] font-bold" style={{ fontVariantNumeric: "tabular-nums", color: i === 1 ? colors.sky : colors.ink }}>{col.date}</span>
                        </div>
                        <div className="flex flex-col gap-2 min-h-[120px] p-2 rounded-xl" style={{ backgroundColor: colors.cream }}>
                          {col.posts.map((post, j) => (
                            <div key={j} className="bg-white rounded-lg p-2 text-[13px] font-semibold flex items-center gap-2 border shadow-sm cursor-pointer hover:border-blue-200 transition-colors" style={{ borderColor: colors.border, fontVariantNumeric: "tabular-nums" }}>
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ 
                                backgroundColor: 
                                  post.channel === 'instagram' ? '#E1306C' : 
                                  post.channel === 'linkedin' ? '#0A66C2' : 
                                  post.channel === 'facebook' ? '#1877F2' : 
                                  '#1DA1F2' 
                              }}></div>
                              {post.time}
                            </div>
                          ))}
                          {col.posts.length === 0 && (
                            <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                              <Plus size={16} style={{ color: colors.inkMuted }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drafts List */}
                <div className="rounded-2xl p-8" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: "0 1px 2px rgba(26,34,54,0.04)" }}>
                  <h2 className="text-[20px] font-bold mb-6">Drafts that need you</h2>
                  
                  <div className="flex flex-col gap-4">
                    {[
                      {
                        platform: <Instagram size={20} color="#E1306C" />,
                        text: "New sourdough recipe dropping this weekend! The secret is in the hydration...",
                        badge: true
                      },
                      {
                        platform: <Linkedin size={20} color="#0A66C2" />,
                        text: "Three things I learned about managing a small team while scaling our bakery operations.",
                        badge: false
                      },
                      {
                        platform: <Facebook size={20} color="#1877F2" />,
                        text: "Holiday pre-orders are open. Don't wait until the last minute!",
                        badge: false
                      }
                    ].map((draft, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border group transition-colors" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                        <div className="flex items-start gap-4">
                          <div className="mt-1">{draft.platform}</div>
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[15px] font-medium max-w-[400px] truncate">{draft.text}</p>
                            {draft.badge && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider w-max" style={{ backgroundColor: '#FDF6EB', color: colors.brass }}>
                                <Sparkles size={12} />
                                Pro suggestion
                              </div>
                            )}
                          </div>
                        </div>
                        <Button className="h-9 px-5 rounded-lg font-semibold transition-colors opacity-0 group-hover:opacity-100" style={{ backgroundColor: colors.sky, color: "white" }}>
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Rail */}
              <div className="w-[320px] flex-shrink-0 flex flex-col gap-6">
                
                {/* Pilot Tip */}
                <div className="relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: "0 8px 24px -12px rgba(26,34,54,0.08)" }}>
                  {/* Coral Accent Corner */}
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
                    <div className="absolute top-[-32px] right-[-32px] w-16 h-16 rounded-full" style={{ backgroundColor: colors.coral, opacity: 0.1 }}></div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} style={{ color: colors.coral }} />
                    <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: colors.inkMuted }}>Pilot tip</span>
                  </div>
                  
                  <p className="text-[15px] font-medium leading-relaxed">
                    Tuesday at 9am gets 38% more engagement for your audience. Want us to move this draft?
                  </p>

                  <div className="flex flex-col gap-2 mt-2">
                    <Button className="w-full h-10 rounded-lg font-semibold text-[15px] transition-colors" style={{ backgroundColor: colors.sky, color: "white" }}>
                      Move it
                    </Button>
                    <Button variant="ghost" className="w-full h-10 rounded-lg font-semibold text-[15px]" style={{ color: colors.inkMuted }}>
                      Not now
                    </Button>
                  </div>
                </div>

              </div>
            </div>
            
          </main>
        </div>
      </div>
    </div>
  );
}
