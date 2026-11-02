import type { LucideIcon } from "lucide-react";
import { TrendingUp, AlertTriangle, Activity } from "lucide-react";
import type { Signal, SignalTone } from "@/lib/intelligence";
import { cn } from "@/lib/cn";

const TONE_CONFIG: Record<SignalTone, { icon: LucideIcon; classes: string }> = {
  positive: { icon: TrendingUp, classes: "bg-success-bg text-success" },
  caution: { icon: AlertTriangle, classes: "bg-caution-bg text-caution" },
  neutral: { icon: Activity, classes: "bg-neutral-bg text-neutral" },
};

interface SignalCardProps {
  signal: Signal;
}

/**
 * One data-derived insight — every SignalCard traces back to a specific
 * computation in lib/intelligence.ts (see computeSignals). Never a
 * decorative "AI insight" with no real basis; if computeSignals didn't
 * produce it, it doesn't render.
 */
export function SignalCard({ signal }: SignalCardProps) {
  const { icon: Icon, classes } = TONE_CONFIG[signal.tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", classes)}>
          <Icon size={15} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{signal.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{signal.detail}</p>
        </div>
      </div>
    </div>
  );
}
