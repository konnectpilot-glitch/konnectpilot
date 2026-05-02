import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Zap, ArrowRight, Menu, X } from "lucide-react";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/affiliate-program", label: "Affiliate" },
  { href: "/about", label: "About" },
];

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">KonnectPilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              Start free trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-foreground hover:bg-secondary"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-secondary"
                >
                  {n.label}
                </Link>
              ))}
              <div className="pt-3 mt-3 border-t border-border space-y-2">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-secondary"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="block text-center bg-primary text-primary-foreground px-3 py-2.5 rounded-lg text-sm font-semibold"
                >
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-10 mt-16 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-foreground">KonnectPilot</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
              Pilot your content. Grow on autopilot. Built by ClicknKonnect for solo creators, small businesses, and the agencies who serve them.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wide">Product</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/affiliate-program" className="hover:text-foreground">Affiliate program</Link></li>
              <li><Link href="/sign-up" className="hover:text-foreground">Start free trial</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wide">Company</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><a href="mailto:hello@konnectpilot.com" className="hover:text-foreground">Contact</a></li>
              <li><a href="mailto:sales@konnectpilot.com" className="hover:text-foreground">Sales</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wide">Legal</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/legal/terms" className="hover:text-foreground">Terms</Link></li>
              <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-foreground">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ClicknKonnect. All rights reserved.</p>
          <p>Made with care for the daily-poster.</p>
        </div>
      </footer>
    </div>
  );
}
