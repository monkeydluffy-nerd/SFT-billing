import { BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface StatCardProps {
  label: string;
  value: number;
  changePct?: number;
  comparable?: boolean;
  isHero?: boolean;
  periodLabel?: string;
  onHeroClick?: () => void;
  subLine?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function StatCard(props: StatCardProps) {
  const {
    label,
    value,
    changePct,
    comparable,
    isHero = false,
    periodLabel,
    onHeroClick,
    subLine,
    onClick,
  } = props;

  if (isHero) {
    const changeText = comparable && changePct !== undefined && changePct !== 0
      ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% vs previous period`
      : "";

    return (
      <button
        type="button"
        onClick={onHeroClick}
        className="relative isolate overflow-hidden flex flex-col rounded-lg border p-5 min-h-[162px] bg-gradient-to-br from-[rgb(19,35,29)] to-[rgb(18,41,31)] border-[rgb(156,122,60)/0.35] text-sidebar-ink shadow-card hover:shadow-float transition-shadow duration-micro cursor-pointer min-w-0"
        aria-label="Open billed report"
        aria-pressed={false}
        tabIndex={0}
      >
        {/* Decorative circular arcs - static, clipped by card rounded corners */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 320 200"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="300" cy="40" r="150" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.25" />
          <circle cx="300" cy="40" r="210" fill="none" stroke="rgba(212,175,106,0.22)" strokeWidth="1.25" />
          <circle cx="250" cy="210" r="140" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
        </svg>
        <div className="relative flex flex-col flex-1 z-10 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold shrink-0 truncate">
              {periodLabel}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0"
              style={{
                borderColor: "rgb(var(--color-premium) / 0.3)",
                backgroundColor: "rgb(var(--color-premium) / 0.1)",
                color: "rgb(var(--color-premium))"
              }}>
              TOTAL REVENUE
            </span>
          </div>

          <p className="mt-1.5 text-[11px] font-semibold text-gold">
            TOTAL REVENUE
          </p>

          <p className="font-tabular mt-1 font-display text-4xl sm:text-3xl md:text-4xl tracking-[-0.02em] text-sidebar-ink truncate">
            {formatCurrency(value)}
          </p>

          <div className="mt-auto pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0"
              style={{
                borderColor: "rgb(var(--color-premium) / 0.3)",
                backgroundColor: "rgb(var(--color-premium) / 0.1)",
                color: "rgb(var(--color-premium))"
              }}>
              {changeText || "+100.0% vs previous period"}
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col rounded-lg border border-border bg-surface p-5 min-h-[162px] shadow-card hover:shadow-float transition-shadow duration-micro cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-wait min-w-0"
      aria-pressed={false}
      aria-label="card"
      tabIndex={0}
      disabled={false}
    >
      <div className="flex flex-col items-center justify-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-pending-bg text-pending">
          <BarChart2 size={18} strokeWidth={1.8} aria-hidden />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink truncate">{label}</span>
      </div>

      <div className="mt-2 min-w-0" style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 400,
        fontSize: '36px',
        lineHeight: '1.1',
        letterSpacing: '-0.01em',
        fontVariantNumeric: 'lining-nums tabular-nums',
        fontFeatureSettings: '"lnum" 1, "tnum" 1',
        color: 'rgb(var(--color-ink))'
      }}>
        <span className="block truncate tabular-nums">{formatCurrency(value)}</span>
      </div>

      <div className="mt-auto text-sm text-ink-muted truncate">
        {subLine}
      </div>
    </button>
  );
}