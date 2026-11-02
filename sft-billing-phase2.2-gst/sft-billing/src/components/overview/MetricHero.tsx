import { useRef } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useCountUp } from "@/hooks/useCountUp";

interface MetricHeroProps {
  periodLabel: string;
  amount: number;
  changePct: number;
  onClick: () => void;
  sparklinePath?: string;
  hasEnoughData?: boolean;
  isLoading?: boolean;
  finalValue?: number;
  label?: string;
  /** Billed amount for the period */
  billed?: number;
  /** Received amount for the period */
  received?: number;
  /** Whether there's a comparable previous period */
  comparable?: boolean;
}

/** The primary financial summary card — Billed this period with collection bar. */
export function MetricHero({
  periodLabel,
  amount,
  changePct,
  onClick,
  sparklinePath,
  hasEnoughData = false,
  isLoading = false,
  finalValue,
  label = "Billed",
  billed = 0,
  received = 0,
  comparable = false,
}: MetricHeroProps) {
  const { value: animatedValue, isComplete } = useCountUp(
    finalValue ?? amount,
    800,
    0
  );
  const isHeroComplete = !isLoading && isComplete;
  const isUp = changePct >= 0;
  const collectionPct = billed > 0 ? (received / billed) * 100 : 0;

  // Generate points for sparkline animation
  const points = useRef([
    { x: 0, y: 20 },
    { x: 20, y: 18 },
    { x: 40, y: 22 },
    { x: 60, y: 17 },
    { x: 80, y: 19 },
    { x: 100, y: 16 },
    { x: 120, y: 18 },
    { x: 140, y: 15 },
  ]).current;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative isolate hero-billed overflow-hidden flex min-h-[150px] w-full flex-col rounded-lg border p-5 shadow-card sm:p-6 stagger-card card-hover"
      aria-label={`Open ${label.toLowerCase()} report`}
    >
      {/* Hero sweep effect */}
      <div className="hero-sweep" aria-hidden="true" />

      <div className="relative flex flex-col flex-1 z-10">
        {/* Top row: period label left, badge right */}
        <div className="flex items-center justify-between gap-4">
          <p className="hero-billed-label text-[10px] font-semibold uppercase tracking-[0.2em] shrink-0">
            {periodLabel}
          </p>
          {/* Trend badge */}
          <div className="hero-billed-badge shrink-0 inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium">
            {comparable ? (
              <>
                {isUp ? <TrendingUp size={10} aria-hidden /> : <TrendingDown size={10} aria-hidden />}
                {formatPercent(changePct)}
              </>
            ) : (
              <span title="No earlier period to compare">New</span>
            )}
          </div>
        </div>

        {/* Label */}
        <p className="hero-billed-label mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
          {label}
        </p>

        {/* Large value */}
        <p className="font-tabular mt-1 font-display text-3xl tracking-[-0.02em] sm:text-4xl hero-billed-value">
          {isLoading ? "—" : formatCurrency(animatedValue)}
        </p>

        {/* Collection bar */}
        <div className="mt-3">
          <div className="hero-collection-bar h-6 w-full max-w-xs rounded-full overflow-hidden border" style={{ background: "rgba(255,255,255,0.18)", borderColor: "rgb(var(--color-premium) / 0.3)" }}>
            <div
              className="hero-collection-fill h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(collectionPct, 100)}%`, background: "rgb(var(--color-premium))" }}
            />
          </div>
          <p className="hero-billed-sub mt-1 text-xs" style={{ color: "rgb(var(--color-sidebar-muted))" }}>
            {billed > 0
              ? `${collectionPct.toFixed(1)}% collected`
              : "n/a"}
          </p>
        </div>

        {/* Sparkline at bottom right */}
        <div className="mt-auto pt-2 flex items-end justify-end" aria-hidden="true" role="img" aria-label={`${label} trend over 12 months`}>
          <div className="w-32 h-12" style={{ minWidth: "80px" }}>
            {hasEnoughData && sparklinePath ? (
              <svg viewBox="0 0 140 40" className="w-full h-full" fill="none" aria-hidden="true">
                <path
                  d={sparklinePath}
                  stroke="rgb(var(--color-premium))"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="hero-sparkline"
                  style={{
                    strokeDasharray: "1000",
                    strokeDashoffset: isHeroComplete ? 0 : 1000,
                    transition: isHeroComplete ? "stroke-dashoffset 900ms ease-out" : "none",
                  }}
                />
                {hasEnoughData && isHeroComplete && (
                  <>
                    <circle
                      cx={points[points.length - 1].x}
                      cy={points[points.length - 1].y}
                      r={3}
                      fill="rgb(var(--color-premium))"
                      className="pulse-ring"
                    />
                  </>
                )}
              </svg>
            ) : (
              <svg viewBox="0 0 140 40" className="w-full h-full" fill="none" aria-hidden="true">
                <line x1={4} y1={20} x2={136} y2={20} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />
              </svg>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}