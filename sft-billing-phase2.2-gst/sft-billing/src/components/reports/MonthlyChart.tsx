import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Invoice, Payment } from "@/types";
import { computeInvoiceTotals } from "@/lib/invoiceMath";

interface MonthlyDataPoint {
  month: string;
  monthKey: string;
  billed: number;
  received: number;
}

interface MonthlyChartProps {
  invoices: Invoice[];
  payments: Payment[];
  months?: 6 | 12;
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyChart({ invoices, payments, months = 6 }: MonthlyChartProps) {
  const [show12Months, setShow12Months] = useState(false);
  const displayMonths = show12Months ? 12 : months;

  const monthlyData = useMemo(() => {
    const data: MonthlyDataPoint[] = [];

    for (let i = displayMonths - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);

      const nextMonth = new Date(date);
      nextMonth.setMonth(date.getMonth() + 1);

      const monthKey = getMonthKey(new Date(date));

      // Filter invoices for this month
      const monthInvoices = invoices?.filter((inv) => {
        if (inv.isDraft) return false;
        const issueDate = new Date(inv.issueDate);
        return issueDate >= new Date(date) && issueDate < new Date(nextMonth);
      }) || [];

      // Filter payments for this month
      const monthPayments = payments?.filter((pay) => {
        const payDate = new Date(pay.receivedAt);
        return payDate >= date && payDate < nextMonth;
      }) || [];

      const billed = monthInvoices.reduce((sum, inv) => sum + computeInvoiceTotals(inv).total, 0);
      const received = monthPayments.reduce((sum, pay) => sum + pay.amount, 0);

      data.push({
        month: getMonthLabel(new Date(date)),
        monthKey,
        billed,
        received,
      });
    }
    return data;
  }, [invoices, payments, displayMonths]);

  const maxValue = useMemo(
    () => Math.max(...monthlyData.map((d) => Math.max(d.billed, d.received))),
    [monthlyData]
  );

