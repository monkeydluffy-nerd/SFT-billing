import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-float">
      <p className="text-xs text-ink-muted">{point.label}</p>
      <p className="font-tabular text-sm font-medium text-ink">{formatCurrency(point.revenue)}</p>
    </div>
  );
}

export function RevenueChart({ series }: RevenueChartProps) {
  const [period, setPeriod] = useState<Period>("12M");
  const data = useMemo(() => (period === "6M" ? series.slice(-6) : series), [series, period]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Revenue trend</p>
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          {(["6M", "12M"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors duration-micro",
                period === p ? "bg-accent text-accent-ink" : "bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {p === "6M" ? "6 months" : "12 months"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-accent))" stopOpacity={0.16} />
                <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgb(var(--color-ink-faint))", fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fill: "rgb(var(--color-ink-faint))", fontSize: 12 }}
              tickFormatter={(v: number) => formatCompactCurrency(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgb(var(--color-border-strong))" }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="rgb(var(--color-accent))"
              strokeWidth={2}
              fill="url(#revenueFill)"
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
