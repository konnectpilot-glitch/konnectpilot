import { Link } from "wouter";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-4 py-12">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <Compass className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
          404 · Page not found
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">
          We couldn't find that page.
        </h1>
        <p className="text-muted-foreground mb-8">
          The link may be broken or the page may have moved. Let's get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 border border-border bg-card text-foreground font-semibold px-5 py-2.5 rounded-lg hover:bg-secondary transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