  const chartHeight = 200;
  const chartWidth = "100%";
  const padding = { top: 20, right: 60, bottom: 40, left: 80 };
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const getY = (value: number) => {
    if (maxValue === 0) return padding.top + innerHeight;
    return padding.top + innerHeight - (value / maxValue) * innerHeight;
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Monthly Billed vs Received</p>
          <p className="text-xs text-ink-muted">Last {displayMonths} months</p>
        </div>
        <button
          type="button"
          onClick={() => setShow12Months(!show12Months)}
          className="text-xs text-accent hover:underline"
        >
          {show12Months ? "Show 6 months" : "Show 12 months"}
        </button>
      </div>

      {/* Accessible text summary */}
      <div className="sr-only" aria-live="polite">
        Monthly revenue summary:
        {monthlyData.map((d) =>
          `${d.month}: Billed ${formatCurrency(d.billed)}, Received ${formatCurrency(d.received)}. `
        ).join(" ")}
      </div>

      <div
        className="relative"
        style={{ width: chartWidth, height: chartHeight }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const barWidth = 24;
          const gap = (rect.width - padding.left - padding.right - displayMonths * barWidth) / (displayMonths + 1);
          const index = Math.floor((x - padding.left - gap) / (barWidth + gap));
          if (index >= 0 && index < displayMonths) {
            setHoveredIndex(index);
          } else {
            setHoveredIndex(null);
          }
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${1000} ${chartHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          role="img"
          aria-label="Monthly Billed vs Received chart"
        >
          {/* Grid lines */}
          <defs>
            <linearGradient id="billedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-chart-billed))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="rgb(var(--color-chart-billed))" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="receivedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-chart-received))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="rgb(var(--color-chart-received))" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines and labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={padding.top + innerHeight * ratio}
                x2={1000 - padding.right}
                y2={padding.top + innerHeight * ratio}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text
                x={padding.left - 12}
                y={padding.top + innerHeight * ratio + 4}
                textAnchor="end"
                fontSize="10"
                fill="currentColor"
                fillOpacity={0.5}
                fontFamily="monospace"
              >
                {formatCompactCurrency(maxValue * (1 - ratio))}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {monthlyData.map((d, i) => (
            <text
              key={d.monthKey}
              x={padding.left + i * (1000 - padding.left - padding.right) / (displayMonths - 1 || 1)}
              y={chartHeight - padding.bottom + 18}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              fillOpacity={0.6}
              dominantBaseline="hanging"
            >
              {d.month}
            </text>
          ))}

          {/* Bars */}
          {monthlyData.map((d, i) => {
            const barWidth = 24;
            const gap = (1000 - padding.left - padding.right - displayMonths * barWidth) / (displayMonths + 1);
            const x = padding.left + i * (barWidth + gap) + gap;
            const billedY = getY(d.billed);
            const receivedY = getY(d.received);

            const isHovered = hoveredIndex === i;

            return (
              <g key={d.monthKey} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                {/* Billed bar */}
                <rect
                  x={x}
                  y={billedY}
                  width={barWidth}
                  height={chartHeight - padding.bottom - billedY}
                  fill="url(#billedGradient)"
                  rx={2}
                  opacity={isHovered ? 1 : 0.8}
                  className="transition-opacity duration-micro"
                />
                {/* Received bar */}
                <rect
                  x={x + 4}
                  y={receivedY}
                  width={barWidth - 8}
                  height={chartHeight - padding.bottom - receivedY}
                  fill="url(#receivedGradient)"
                  rx={2}
                  opacity={isHovered ? 1 : 0.8}
                  className="transition-opacity duration-micro"
                />

                {/* Tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={x - 40}
                      y={Math.min(billedY, receivedY) - 55}
                      width={160}
                      height={50}
                      fill="#1B1A18"
                      rx={6}
                      stroke="#E7E3DB"
                      strokeOpacity={0.3}
                      strokeWidth={1}
                      className="monthly-chart-tooltip-bg"
                    />
                    <text x={x + barWidth / 2} y={Math.min(billedY, receivedY) - 40} textAnchor="middle" fontSize="10" fill="white" fontWeight="600" className="monthly-chart-tooltip-label">
                      {monthlyData[i].month}
                    </text>
                    <text x={x + barWidth / 2} y={Math.min(billedY, receivedY) - 28} textAnchor="middle" fontSize="9" fill="#4ADE80" className="monthly-chart-tooltip-billed">
                      Billed: {formatCurrency(monthlyData[i].billed)}
                    </text>
                    <text x={x + barWidth / 2} y={Math.min(billedY, receivedY) - 18} textAnchor="middle" fontSize="9" fill="#60A5FA" className="monthly-chart-tooltip-received">
                      Received: {formatCurrency(monthlyData[i].received)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <div className="w-5 h-2 rounded bg-emerald-600/80" />
            <span>Billed</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <div className="w-5 h-2 rounded bg-blue-500/80" />
            <span>Received</span>
          </div>
        </div>

        {/* Accessible summary */}
        <details className="mt-2">
          <summary className="text-xs text-ink-muted hover:text-ink cursor-pointer select-none">
            View data table
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full min-w-[720px] text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-3 py-2 text-xs font-medium text-ink-muted text-left">Month</th>
                  <th className="px-3 py-2 text-xs font-medium text-ink-muted text-right">Billed</th>
                  <th className="px-3 py-2 text-xs font-medium text-ink-muted text-right">Received</th>
                  <th className="px-3 py-2 text-xs font-medium text-ink-muted text-right">Collection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthlyData.map((d) => (
                  <tr key={d.monthKey} className="hover:bg-canvas">
                    <td className="px-3 py-2 text-ink-muted">{d.month}</td>
                    <td className="px-3 py-2 text-right font-tabular text-ink">{formatCurrency(d.billed)}</td>
                    <td className="px-3 py-2 text-right font-tabular text-success">{formatCurrency(d.received)}</td>
                    <td className="px-3 py-2 text-right font-tabular text-ink-muted">
                      {d.billed > 0 ? `${((d.received / d.billed) * 100).toFixed(1)}%` : "n/a"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}