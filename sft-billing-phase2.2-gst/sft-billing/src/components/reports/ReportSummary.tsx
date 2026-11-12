import type { SummaryItem } from "@/lib/reportSummaryItems";
import { cn } from "@/lib/cn";

interface ReportSummaryProps {
  items: SummaryItem[];
}

/**
 * Summary strip shared by every report. Each report builds its OWN items
 * (see ReportsPage), so a Payments report never shows "Overdue" and an
 * Outstanding report never shows "Payments received".
 */
export function ReportSummary({ items }: ReportSummaryProps) {
  return (
    <div
      className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface sm:divide-x sm:divide-y-0 sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
      style={{ "--n": items.length } as React.CSSProperties}
    >
      {items.map((item) => (
        <div key={item.label} className="px-5 py-4">
          <p className="text-xs font-medium text-ink-muted">{item.label}</p>
          <p className={cn("font-tabular mt-2 text-2xl font-medium tracking-tight text-ink", item.caution && "text-overdue")}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/** KPI card for displaying key metrics with consistent styling. */
interface KPICardProps {
  label: string;
  value: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  caution?: boolean;
  icon?: React.ReactNode;
}

export function KPICard({ label, value, trend, caution, icon }: KPICardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {icon && <div className="mb-2 text-ink-muted">{icon}</div>}
      <p className="mb-1 text-xs font-medium text-ink-muted">{label}</p>
      <p className={`font-tabular text-[1.7rem] font-medium tracking-tight ${caution ? "text-overdue" : "text-ink"}`}>{value}</p>
      {trend && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium">
          <span className={trend.positive ? "text-success" : "text-overdue"}>
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
          <span className="text-ink-muted">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
