import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Dot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyRevenuePoint } from "@/lib/overviewMetrics";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import { BarChart2 } from "lucide-react";

interface RevenueChartProps {
  series: MonthlyRevenuePoint[];
}

function formatAxisLabel(value: number): string {
  if (value >= 100000) {
    return `Rs ${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `Rs ${(value / 1000).toFixed(1)}K`;
  }
  return `Rs ${value}`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthlyRevenuePoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border-strong bg-surface px-3 py-2 shadow-card">
      <p className="text-xs text-ink-muted">{point.label}</p>
      <p className="font-tabular mt-0.5 text-sm font-medium text-ink">{formatCurrency(point.revenue)}</p>
    </div>
  );
}

export function RevenueChart({ series }: RevenueChartProps) {
  const [period, setPeriod] = useState<"6M" | "12M">("12M");

  const hasRevenueData = useMemo(() => series.some((point) => point.revenue > 0), [series]);

  const firstDataIndex = useMemo(() => {
    return series.findIndex((point) => point.revenue > 0);
  }, [series]);

  const data = useMemo(() => {
    let startIdx = Math.max(0, firstDataIndex);
    const endIdx = series.length;

    if (period === "6M") {
      startIdx = Math.max(0, series.length - 6);
    }

    if (endIdx - startIdx < 3) {
      startIdx = Math.max(0, endIdx - 3);
    }

    return series.slice(startIdx, endIdx);
  }, [series, period, firstDataIndex]);

  const latestPoint = data[data.length - 1];

  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card" aria-labelledby="revenue-trend-title">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 size={18} strokeWidth={1.8} className="text-premium" aria-hidden />
            <h2 id="revenue-trend-title" className="font-display text-xl text-ink">Revenue trend</h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Collected revenue over the selected period</p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs">
          {(["6M", "12M"] as ("6M" | "12M")[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors duration-micro",
                period === p ? "bg-accent text-accent-ink" : "bg-surface text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {p === "6M" ? "6 months" : "12 months"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 h-72 w-full min-w-0 relative">
        {!hasRevenueData ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-surface/50">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m19 9-5 5-4-4-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg text-ink">No revenue data yet</p>
              <p className="mt-1 text-sm text-ink-muted">Payments received will appear here once recorded</p>
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--color-premium))" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="rgb(var(--color-premium))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="rgb(var(--color-border) / 0.72)"
                  strokeDasharray="2 6"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgb(var(--color-ink-faint))", fontSize: 12 }}
                  interval="preserveStartEnd"
                  dy={8}
                  tickFormatter={(v: string) => v}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tick={{ fill: "rgb(var(--color-ink-faint))", fontSize: 12 }}
                  tickFormatter={formatAxisLabel}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "rgb(var(--color-border-strong))", strokeDasharray: "3 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="rgb(var(--color-premium))"
                  strokeWidth={2.25}
                  fill="url(#revenueFill)"
                  isAnimationActive={false}
                  animationDuration={0}
                >
                  <Dot
                    r={5}
                    strokeWidth={2}
                    stroke="rgb(var(--color-premium))"
                    fill="rgb(var(--color-premium))"
                    className="latest-point"
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
            {latestPoint && (
              <div className="absolute top-4 right-4 z-10 pointer-events-none animate-fade-in">
                <div className="rounded-md border border-border-strong bg-surface px-3 py-2 shadow-card min-w-[140px] text-center">
                  <p className="text-xs text-ink-muted">{latestPoint.label}</p>
                  <p className="font-tabular mt-0.5 text-sm font-medium text-ink">{formatCurrency(latestPoint.revenue)}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}