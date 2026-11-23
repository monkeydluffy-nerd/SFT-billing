import type { ReactNode } from "react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  width?: string; // e.g., "w-[120px]", "min-w-[140px]"
}

interface ReportTableProps<T> {
  columns: Column[];
  rows: T[];
  renderRow: (row: T) => ReactNode;
  rowKey: (row: T) => string;
}

/** A single reusable table shell for every report type: one card, quiet header, hairline rows. */
export function ReportTable<T>({ columns, rows, renderRow, rowKey }: ReportTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-faint ${col.align === "right" ? "text-right" : "text-left"} ${col.width ?? ""}`}
                  style={col.width ? { width: col.width.replace("w-[", "").replace("]", "") } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors duration-micro hover:bg-canvas/70">
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
