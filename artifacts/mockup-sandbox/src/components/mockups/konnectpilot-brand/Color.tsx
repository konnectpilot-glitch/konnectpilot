import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const COLORS = {
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

const DARK_COLORS = {
  bg: "#0F1422",
  surface: "#1A2236",
  surface2: "#232B40",
  ink: "#FFF7EE",
  inkMuted: "#A8B0C2",
  border: "#2A3147",
  sky: "#1E5BE0",
  skyHover: "#4A7BE8",
};

export function Color() {
  return (
    <div
      className="min-h-screen w-full selection:bg-[#1E5BE0] selection:text-white"
      style={{
        backgroundColor: COLORS.cream,
        color: COLORS.ink,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Font imports */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div className="max-w-[1200px] mx-auto px-12 py-16 flex flex-col gap-24">
        {/* 1. Header strip */}
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.sky }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L22 22H2L12 2Z" fill="white" />
              </svg>
            </div>
            <h1 className="text-[28px] leading-[32px] font-bold" style={{ color: COLORS.ink }}>
              KonnectPilot
            </h1>
          </div>
          <div className="space-y-2">
            <h2 className="text-[56px] leading-[60px] font-extrabold tracking-tight">Color & Typography</h2>
            <p className="text-[20px] leading-[26px] font-semibold" style={{ color: COLORS.inkMuted }}>
              Skyway Cockpit, refreshed.
            </p>
          </div>
        </header>

        {/* 2. Light-mode palette */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Light Mode Foundation</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Core brand colors. Measured, plainspoken, and functional.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <ColorChip
              name="Sky"
              hex={COLORS.sky}
              usage="Primary brand color. All primary CTAs and active states."
              contrast="AAA on White"
              textColor="#FFFFFF"
            />
            <ColorChip
              name="Coral"
              hex={COLORS.coral}
              usage="Accent. Used sparingly for empty-state highlights and celebration moments."
              contrast="AA (Large) on Cream"
              textColor="#1A2236"
            />
            <ColorChip
              name="Brass"
              hex={COLORS.brass}
              usage="Premium tier and badge ONLY. Never on CTAs."
              contrast="AA on White"
              textColor="#1A2236"
            />
            <ColorChip
              name="Cream"
              hex={COLORS.cream}
              usage="Page canvas background. Warm, approachable base."
              contrast="N/A"
              textColor="#1A2236"
              hasBorder
            />
            <ColorChip
              name="Surface"
              hex={COLORS.surface}
              usage="Card backgrounds. Clean containment."
              contrast="N/A"
              textColor="#1A2236"
              hasBorder
            />
            <ColorChip
              name="Ink"
              hex={COLORS.ink}
              usage="Primary text and high-contrast UI elements."
              contrast="AAA on Cream"
              textColor="#FFFFFF"
            />
          </div>
        </section>

        {/* 3. Tints/shades ramp */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Sky Ramp</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Monochromatic scale for the primary brand color.
            </p>
          </div>
          <div className="flex h-32 rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            <div className="flex-1 bg-[#F5F8FF] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-[#1A4FC4]">50</span></div>
            <div className="flex-1 bg-[#E5EDFE] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-[#1A4FC4]">100</span></div>
            <div className="flex-1 bg-[#CDDCFD] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-[#1A4FC4]">200</span></div>
            <div className="flex-1 bg-[#A4C2FC] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-[#1E5BE0]">300</span></div>
            <div className="flex-1 bg-[#76A0F9] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-[#1A2236]">400</span></div>
            <div className="flex-1 bg-[#4A7BE8] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-white">500</span></div>
            <div className="flex-1 bg-[#1E5BE0] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-white">600 (Sky)</span></div>
            <div className="flex-1 bg-[#1A4FC4] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-white">700 (Hover)</span></div>
            <div className="flex-1 bg-[#1641A3] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-white">800</span></div>
            <div className="flex-1 bg-[#123687] p-4 flex flex-col justify-end"><span className="text-[13px] font-medium text-white">900</span></div>
          </div>
        </section>

        {/* 4. Semantic colors row */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Semantic Signals</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Used strictly for system feedback and status.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl flex flex-col gap-6 bg-white" style={{ border: `1px solid ${COLORS.border}` }}>
              <div>
                <div className="text-[15px] font-bold mb-1" style={{ color: COLORS.ink }}>Success</div>
                <div className="text-[13px] font-mono mb-4 text-[#5A6478]">{COLORS.success}</div>
                <div className="w-full h-12 rounded-lg" style={{ backgroundColor: COLORS.success }}></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium" style={{ backgroundColor: '#E7F6EF', color: COLORS.success }}>
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS.success }}></span>
                  Saved
                </span>
                <span className="text-[13px]" style={{ color: COLORS.inkMuted }}>Post scheduled</span>
              </div>
            </div>
            
            <div className="p-6 rounded-2xl flex flex-col gap-6 bg-white" style={{ border: `1px solid ${COLORS.border}` }}>
              <div>
                <div className="text-[15px] font-bold mb-1" style={{ color: COLORS.ink }}>Warning</div>
                <div className="text-[13px] font-mono mb-4 text-[#5A6478]">{COLORS.warning}</div>
                <div className="w-full h-12 rounded-lg" style={{ backgroundColor: COLORS.warning }}></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium" style={{ backgroundColor: '#FDF4E7', color: COLORS.warning }}>
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS.warning }}></span>
                  Draft
                </span>
                <span className="text-[13px]" style={{ color: COLORS.inkMuted }}>Needs review</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl flex flex-col gap-6 bg-white" style={{ border: `1px solid ${COLORS.border}` }}>
              <div>
                <div className="text-[15px] font-bold mb-1" style={{ color: COLORS.ink }}>Error</div>
                <div className="text-[13px] font-mono mb-4 text-[#5A6478]">{COLORS.error}</div>
                <div className="w-full h-12 rounded-lg" style={{ backgroundColor: COLORS.error }}></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium" style={{ backgroundColor: '#FBEBEB', color: COLORS.error }}>
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS.error }}></span>
                  Reconnect required
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Dark-mode preview */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Dark Mode Implementation</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Low-light environment execution. Sky remains pure, contrast shifts gracefully.
            </p>
          </div>
          <div className="p-12 rounded-[24px] flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: DARK_COLORS.bg }}>
            {/* Background elements to show depth */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20" style={{ backgroundColor: DARK_COLORS.sky }}></div>
            
            <div className="w-full max-w-lg p-8 rounded-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]" style={{ backgroundColor: DARK_COLORS.surface, border: `1px solid ${DARK_COLORS.border}` }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-[20px] leading-[26px] font-semibold mb-1" style={{ color: DARK_COLORS.ink }}>Social Strategy</h4>
                  <p className="text-[15px] leading-[22px]" style={{ color: DARK_COLORS.inkMuted }}>Weekly performance overview</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[13px] font-semibold tracking-[0.02em] uppercase" style={{ backgroundColor: 'rgba(212,162,76,0.1)', color: COLORS.brass }}>
                  Pro
                </span>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-xl flex items-center justify-between" style={{ backgroundColor: DARK_COLORS.surface2 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,138,107,0.1)' }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.coral }}></div>
                    </div>
                    <div>
                      <div className="text-[15px] font-medium" style={{ color: DARK_COLORS.ink }}>Engagement spike</div>
                      <div className="text-[13px]" style={{ color: DARK_COLORS.inkMuted }}>2 hours ago</div>
                    </div>
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums" style={{ color: COLORS.success }}>+12.4%</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-2.5 px-4 rounded-lg font-medium text-[15px] transition-colors" style={{ backgroundColor: DARK_COLORS.sky, color: '#FFFFFF' }}>
                  View Report
                </button>
                <button className="flex-1 py-2.5 px-4 rounded-lg font-medium text-[15px] transition-colors" style={{ backgroundColor: 'transparent', color: DARK_COLORS.ink, border: `1px solid ${DARK_COLORS.border}` }}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </section>

        <Separator style={{ backgroundColor: COLORS.border }} />

        {/* 6. Type specimen */}
        <section className="space-y-12">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Typography System</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Plus Jakarta Sans. Highly legible, measured, confident.
            </p>
          </div>
          
          <div className="space-y-12">
            <TypeRow 
              label="Display" 
              specs="56/60 • 800" 
              sample="Run your social like a pro." 
              className="text-[56px] leading-[60px] font-extrabold tracking-tight"
            />
            <TypeRow 
              label="H1" 
              specs="40/44 • 700" 
              sample="Your week of posts. Planned in fifteen minutes." 
              className="text-[40px] leading-[44px] font-bold tracking-tight"
            />
            <TypeRow 
              label="H2" 
              specs="28/32 • 700" 
              sample="We'll write the first draft. You make it sound like you." 
              className="text-[28px] leading-[32px] font-bold"
            />
            <TypeRow 
              label="H3" 
              specs="20/26 • 600" 
              sample="Connect your accounts to get started." 
              className="text-[20px] leading-[26px] font-semibold"
            />
            <TypeRow 
              label="Body Large" 
              specs="17/26 • 400" 
              sample="We couldn't connect to Instagram. Reconnecting usually fixes it." 
              className="text-[17px] leading-[26px] font-normal"
            />
            <TypeRow 
              label="Body" 
              specs="15/22 • 400" 
              sample="Nothing scheduled yet. Start with one post — we'll handle the rest of the week." 
              className="text-[15px] leading-[22px] font-normal"
            />
            <TypeRow 
              label="Caption" 
              specs="13/18 • 500" 
              sample="LAST UPDATED 15 MINS AGO" 
              className="text-[13px] leading-[18px] font-medium uppercase tracking-[0.02em]"
            />
            <TypeRow 
              label="Mono" 
              specs="13/18 • 400" 
              sample="0x7f2a1b9c8d4e" 
              className="text-[13px] leading-[18px] font-normal font-mono"
              fontFamily="'JetBrains Mono', monospace"
            />
          </div>
        </section>

        {/* 7. Numeric specimen */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Data & Numerics</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Tabular numerals enforced for all metrics and data tables.
            </p>
          </div>
          
          <div className="p-8 rounded-2xl bg-white flex justify-between" style={{ border: `1px solid ${COLORS.border}` }}>
            <div className="space-y-2 flex-1 border-r border-[#F0E6D6] px-8 first:pl-0 last:border-0 last:pr-0">
              <div className="text-[13px] font-medium uppercase tracking-[0.02em]" style={{ color: COLORS.inkMuted }}>Total Reach</div>
              <div className="text-[40px] leading-[44px] font-bold tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>12,847</div>
              <div className="text-[13px] tabular-nums flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                <span style={{ color: COLORS.success }} className="font-medium">+18%</span>
                <span style={{ color: COLORS.inkMuted }}>week-over-week</span>
              </div>
            </div>
            
            <div className="space-y-2 flex-1 border-r border-[#F0E6D6] px-8 first:pl-0 last:border-0 last:pr-0">
              <div className="text-[13px] font-medium uppercase tracking-[0.02em]" style={{ color: COLORS.inkMuted }}>Engagement Rate</div>
              <div className="text-[40px] leading-[44px] font-bold tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>4.2%</div>
              <div className="text-[13px] tabular-nums flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                <span style={{ color: COLORS.success }} className="font-medium">+0.8%</span>
                <span style={{ color: COLORS.inkMuted }}>week-over-week</span>
              </div>
            </div>

            <div className="space-y-2 flex-1 border-r border-[#F0E6D6] px-8 first:pl-0 last:border-0 last:pr-0">
              <div className="text-[13px] font-medium uppercase tracking-[0.02em]" style={{ color: COLORS.inkMuted }}>Scheduled Posts</div>
              <div className="text-[40px] leading-[44px] font-bold tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>24</div>
              <div className="text-[13px] tabular-nums flex items-center gap-1">
                <span style={{ color: COLORS.inkMuted }}>Next: Tomorrow 9:00 AM</span>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Contrast audit table */}
        <section className="space-y-8 pb-16">
          <div className="space-y-2">
            <h3 className="text-[28px] leading-[32px] font-bold">Contrast Audit</h3>
            <p className="text-[17px] leading-[26px]" style={{ color: COLORS.inkMuted }}>
              Accessibility ratios for key color pairings.
            </p>
          </div>
          
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.cream }}>
                  <th className="py-4 px-6 text-[13px] font-medium uppercase tracking-[0.02em] text-[#5A6478]">Pairing</th>
                  <th className="py-4 px-6 text-[13px] font-medium uppercase tracking-[0.02em] text-[#5A6478]">Preview</th>
                  <th className="py-4 px-6 text-[13px] font-medium uppercase tracking-[0.02em] text-[#5A6478]">Ratio</th>
                  <th className="py-4 px-6 text-[13px] font-medium uppercase tracking-[0.02em] text-[#5A6478]">Score</th>
                </tr>
              </thead>
              <tbody className="text-[15px]">
                <ContrastRow bg={COLORS.cream} fg={COLORS.sky} bgName="Cream" fgName="Sky" ratio="6.24:1" score="AA / AAA Large" />
                <ContrastRow bg={COLORS.surface} fg={COLORS.sky} bgName="White" fgName="Sky" ratio="6.47:1" score="AA / AAA Large" />
                <ContrastRow bg={COLORS.cream} fg={COLORS.ink} bgName="Cream" fgName="Ink" ratio="13.8:1" score="AAA" />
                <ContrastRow bg={COLORS.cream} fg={COLORS.inkMuted} bgName="Cream" fgName="Ink-muted" ratio="5.4:1" score="AA" />
                <ContrastRow bg={COLORS.sky} fg={COLORS.surface} bgName="Sky" fgName="White" ratio="6.47:1" score="AA / AAA Large" />
                <ContrastRow bg={COLORS.cream} fg={COLORS.coral} bgName="Cream" fgName="Coral" ratio="2.98:1" score="AA Large Only" warning />
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}

function ColorChip({ name, hex, usage, contrast, textColor, hasBorder = false }: any) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col h-full bg-white" style={{ border: `1px solid ${COLORS.border}`, boxShadow: '0 4px 12px -8px rgba(26,34,54,0.08)' }}>
      <div 
        className="h-32 p-6 flex flex-col justify-between" 
        style={{ 
          backgroundColor: hex, 
          color: textColor,
          borderBottom: hasBorder ? `1px solid ${COLORS.border}` : 'none'
        }}
      >
        <div className="flex justify-between items-start">
          <span className="font-bold text-[20px] tracking-tight">{name}</span>
          <span className="text-[13px] px-2 py-1 rounded-md font-mono font-medium tracking-wide uppercase" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
            {hex}
          </span>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-4 justify-between" style={{ backgroundColor: COLORS.surface }}>
        <p className="text-[15px] leading-[22px]" style={{ color: COLORS.inkMuted }}>{usage}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.success }}></span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.02em]" style={{ color: COLORS.ink }}>{contrast}</span>
        </div>
      </div>
    </div>
  );
}

