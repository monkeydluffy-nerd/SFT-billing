import { cn } from "@/lib/cn";

interface SurfineMarkProps {
  className?: string;
  title?: string;
}

/** The existing Surfine Technology S+T spine mark, reduced to a reusable UI mark. */
export function SurfineMark({ className, title }: SurfineMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <rect x="18" y="7" width="64" height="12" fill="currentColor" />
      <rect x="42" y="7" width="13" height="34" fill="currentColor" />
      <path
        d="M71 27C71 15 60 8 48 8 37 8 27 15 27 24c0 9 10 14 21 18 12 4 25 9 25 22 0 13-12 22-25 22S24 79 24 68"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
