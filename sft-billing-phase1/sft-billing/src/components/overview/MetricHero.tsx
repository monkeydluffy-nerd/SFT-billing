import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface MetricHeroProps {
  periodLabel: string;
  amount: number;
  changePct: number;
}

/**
 * The verdict row (blueprint §4.1). Set in the display serif at the
 * largest size on the page — this is the one thing a person should be
 * able to read from across the room and know where the business stands.
 */
export function MetricHero({ periodLabel, amount, changePct }: MetricHeroProps) {
  const isUp = changePct >= 0;
  return (
    <div>
      <p className="text-sm font-medium text-ink-muted">{periodLabel}</p>
      <p className="font-tabular mt-2 font-display text-hero-lg text-ink">{formatCurrency(amount)}</p>
      <p className="text-sm text-ink-muted">Total revenue</p>
      <div
        className={cn(
          "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium",
          isUp ? "bg-success-bg text-success" : "bg-overdue-bg text-overdue",
        )}
      >
        {isUp ? <ArrowUpRight size={15} aria-hidden /> : <ArrowDownRight size={15} aria-hidden />}
        {formatPercent(changePct)} from previous period
      </div>
    </div>
  );
}
