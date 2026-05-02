import { Link } from "wouter";
import { Zap, ArrowRight } from "lucide-react";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/affiliate-program", label: "Affiliate" },
  { href: "/about", label: "About" },
];

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">KonnectPilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
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
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Start free trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-4 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="font-semibold text-foreground">KonnectPilot</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Pilot your content. Grow on autopilot.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Product</h4>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/affiliate-program" className="hover:text-foreground">Affiliate</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Company</h4>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><a href="mailto:hello@konnectpilot.com" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Legal</h4>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href="/legal/terms" className="hover:text-foreground">Terms</Link></li>
              <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-foreground">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} ClicknKonnect. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
