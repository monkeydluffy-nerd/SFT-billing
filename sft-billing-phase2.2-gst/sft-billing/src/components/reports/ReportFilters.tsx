import { Calendar } from "lucide-react";
import type { Client, InvoiceStatus } from "@/types";
import { DATE_PRESET_LABELS, resolvePresetRange, type DatePreset, type ReportFilterState } from "@/lib/reports";
import { Segmented } from "@/components/ui/kit";
import { Dropdown } from "@/components/shared/Dropdown";

interface ReportFiltersProps {
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  clients: Client[] | undefined;
  asOf?: Date;
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
      <Segmented
        value={filters.preset as DatePreset}
        onChange={(preset) => selectPreset(preset)}
        options={(["this-month", "last-month", "last-3-months", "last-12-months", "custom"] as DatePreset[]).map((preset) => ({
          value: preset,
          label: DATE_PRESET_LABELS[preset as "this-month" | "last-month" | "last-3-months" | "last-12-months" | "custom"],
        }))}
      />

      {filters.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-ink-faint" aria-hidden>
            <Calendar size={14} />
          </svg>
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value || null })}
            className="font-tabular h-10 rounded-full border border-border-strong bg-surface px-4 text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            aria-label="From date"
          />
          <span className="text-xs text-ink-faint">to</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value || null })}
            className="font-tabular h-10 rounded-full border border-border-strong bg-surface px-4 text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
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
    </div>
  );
}