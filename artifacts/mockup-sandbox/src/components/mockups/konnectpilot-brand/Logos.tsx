import React, { useEffect } from 'react';

const COLORS = {
  sky: '#1E5BE0',
  sky600: '#1A4FC4',
  sky100: '#E5EDFE',
  coral: '#FF8A6B',
  brass: '#D4A24C',
  cream: '#FFF7EE',
  surface: '#FFFFFF',
  ink: '#1A2236',
  inkMuted: '#5A6478',
  border: '#F0E6D6',
};

const LogoIcon = ({ color = COLORS.sky, size = 32, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M76 24L20 44L45 53L76 24Z" fill={color} opacity="0.6"/>
    <path d="M76 24L49 57L56 80L76 24Z" fill={color} />
  </svg>
);

const LogoWordmark = ({ color = COLORS.ink, size = 32, className = "" }) => {
  const scale = size / 32;
  return (
    <div style={{ fontSize: `${1.75 * scale}rem`, lineHeight: 1, color, fontWeight: 700, letterSpacing: '-0.03em' }} className={className}>
      Konnect<span style={{ color: color === COLORS.ink ? COLORS.sky : color }}>Pilot</span>
    </div>
  );
};

const Lockup = ({ color = COLORS.sky, textColor = COLORS.ink, size = 32, className = "" }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <LogoIcon color={color} size={size} />
    <LogoWordmark color={textColor} size={size} />
  </div>
);

export function Logos() {
  return (
    <div className="min-h-[100dvh] font-['Plus_Jakarta_Sans']" style={{ backgroundColor: COLORS.cream, color: COLORS.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div className="max-w-[1200px] mx-auto px-12 py-16 flex flex-col gap-16">
        
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <LogoIcon size={40} />
            <h1 className="text-[40px] font-bold tracking-tight text-ink" style={{ color: COLORS.ink }}>KonnectPilot</h1>
          </div>
          <p className="text-[17px] leading-[26px] max-w-2xl" style={{ color: COLORS.inkMuted }}>
            Brand Kit / Logo Concepts. The "Skyway Cockpit" theme pairs a reliable, measured visual language with subtle flight motifs. The paper-plane/arrow icon represents momentum and guidance.
          </p>
        </header>

        <div className="flex flex-col gap-12 border-t" style={{ borderColor: COLORS.border, borderTopWidth: 1 }}>
          
          {/* 1, 2, 3: Primary Lockups */}
          <section className="pt-12 flex flex-col gap-6">
            <h2 className="text-[20px] font-semibold" style={{ color: COLORS.ink }}>1. Primary Lockups</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-[16px] p-12 flex items-center justify-center border" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.border }}>
                <Lockup size={40} />
              </div>
              <div className="rounded-[16px] p-12 flex items-center justify-center" style={{ backgroundColor: COLORS.sky }}>
                <Lockup size={40} color={COLORS.surface} textColor={COLORS.surface} />
              </div>
              <div className="rounded-[16px] p-12 flex items-center justify-center" style={{ backgroundColor: '#0F1422' }}>
                <Lockup size={40} color={COLORS.surface} textColor={COLORS.surface} />
              </div>
            </div>
          </section>

          {/* 4 & 5: Isolated Marks */}
          <section className="pt-12 border-t flex flex-col gap-6" style={{ borderColor: COLORS.border, borderTopWidth: 1 }}>
            <h2 className="text-[20px] font-semibold" style={{ color: COLORS.ink }}>2. Isolated Marks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-[16px] p-16 flex flex-col items-center justify-center gap-6 border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <span className="text-[13px] font-medium uppercase tracking-widest" style={{ color: COLORS.inkMuted }}>Icon Only</span>
                <LogoIcon size={160} />
              </div>
              <div className="rounded-[16px] p-16 flex flex-col items-center justify-center gap-6 border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <span className="text-[13px] font-medium uppercase tracking-widest" style={{ color: COLORS.inkMuted }}>Wordmark Only</span>
                <LogoWordmark size={64} />
              </div>
            </div>
          </section>

          {/* 6, 7, 8: Specific Formats */}
          <section className="pt-12 border-t flex flex-col gap-6" style={{ borderColor: COLORS.border, borderTopWidth: 1 }}>
            <h2 className="text-[20px] font-semibold" style={{ color: COLORS.ink }}>3. Specific Formats</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              
              {/* Monogram */}
              <div className="rounded-[16px] p-12 flex flex-col items-center justify-center gap-6 border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <span className="text-[13px] font-medium uppercase tracking-widest text-center" style={{ color: COLORS.inkMuted }}>Monogram<br/>(Tight Spaces)</span>
                <div className="w-[120px] h-[120px] rounded-[22%] flex items-center justify-center" style={{ backgroundColor: COLORS.sky100 }}>
                  <span className="text-[48px] font-bold tracking-tight" style={{ color: COLORS.sky }}>KP</span>
                </div>
              </div>

              {/* Favicon Test */}
              <div className="rounded-[16px] p-8 flex flex-col items-center justify-start gap-6 border overflow-hidden" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.border }}>
                <span className="text-[13px] font-medium uppercase tracking-widest text-center" style={{ color: COLORS.inkMuted }}>Favicon<br/>(32×32)</span>
                <div className="w-full rounded-t-lg border-x border-t flex flex-col mt-4" style={{ backgroundColor: '#DFE1E5', borderColor: '#C8CACD' }}>
                  <div className="h-8 flex items-end px-2 gap-2 mt-2">
                    <div className="h-7 w-48 rounded-t-md flex items-center px-3 gap-2" style={{ backgroundColor: '#FFFFFF' }}>
                      <LogoIcon size={16} />
                      <span className="text-[11px] font-medium truncate" style={{ color: '#3C4043' }}>KonnectPilot | Dashboard</span>
                    </div>
                  </div>
                  <div className="h-10 border-t flex items-center px-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8EAED' }}>
                    <div className="h-6 rounded-full w-full opacity-50" style={{ backgroundColor: '#F1F3F4' }} />
                  </div>
                </div>
              </div>

              {/* App Icon */}
              <div className="rounded-[16px] p-12 flex flex-col items-center justify-center gap-6 border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <span className="text-[13px] font-medium uppercase tracking-widest text-center" style={{ color: COLORS.inkMuted }}>App Icon<br/>(iOS 22% Radius)</span>
                <div className="w-[120px] h-[120px] rounded-[22%] flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${COLORS.sky}, #0F3BA0)` }}>
                  <LogoIcon size={64} color={COLORS.surface} />
                </div>
              </div>

            </div>
          </section>

          {/* 9: Single-color / Reversed */}
          <section className="pt-12 border-t flex flex-col gap-6" style={{ borderColor: COLORS.border, borderTopWidth: 1 }}>
            <h2 className="text-[20px] font-semibold" style={{ color: COLORS.ink }}>4. Single-Color / Reversed (Flat)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-[16px] p-8 flex items-center justify-center border" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.border }}>
                <Lockup size={24} color={COLORS.ink} textColor={COLORS.ink} />
              </div>
              <div className="rounded-[16px] p-8 flex items-center justify-center" style={{ backgroundColor: COLORS.ink }}>
                <Lockup size={24} color={COLORS.surface} textColor={COLORS.surface} />
              </div>
              <div className="rounded-[16px] p-8 flex items-center justify-center border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <Lockup size={24} color={COLORS.sky} textColor={COLORS.sky} />
              </div>
            </div>
          </section>

          {/* 10: Clear Space & Min Size */}
          <section className="pt-12 border-t flex flex-col gap-6" style={{ borderColor: COLORS.border, borderTopWidth: 1 }}>
            <h2 className="text-[20px] font-semibold" style={{ color: COLORS.ink }}>5. Clear Space & Minimum Size</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="rounded-[16px] p-16 flex items-center justify-center border relative" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <div className="relative">
                  {/* Clear space markers */}
                  <div className="absolute -top-8 -left-8 -right-8 -bottom-8 border border-dashed border-sky/30 flex items-center justify-center">
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-mono text-sky/60 font-medium tracking-wide">X</span>
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-mono text-sky/60 font-medium tracking-wide">X</span>
                    <span className="absolute top-1/2 -translate-y-1/2 -left-6 text-[11px] font-mono text-sky/60 font-medium tracking-wide">X</span>
                    <span className="absolute top-1/2 -translate-y-1/2 -right-6 text-[11px] font-mono text-sky/60 font-medium tracking-wide">X</span>
                  </div>
                  <Lockup size={48} />
                </div>
              </div>

              <div className="rounded-[16px] p-16 flex flex-col items-center justify-center gap-8 border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                <Lockup size={24} />
                <div className="flex flex-col items-center gap-2">
                  <div className="h-[1px] w-24 bg-sky/30 relative">
                    <div className="absolute -top-1 -bottom-1 left-0 w-[1px] bg-sky/50"></div>
                    <div className="absolute -top-1 -bottom-1 right-0 w-[1px] bg-sky/50"></div>
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: COLORS.inkMuted }}>Minimum Height: 24px</span>
                </div>
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
