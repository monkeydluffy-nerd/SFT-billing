import type { SummaryItem } from "@/lib/reportSummaryItems";
import { cn } from "@/lib/cn";

interface ReportSummaryProps {
  items: SummaryItem[];
}

/**
 * Generic layout shared by every report's summary strip - but each
 * report type builds its OWN set of items (see ReportsPage), so a
 * Payments report never shows "Overdue" and an Outstanding report never
 * shows "Payments received". Three items keeps the strip scannable
 * without repeating the same six metrics everywhere.
 */
export function ReportSummary({ items }: ReportSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 border-y border-border py-6 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center sm:items-start">
          <p className="text-xs font-medium text-ink-muted">{item.label}</p>
          <p className={cn("font-tabular mt-1.5 text-2xl text-ink", item.caution && "text-overdue")}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * KPI card for displaying key metrics with consistent styling.
 */
interface KPICardProps {
  label: string;
  value: string;
  /** Optional trend indicator */
  trend?: {
    value: number; // percentage change
    label: string; // e.g., "vs last month"
    positive?: boolean; // true = positive trend (green), false = negative (red)
  };
  /** Whether to highlight as caution (overdue, etc.) */
  caution?: boolean;
  /** Optional icon */
  icon?: React.ReactNode;
}

export function KPICard({ label, value, trend, caution, icon }: KPICardProps) {
  return (
    <div className="flex flex-col items-center sm:items-start p-4 bg-surface border border-border rounded-lg">
      {icon && <div className="mb-2 text-ink-muted">{icon}</div>}
      <p className="text-xs font-medium text-ink-muted mb-1">{label}</p>
      <p className={`font-tabular text-2xl font-medium ${caution ? "text-overdue" : "text-ink"}`}>
        {value}
      </p>
      {trend && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium">
          <span className={trend.positive ? "text-success" : "text-overdue"}>
            {trend.value > 0 ? "+" : ""}{trend.value.toFixed(1)}%
          </span>
          <span className="text-ink-muted">{trend.label}</span>
        </div>
      )}
    </div>
  );
}