import { SurfineMark } from "./SurfineMark";
import { cn } from "@/lib/cn";

interface SurfineLogoProps {
  className?: string;
  size?: number;
}

/**
 * Surfine Technology logo with the mark and wordmark.
 * Uses the same deep forest green and warm ivory colors as the sidebar.
 */
export function SurfineLogo({ className, size = 28 }: SurfineLogoProps) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex items-center gap-2">
        <SurfineMark className={cn("text-premium", `h-${size} w-${size}`)} title="Surfine Technology" />
        <span className="font-display text-[18px] font-medium text-ink tracking-tight leading-none">
          Surfine Technology
        </span>
      </div>
    </div>
  );
}