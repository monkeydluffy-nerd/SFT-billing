import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyRevenuePoint } from "@/lib/overviewMetrics";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface RevenueChartProps {
  series: MonthlyRevenuePoint[];
}

type Period = "6M" | "12M";

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
  const [period, setPeriod] = useState<Period>("12M");
  const data = useMemo(() => (period === "6M" ? series.slice(-6) : series), [series, period]);

  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6" aria-labelledby="revenue-trend-title">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="revenue-trend-title" className="font-display text-xl text-ink">Revenue trend</h2>
          <p className="mt-1 text-sm text-ink-muted">Your revenue over the selected period</p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs">
          {(["6M", "12M"] as Period[]).map((p) => (
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
      <div className="mt-6 h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-accent))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity={0} />
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
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fill: "rgb(var(--color-ink-faint))", fontSize: 12 }}
              tickFormatter={(v: number) => formatCompactCurrency(v)}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgb(var(--color-border-strong))", strokeDasharray: "3 4" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="rgb(var(--color-accent))"
              strokeWidth={2.25}
              fill="url(#revenueFill)"
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
