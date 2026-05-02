import MarketingShell from "@/components/marketing-shell";
import { Link } from "wouter";
import { ArrowRight, Mail } from "lucide-react";

const VALUES = [
  { title: "Build for the user, not the demo", text: "Every feature has to earn its place by saving real time for real customers." },
  { title: "Honest pricing, no surprises", text: "No silent overages, no dark patterns. The price you see is what you pay." },
  { title: "AI as an assistant, not a replacement", text: "We give you superpowers — you stay in the driver's seat of your brand voice." },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight leading-[1.05] mb-5">
          We help small teams<br />
          <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-500 bg-clip-text text-transparent">
            show up consistently.
          </span>
        </h1>
        <p className="text-lg text-muted-foreground">
          KonnectPilot is built by ClicknKonnect — a small team obsessed with making social media less of a daily grind for the people who don't have a dedicated marketer.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {[
            { v: "3", l: "Connected platforms today" },
            { v: "100%", l: "Customer-funded — no VCs" },
            { v: "1", l: "Subscription, no add-ons" },
          ].map((s) => (
            <div key={s.l} className="bg-card border border-border rounded-xl p-4 sm:p-5 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary">{s.v}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 prose prose-neutral dark:prose-invert">
        <h2 className="text-2xl font-bold text-foreground mb-3">Why we built this</h2>
        <p className="text-muted-foreground mb-4">
          Most scheduling tools feel like spreadsheets with a calendar bolted on. Most AI tools feel like party tricks. We wanted one place where you could plan a month, generate the content, schedule it across every account, and actually understand what worked.
        </p>
        <p className="text-muted-foreground mb-8">
          That's KonnectPilot. Built for solo creators, small businesses, and the agencies who serve them.
        </p>

        <h2 className="text-2xl font-bold text-foreground mb-4">What we believe</h2>
        <div className="space-y-3 not-prose">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-1">{v.title}</h3>
              <p className="text-sm text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <Mail className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-2">Get in touch</h2>
          <p className="text-muted-foreground mb-5">
            Feedback, partnership ideas, press — we read everything.
          </p>
          <a
            href="mailto:hello@konnectpilot.com"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 text-sm"
          >
            hello@konnectpilot.com
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-primary rounded-2xl px-8 py-10 text-center">
          <h2 className="text-2xl font-bold text-primary-foreground mb-3">Try KonnectPilot free for 7 days</h2>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg hover:bg-white/90"
          >
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
