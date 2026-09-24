import { Calendar } from "lucide-react";
import type { Client, InvoiceStatus } from "@/types";
import { DATE_PRESET_LABELS, resolvePresetRange, type DatePreset, type ReportFilterState } from "@/lib/reports";
import { cn } from "@/lib/cn";

interface ReportFiltersProps {
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  clients: Client[] | undefined;
  dateOnly?: boolean;
  asOf?: Date;
}

const STATUS_OPTIONS: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Outstanding" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

const PRESETS: DatePreset[] = ["this-month", "last-month", "last-3-months", "last-12-months", "custom"];

const selectClass =
  "h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong cursor-pointer";
const dateInputClass =
  "font-tabular h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong";

/**
 * Date range is chosen via named presets first ("This month", "Last 3
 * months", ...), never a pair of empty-looking date pickers as the
 * primary interaction - "Custom" is the one preset that reveals actual
 * date inputs, since that's the only case where a bare picker is the
 * right control.
 */
export function ReportFilters({ filters, onChange, clients, dateOnly = false, asOf }: ReportFiltersProps) {
  function selectPreset(preset: DatePreset) {
    if (preset === "custom") {
      onChange({ ...filters, preset, from: filters.from, to: filters.to });
      return;
    }
    const range = resolvePresetRange(preset, asOf);
    onChange({ ...filters, preset, from: range.from, to: range.to });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectPreset(preset)}
            className={cn(
              "rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors duration-micro",
              filters.preset === preset ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {DATE_PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      {filters.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-ink-faint" aria-hidden />
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value || null })}
            className={dateInputClass}
            aria-label="From date"
          />
          <span className="text-xs text-ink-faint">to</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value || null })}
            className={dateInputClass}
            aria-label="To date"
          />
        </div>
      )}

      {!dateOnly && (
        <>
          <select
            value={filters.clientId ?? ""}
            onChange={(e) => onChange({ ...filters, clientId: e.target.value || null })}
            className={selectClass}
            aria-label="Filter by client"
          >
            <option value="">All clients</option>
            {(clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status ?? ""}
            onChange={(e) => onChange({ ...filters, status: (e.target.value || null) as InvoiceStatus | null })}
            className={selectClass}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}