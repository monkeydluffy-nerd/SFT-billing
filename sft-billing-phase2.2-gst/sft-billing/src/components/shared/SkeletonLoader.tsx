import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

/** A single skeleton block. Compose these to match the final layout's shape — never a generic centered spinner. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-border", className)} />;
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading overview">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
