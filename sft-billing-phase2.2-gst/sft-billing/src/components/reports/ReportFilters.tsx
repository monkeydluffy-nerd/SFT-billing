import { Calendar } from "lucide-react";
import type { Client, InvoiceStatus } from "@/types";
import { DATE_PRESET_LABELS, resolvePresetRange, type DatePreset, type ReportFilterState } from "@/lib/reports";
import { cn } from "@/lib/cn";
import { Dropdown } from "@/components/shared/Dropdown";

interface ReportFiltersProps {
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  clients: Client[] | undefined;
  asOf?: Date;
  onExcludeTestDataChange?: (exclude: boolean) => void;
}

// Shared filter data is intentionally exported alongside this component.
// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_OPTIONS: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Outstanding" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

/**
 * Date range is chosen via named presets first ("This month", "Last 3
 * months", ...), never a pair of empty-looking date pickers as the
 * primary interaction - "Custom" is the one preset that reveals actual
 * date inputs, since that's the only case where a bare picker is the
 * right control.
 */
export function ReportFilters({
  filters,
  onChange,
  clients,
  asOf,
  onExcludeTestDataChange,
}: ReportFiltersProps) {
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
      {/* Date Presets */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
        {["this-month", "last-month", "last-3-months", "last-12-months", "custom"].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectPreset(preset as "this-month" | "last-month" | "last-3-months" | "last-12-months" | "custom")}
            className={cn(
              "rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors duration-micro",
              filters.preset === preset ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {DATE_PRESET_LABELS[preset as "this-month" | "last-month" | "last-3-months" | "last-12-months" | "custom"]}
          </button>
        ))}
      </div>

      {filters.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-ink-faint" aria-hidden>
            <Calendar size={14} />
          </svg>
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value || null })}
            className="font-tabular h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong"
            aria-label="From date"
          />
          <span className="text-xs text-ink-faint">to</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value || null })}
            className="font-tabular h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong"
            aria-label="To date"
          />
        </div>
      )}

      {/* Client Dropdown */}
      <Dropdown
        value={filters.clientId ?? ""}
        onChange={(value) => onChange({ ...filters, clientId: value || null })}
        options={[
          { value: "", label: "All clients" },
          ...(clients ?? []).map((client) => ({ value: client.id, label: client.name })),
        ]}
        placeholder="All clients"
        ariaLabel="Filter by client"
      />

      {/* Status Dropdown */}
      <Dropdown
        value={filters.status ?? ""}
        onChange={(value) => onChange({ ...filters, status: (value || null) as InvoiceStatus | null })}
        options={[
          { value: "", label: "All statuses" },
          { value: "draft", label: "Draft" },
          { value: "pending", label: "Outstanding" },
          { value: "overdue", label: "Overdue" },
          { value: "paid", label: "Paid" },
        ]}
        placeholder="All statuses"
        ariaLabel="Filter by status"
      />

      {/* Exclude Test Data Toggle */}
      <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm text-ink-muted cursor-pointer hover:bg-canvas transition-colors duration-micro">
        <input
          type="checkbox"
          checked={true}
          onChange={(e) => onExcludeTestDataChange?.(e.target.checked)}
          className="rounded border-border text-accent focus:ring-accent focus:ring-2"
        />
        <span>Exclude test data</span>
      </label>
    </div>
  );
}