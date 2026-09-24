import { REPORT_DEFINITIONS, type ReportId } from "@/lib/reports";
import { cn } from "@/lib/cn";

interface ReportTypeTabsProps {
  active: ReportId;
  onSelect: (id: ReportId) => void;
}

/** A premium segmented control, not a row of plain link-like tabs - the active report gets a filled pill, matching the date-preset control's language. */
export function ReportTypeTabs({ active, onSelect }: ReportTypeTabsProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1" role="tablist" aria-label="Report type">
      {REPORT_DEFINITIONS.map((report) => {
        const isActive = report.id === active;
        return (
          <button
            key={report.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(report.id)}
            className={cn(
              "rounded-[5px] px-3.5 py-2 text-sm font-medium transition-colors duration-micro",
              isActive ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {report.title}
          </button>
        );
      })}
    </div>
  );
}