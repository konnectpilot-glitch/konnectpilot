import { cn } from "@/lib/utils";

type KpMarkProps = {
  className?: string;
  color?: string;
  title?: string;
};

export function KpMark({ className, color = "currentColor", title }: KpMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      <path d="M76 24L20 44L45 53L76 24Z" fill={color} opacity="0.6" />
      <path d="M76 24L49 57L56 80L76 24Z" fill={color} />
    </svg>
  );
}

type KpLogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "inverse";
  className?: string;
};

const SIZE_MAP = {
  sm: { box: "w-7 h-7", mark: "w-3.5 h-3.5", text: "text-base" },
  md: { box: "w-8 h-8", mark: "w-4 h-4", text: "text-lg" },
  lg: { box: "w-10 h-10", mark: "w-5 h-5", text: "text-xl" },
} as const;

export function KpLogo({ size = "md", variant = "default", className }: KpLogoProps) {
  const s = SIZE_MAP[size];
  const isInverse = variant === "inverse";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-lg flex items-center justify-center",
          isInverse ? "bg-white/15" : "bg-primary",
          s.box
        )}
      >
        <KpMark className={s.mark} color={isInverse ? "#FFFFFF" : "#FFFFFF"} title="KonnectPilot" />
      </div>
      <span
        className={cn(
          "font-bold tracking-tight",
          isInverse ? "text-white" : "text-foreground",
          s.text
        )}
      >
        Konnect<span className={isInverse ? "text-white/90" : "text-primary"}>Pilot</span>
      </span>
    </div>
  );
}
