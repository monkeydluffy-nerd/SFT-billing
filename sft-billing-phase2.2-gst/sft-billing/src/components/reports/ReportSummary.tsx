import type { SummaryItem } from "@/lib/reportSummaryItems";

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
        <div key={item.label}>
          <p className="text-xs font-medium text-ink-muted">{item.label}</p>
          <p className={`font-tabular mt-1 text-2xl text-ink ${item.caution ? "text-overdue" : ""}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}