import { Link } from "wouter";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Standard empty-state component used across the app. The audit called out
// "empty states are bare numbers" — this gives every empty list a clear
// icon, headline, supporting line, and a primary CTA so the user always
// knows what to do next.
//
// Usage:
//   <EmptyState
//     icon={Building2}
//     title="No brands yet"
//     description="Brands are how KonnectPilot remembers each business's voice. Add your first to start generating posts."
//     primaryCta={{ label: "Create your first brand", href: "/brands/new" }}
//     secondaryCta={{ label: "See how it works", href: "/features" }}
//   />

interface CtaButton {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  primaryCta?: CtaButton;
  secondaryCta?: CtaButton;
  /** "compact" reduces padding for use inside narrow side panels. */
  variant?: "default" | "compact";
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = "default",
  className,
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        isCompact ? "py-6 px-4" : "py-12 px-6",
        className,
      )}
    >
      {/* Decorative halo + icon */}
      <div className="relative mb-4">
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full bg-primary/10 blur-xl",
            isCompact ? "scale-125" : "scale-150",
          )}
        />
        <div
          className={cn(
            "relative rounded-2xl bg-primary/10 text-primary flex items-center justify-center",
            isCompact ? "w-10 h-10" : "w-14 h-14",
          )}
        >
          <Icon className={isCompact ? "w-5 h-5" : "w-6 h-6"} />
        </div>
      </div>
      <h3 className={cn("font-bold text-foreground mb-1.5", isCompact ? "text-base" : "text-lg")}>
        {title}
      </h3>
      <p
        className={cn(
          "text-muted-foreground max-w-md mb-5",
          isCompact ? "text-xs" : "text-sm",
        )}
      >
        {description}
      </p>
      {(primaryCta || secondaryCta) && (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {primaryCta && <Cta cta={primaryCta} variant="primary" />}
          {secondaryCta && <Cta cta={secondaryCta} variant="secondary" />}
        </div>
      )}
    </div>
  );
}

function Cta({ cta, variant }: { cta: CtaButton; variant: "primary" | "secondary" }) {
  const cls = cn(
    "inline-flex items-center justify-center gap-1.5 font-semibold px-4 py-2 rounded-lg text-sm transition-colors",
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
      : "border border-border text-foreground hover:bg-secondary",
  );
  const Inner = (
    <>
      {cta.icon && <cta.icon className="w-3.5 h-3.5" />}
      {cta.label}
    </>
  );
  if (cta.href) {
    return <Link href={cta.href} className={cls}>{Inner}</Link>;
  }
  return (
    <button onClick={cta.onClick} className={cls}>
      {Inner}
    </button>
  );
}
