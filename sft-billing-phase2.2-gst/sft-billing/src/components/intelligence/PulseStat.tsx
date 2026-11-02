import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface PulseStatProps {
  label: string;
  amount?: number;
  display?: string;
  /** A timeframe/context line - every stat must say what window it covers, never a bare number. */
  timeframe: string;
  changePct?: number;
  changeLabel?: string;
  /** True when a comparison was attempted but there's no genuine baseline to compare against - renders a neutral "Comparison unavailable" line instead of silently omitting the trend row. Never set alongside changePct. */
  comparisonUnavailable?: boolean;
  tone?: "default" | "caution";
  icon?: LucideIcon;
}

/**
 * A single Business Pulse figure - deliberately plainer than a
 * dashboard "KPI card": no big colored block, no icon badge unless the
 * figure has a genuine trend to show. Every stat carries an explicit
 * `timeframe` string so nothing reads as a bare, ambiguous number. When
 * a period comparison genuinely can't be made, that's stated outright
 * (`comparisonUnavailable`) rather than just leaving the trend row
 * blank, which is what "show a neutral state instead of a misleading
 * percentage" requires - silence still lets a reader assume "flat", an
 * explicit "unavailable" doesn't. Pass either `amount` (formatted as
 * currency) or `display` (a pre-formatted string, e.g. a count) - never
 * both.
 */
export function PulseStat({
  label,
  amount,
  display,
  timeframe,
  changePct,
  changeLabel,
  comparisonUnavailable,
  tone = "default",
  icon: Icon,
}: PulseStatProps) {
  const trendIcon = changePct === undefined ? null : changePct > 0.5 ? TrendingUp : changePct < -0.5 ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const value = display ?? (amount !== undefined ? formatCurrency(amount) : "");

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {Icon && <Icon size={13} className="text-ink-faint" aria-hidden />}
        {label}
      </p>
      <p className={cn("font-tabular mt-1.5 text-xl text-ink", tone === "caution" && (amount ?? 0) > 0 && "text-overdue")}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-faint">{timeframe}</p>
      {changePct !== undefined && TrendIcon && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            changePct > 0.5 ? "text-success" : changePct < -0.5 ? "text-overdue" : "text-ink-faint",
          )}
        >
          <TrendIcon size={12} aria-hidden />
          {formatPercent(changePct)} {changeLabel ?? ""}
        </p>
      )}
      {comparisonUnavailable && <p className="mt-1 text-xs text-ink-faint">Comparison unavailable</p>}
    </div>
  );
}