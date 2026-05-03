import React, { useEffect } from "react";
import { Check, X, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export function Guidelines() {
  return (
    <div 
      className="min-h-screen w-full relative"
      style={{ 
        backgroundColor: COLORS.cream, 
        color: COLORS.ink,
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        .kp-card {
          background-color: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(26,34,54,0.04), 0 8px 24px -12px rgba(26,34,54,0.08);
        }
        .kp-input {
          border-radius: 8px;
        }
        .kp-pill {
          border-radius: 999px;
        }
        .font-display { font-size: 56px; line-height: 60px; font-weight: 800; letter-spacing: -0.02em; }
        .font-h1 { font-size: 40px; line-height: 44px; font-weight: 700; letter-spacing: -0.01em; }
        .font-h2 { font-size: 28px; line-height: 32px; font-weight: 700; }
        .font-h3 { font-size: 20px; line-height: 26px; font-weight: 600; }
        .font-body-lg { font-size: 17px; line-height: 26px; font-weight: 400; }
        .font-body { font-size: 15px; line-height: 22px; font-weight: 400; }
        .font-caption { font-size: 13px; line-height: 18px; font-weight: 500; letter-spacing: 0.02em; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        .guidelines-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 24px;
        }
      `}</style>

      <div className="max-w-[1200px] mx-auto px-12 py-16 flex flex-col gap-16">
        
        {/* Section 1: Header */}
        <header className="flex flex-col gap-4 border-b pb-12" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.sky }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="white" />
              </svg>
            </div>
            <span className="font-caption uppercase tracking-wider" style={{ color: COLORS.inkMuted }}>Brand Guidelines</span>
          </div>
          <h1 className="font-display" style={{ color: COLORS.ink }}>KonnectPilot — Skyway Cockpit v1.0</h1>
          <p className="font-body-lg max-w-2xl" style={{ color: COLORS.inkMuted }}>
            A co-pilot for people who didn't sign up to be marketers. Measured, plainspoken, premium-without-being-precious.
          </p>
        </header>

        {/* Section 2: Color Usage */}
        <section className="flex flex-col gap-8">
          <h2 className="font-h2">Color Usage</h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Sky */}
            <div className="kp-card p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full" style={{ backgroundColor: COLORS.sky }}></div>
                <div>
                  <h3 className="font-h3">Use Sky for primary actions</h3>
                  <p className="font-caption font-mono" style={{ color: COLORS.inkMuted }}>#1E5BE0</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-green-600"><CheckCircle2 size={16} /></div>
                    <button className="px-4 py-2 rounded-full font-caption text-white transition-colors" style={{ backgroundColor: COLORS.sky }}>Create Post</button>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Do: Use for primary CTAs</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-red-500"><XCircle size={16} /></div>
                    <div className="w-full p-4" style={{ backgroundColor: COLORS.sky, color: 'white' }}>
                      <p className="font-body text-center">Standard background</p>
                    </div>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Don't: Use as large background areas</span>
                </div>
              </div>
            </div>

            {/* Coral */}
            <div className="kp-card p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full" style={{ backgroundColor: COLORS.coral }}></div>
                <div>
                  <h3 className="font-h3">Use Coral for moments</h3>
                  <p className="font-caption font-mono" style={{ color: COLORS.inkMuted }}>#FF8A6B</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-green-600"><CheckCircle2 size={16} /></div>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: COLORS.coral }}></div>
                    </div>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Do: Use for "what's new" markers</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-red-500"><XCircle size={16} /></div>
                    <button className="px-4 py-2 rounded-full font-caption text-white" style={{ backgroundColor: COLORS.coral }}>Submit</button>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Don't: Use for primary actions</span>
                </div>
              </div>
            </div>

            {/* Brass */}
            <div className="kp-card p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full" style={{ backgroundColor: COLORS.brass }}></div>
                <div>
                  <h3 className="font-h3">Use Brass for premium</h3>
                  <p className="font-caption font-mono" style={{ color: COLORS.inkMuted }}>#D4A24C</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-green-600"><CheckCircle2 size={16} /></div>
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: COLORS.brass }}>Pro</span>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Do: Mark premium features</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-red-500"><XCircle size={16} /></div>
                    <span className="font-h3" style={{ color: COLORS.brass }}>Error saving</span>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Don't: Use for warnings or errors</span>
                </div>
              </div>
            </div>

            {/* Cream */}
            <div className="kp-card p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.border }}></div>
                <div>
                  <h3 className="font-h3">Use Cream for canvas</h3>
                  <p className="font-caption font-mono" style={{ color: COLORS.inkMuted }}>#FFF7EE</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="h-24 rounded-lg border flex items-center justify-center relative overflow-hidden p-4" style={{ backgroundColor: COLORS.cream, borderColor: COLORS.border }}>
                    <div className="absolute top-2 left-2 text-green-600"><CheckCircle2 size={16} /></div>
                    <div className="w-full h-full rounded shadow-sm" style={{ backgroundColor: COLORS.surface }}></div>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Do: Page background behind cards</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-24 bg-white rounded-lg border border-gray-100 flex items-center justify-center relative overflow-hidden p-4">
                    <div className="absolute top-2 left-2 text-red-500"><XCircle size={16} /></div>
                    <div className="w-full h-full rounded flex items-center justify-center" style={{ backgroundColor: COLORS.cream }}>
                      <span className="text-xs">Card</span>
                    </div>
                  </div>
                  <span className="font-caption" style={{ color: COLORS.inkMuted }}>Don't: Use as card background</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Type Hierarchy */}
        <section className="flex flex-col gap-8">
          <h2 className="font-h2">Type Hierarchy</h2>
          <div className="kp-card p-8 flex flex-col gap-8">
            <div className="grid grid-cols-12 gap-4 border-b pb-8" style={{ borderColor: COLORS.border }}>
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>Display</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>56/60 • 800</span>
              </div>
              <div className="col-span-9">
                <span className="font-display">Run your social like a pro.</span>
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 border-b pb-8" style={{ borderColor: COLORS.border }}>
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>H1</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>40/44 • 700</span>
              </div>
              <div className="col-span-9">
                <span className="font-h1">Your week of posts. Planned in fifteen minutes.</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 border-b pb-8" style={{ borderColor: COLORS.border }}>
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>H2</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>28/32 • 700</span>
              </div>
              <div className="col-span-9">
                <span className="font-h2">We'll write the first draft.</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 border-b pb-8" style={{ borderColor: COLORS.border }}>
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>H3</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>20/26 • 600</span>
              </div>
              <div className="col-span-9">
                <span className="font-h3">Connect your accounts</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 border-b pb-8" style={{ borderColor: COLORS.border }}>
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>Body Large</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>17/26 • 400</span>
              </div>
              <div className="col-span-9">
                <span className="font-body-lg">Nothing scheduled yet. Start with one post — we'll handle the rest of the week.</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 border-b pb-8" style={{ borderColor: COLORS.border }}>
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>Body</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>15/22 • 400</span>
              </div>
              <div className="col-span-9">
                <span className="font-body">We couldn't connect to Instagram. Reconnecting usually fixes it.</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3 flex flex-col gap-1 justify-center">
                <span className="font-caption uppercase" style={{ color: COLORS.inkMuted }}>Caption</span>
                <span className="font-mono text-xs" style={{ color: COLORS.inkMuted }}>13/18 • 500</span>
              </div>
              <div className="col-span-9">
                <span className="font-caption uppercase">You make it sound like you.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Voice & Tone */}
        <section className="flex flex-col gap-8">
          <h2 className="font-h2">Voice & Tone</h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="kp-card p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100 text-green-700">
                  <Check size={16} />
                </div>
                <h3 className="font-h3">We sound like</h3>
              </div>
              <ul className="flex flex-col gap-4">
                <li className="font-body-lg">"Run your social like a pro. Even when you're not one."</li>
                <li className="font-body-lg">"Your week of posts. Planned in fifteen minutes."</li>
                <li className="font-body-lg">"We'll write the first draft. You make it sound like you."</li>
                <li className="font-body-lg">"Nothing scheduled yet. Start with one post."</li>
                <li className="font-body-lg">"Reconnecting usually fixes it."</li>
              </ul>
            </div>
            
            <div className="kp-card p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-700">
                  <X size={16} />
                </div>
                <h3 className="font-h3">We don't sound like</h3>
              </div>
              <ul className="flex flex-col gap-4 text-red-900/60">
                <li className="font-body-lg line-through decoration-red-500">"Supercharge your socials!"</li>
                <li className="font-body-lg line-through decoration-red-500">"Crush it on Instagram today 🔥"</li>
                <li className="font-body-lg line-through decoration-red-500">"Unleash your brand's AI-powered potential!!!"</li>
                <li className="font-body-lg line-through decoration-red-500">"Oopsie! Something went wrong 🙈"</li>
                <li className="font-body-lg line-through decoration-red-500">"Skyrocket your engagement metrics."</li>
              </ul>
            </div>
          </div>

          <div className="kp-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: COLORS.cream, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="font-caption p-4" style={{ color: COLORS.inkMuted }}>Situation</th>
                  <th className="font-caption p-4" style={{ color: COLORS.inkMuted }}>Yes</th>
                  <th className="font-caption p-4" style={{ color: COLORS.inkMuted }}>No</th>
                </tr>
              </thead>
              <tbody className="font-body">
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td className="p-4 font-medium">Welcoming new user</td>
                  <td className="p-4">"Welcome aboard. Let's set up your first week."</td>
                  <td className="p-4" style={{ color: COLORS.inkMuted }}>"Welcome! Ready to crush your goals???"</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td className="p-4 font-medium">Reporting a small win</td>
                  <td className="p-4">"Your post is live."</td>
                  <td className="p-4" style={{ color: COLORS.inkMuted }}>"Success! Your post has been unleashed to the world!"</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Reporting an error</td>
                  <td className="p-4">"We couldn't connect to Instagram. Reconnecting usually fixes it."</td>
                  <td className="p-4" style={{ color: COLORS.inkMuted }}>"Uh oh! Our AI-powered system hit a snag."</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Accessibility */}
        <section className="flex flex-col gap-8">
          <h2 className="font-h2">Accessibility Standards</h2>
          <div className="kp-card p-8 grid grid-cols-4 gap-8">
            <div className="flex flex-col gap-2">
              <div className="h-12 flex items-center">
                <span className="font-h2" style={{ color: COLORS.success }}>AA</span>
              </div>
              <h4 className="font-caption uppercase">Contrast</h4>
              <p className="font-body text-sm" style={{ color: COLORS.inkMuted }}>All text meets WCAG AA minimum contrast ratios.</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-12 flex items-center px-4 py-2 self-start rounded-md border-2" style={{ borderColor: COLORS.sky, backgroundColor: COLORS.cream }}>
                <span className="font-caption">Focus Ring</span>
              </div>
              <h4 className="font-caption uppercase">Focus States</h4>
              <p className="font-body text-sm" style={{ color: COLORS.inkMuted }}>2px Sky outer + 2px Cream inner ring on all interactive elements.</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-12 flex items-center">
                <div className="w-11 h-11 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                  <span className="font-mono text-xs">44</span>
                </div>
              </div>
              <h4 className="font-caption uppercase">Touch Targets</h4>
              <p className="font-body text-sm" style={{ color: COLORS.inkMuted }}>All interactive targets are ≥ 44×44px minimum.</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-12 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.error }}></span>
                <span className="font-caption text-red-700">Error text</span>
              </div>
              <h4 className="font-caption uppercase">Color Independence</h4>
              <p className="font-body text-sm" style={{ color: COLORS.inkMuted }}>Color is never the only signal. Icons and text accompany status colors.</p>
            </div>
          </div>
        </section>

        {/* Section 6: Sample Assets */}
        <section className="flex flex-col gap-8">
          <h2 className="font-h2">Sample Assets</h2>
          <div className="grid grid-cols-12 gap-8">
            
            {/* Social Card */}
            <div className="col-span-5">
              <div className="kp-card aspect-square p-8 flex flex-col justify-between" style={{ backgroundColor: COLORS.cream }}>
                <div className="flex justify-between items-start">
                  <span className="font-caption font-bold" style={{ color: COLORS.sky }}>@konnectpilot</span>
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: COLORS.sky100 }}></div>
                </div>
                <div>
                  <h3 className="font-h2 mb-4" style={{ color: COLORS.ink }}>Social media, sorted.</h3>
                  <p className="font-body" style={{ color: COLORS.inkMuted }}>Plan your entire week in fifteen minutes.</p>
                </div>
              </div>
              <p className="font-caption mt-4 text-center" style={{ color: COLORS.inkMuted }}>Social Card (Instagram Square)</p>
            </div>

            {/* Business Cards & Signature */}
            <div className="col-span-7 flex flex-col gap-8">
              
              <div className="flex gap-4">
                {/* Biz Card Front */}
                <div className="w-[350px] h-[200px] kp-card flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.cream }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: COLORS.sky }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="white" />
                      </svg>
                    </div>
                    <span className="font-h3 tracking-tight">KonnectPilot</span>
                  </div>
                </div>

                {/* Biz Card Back */}
                <div className="w-[350px] h-[200px] kp-card flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.sky, borderColor: COLORS.sky }}>
                  <span className="font-body text-white">Your co-pilot for social. — konnectpilot.com</span>
                </div>
              </div>
              <p className="font-caption text-center w-[716px]" style={{ color: COLORS.inkMuted }}>Business Cards</p>

              {/* Email Signature */}
              <div className="kp-card p-6 mt-4 max-w-[400px]">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="font-body font-bold" style={{ color: COLORS.ink }}>Sarah Jenkins</p>
                    <p className="font-caption" style={{ color: COLORS.inkMuted }}>Head of Product</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: COLORS.sky }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="white" />
                      </svg>
                    </div>
                    <span className="font-caption font-bold tracking-tight">KonnectPilot</span>
                  </div>

                  <div className="w-full h-px my-1" style={{ backgroundColor: COLORS.border }}></div>
                  
                  <div className="flex gap-4 font-caption" style={{ color: COLORS.sky }}>
                    <a href="#" className="hover:underline">konnectpilot.com</a>
                    <a href="#" className="hover:underline">LinkedIn</a>
                  </div>
                </div>
              </div>
              <p className="font-caption" style={{ color: COLORS.inkMuted }}>Email Signature</p>

            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t flex justify-between" style={{ borderColor: COLORS.border, color: COLORS.inkMuted }}>
          <span className="font-caption">© ClicknKonnect 2026 — Skyway Cockpit identity system.</span>
          <span className="font-caption">Questions? <a href="mailto:brand@clicknkonnect.com" style={{ color: COLORS.sky }}>brand@clicknkonnect.com</a></span>
        </footer>

      </div>
    </div>
  );
}