function TypeRow({ label, specs, sample, className, fontFamily }: any) {
  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-baseline">
      <div className="w-full md:w-48 shrink-0 flex flex-col gap-1">
        <span className="text-[15px] font-bold" style={{ color: COLORS.ink }}>{label}</span>
        <span className="text-[13px] font-mono" style={{ color: COLORS.inkMuted }}>{specs}</span>
      </div>
      <div className={className} style={{ fontFamily: fontFamily || "'Plus Jakarta Sans', sans-serif", color: COLORS.ink }}>
        {sample}
      </div>
    </div>
  );
}

function ContrastRow({ bg, fg, bgName, fgName, ratio, score, warning }: any) {
  return (
    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <td className="py-4 px-6 font-medium">
        <span style={{ color: COLORS.ink }}>{fgName}</span> on <span style={{ color: COLORS.inkMuted }}>{bgName}</span>
      </td>
      <td className="py-4 px-6">
        <div className="inline-flex items-center justify-center px-4 py-2 rounded-md font-semibold text-[15px]" style={{ backgroundColor: bg, color: fg, border: bg === COLORS.surface || bg === COLORS.cream ? `1px solid ${COLORS.border}` : 'none' }}>
          Text Example
        </div>
      </td>
      <td className="py-4 px-6 font-mono text-[13px]" style={{ color: COLORS.inkMuted }}>{ratio}</td>
      <td className="py-4 px-6">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-semibold" style={{ 
          backgroundColor: warning ? '#FDF4E7' : '#E7F6EF', 
          color: warning ? COLORS.warning : COLORS.success 
        }}>
          {score}
        </span>
      </td>
    </tr>
  );
}
