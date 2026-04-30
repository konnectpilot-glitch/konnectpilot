import { Link } from "wouter";
import { Zap, Check, ArrowRight, Facebook, Instagram, Linkedin, Clock, Bot, BarChart3 } from "lucide-react";
import { useListPlans } from "@workspace/api-client-react";

const features = [
  {
    icon: Bot,
    title: "AI-Written Content",
    description: "OpenAI GPT-4 writes platform-specific posts tailored to your brand voice, industry, and audience.",
  },
  {
    icon: Clock,
    title: "Set It and Forget It",
    description: "Configure your brands once. KonnectPilot handles daily content generation and publishing automatically.",
  },
  {
    icon: BarChart3,
    title: "Multi-Platform",
    description: "One tool to manage Facebook, Instagram, and LinkedIn for all your brands.",
  },
];

export default function LandingPage() {
  const { data: plans } = useListPlans();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">KonnectPilot</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" />
          AI-Powered Social Media Automation
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
          Post daily on every platform
          <span className="text-primary block">without lifting a finger</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          KonnectPilot uses OpenAI GPT-4 to write, illustrate, and publish platform-specific social media content for your brands every single day — automatically.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors">
            Start free today
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/sign-in" className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-semibold px-6 py-3 rounded-lg hover:bg-secondary transition-colors">
            Sign in
          </Link>
        </div>

        {/* Platform logos */}
        <div className="flex items-center justify-center gap-6 text-muted-foreground">
          <div className="flex items-center gap-1.5 text-sm">
            <Facebook className="w-5 h-5 text-blue-600" />
            <span>Facebook</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Instagram className="w-5 h-5 text-pink-600" />
            <span>Instagram</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Linkedin className="w-5 h-5 text-blue-700" />
            <span>LinkedIn</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-10">
          Everything you need to stay consistent
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-3">Simple, transparent pricing</h2>
        <p className="text-center text-muted-foreground mb-10">Start free, upgrade when you're ready</p>

        <div className="grid md:grid-cols-3 gap-6">
          {(plans ?? [
            { id: "starter", name: "Starter", price: 19, features: ["1 brand", "4 platforms", "Daily AI posts", "Post history"], brandLimit: 1 },
            { id: "pro", name: "Pro", price: 49, features: ["5 brands", "All platforms", "Custom posting time", "Analytics"], brandLimit: 5 },
            { id: "agency", name: "Agency", price: 99, features: ["Unlimited brands", "White-label reports", "Priority support", "Team access"], brandLimit: null },
          ]).map((plan, i) => (
            <div
              key={plan.id}
              className={`relative bg-card border rounded-xl p-6 ${i === 1 ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border"}`}
            >
              {i === 1 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>
                </div>
              )}
              <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`block text-center font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm ${
                  i === 1
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-primary rounded-2xl px-8 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3">
            Ready to automate your social media?
          </h2>
          <p className="text-primary-foreground/80 mb-6 max-w-lg mx-auto">
            Join hundreds of businesses posting consistently without the daily grind.
          </p>
          <Link href="/sign-up" className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg hover:bg-white/90 transition-colors">
            Start for free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium">KonnectPilot</span>
            <span>by ClicknKonnect</span>
          </div>
          <p>© 2026 ClicknKonnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
