import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface MetricHeroProps {
  periodLabel: string;
  amount: number;
  changePct: number;
  onClick: () => void;
}

/** The primary financial summary card — deliberately stronger than the status cards beside it. */
export function MetricHero({ periodLabel, amount, changePct, onClick }: MetricHeroProps) {
  const isUp = changePct >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative isolate flex min-h-[222px] w-full flex-col justify-between overflow-hidden rounded-lg border border-sidebar-border bg-sidebar p-6 text-left text-sidebar-ink shadow-card sm:p-7"
      aria-label="Open revenue report"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-premium/20" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-8 h-52 w-52 rounded-full border border-sidebar-ink/10" />

      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-premium">{periodLabel}</p>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">Total Revenue</p>
        <p className="font-tabular mt-2 font-display text-4xl tracking-[-0.02em] text-sidebar-ink sm:text-[2.75rem]">
          {formatCurrency(amount)}
        </p>
      </div>

      <div className="relative mt-6 flex items-center justify-between gap-3">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium",
            isUp ? "border-sidebar-border bg-sidebar-ink/10 text-sidebar-ink" : "border-overdue/30 bg-overdue/10 text-overdue",
          )}
        >
          {isUp ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
          {formatPercent(changePct)}
        </div>
        <span className="text-right text-[11px] text-sidebar-muted">vs previous period</span>
      </div>
    </button>
  );
}
