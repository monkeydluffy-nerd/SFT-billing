import type { ReactNode } from "react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
}

interface ReportTableProps<T> {
  columns: Column[];
  rows: T[];
  renderRow: (row: T) => ReactNode;
  rowKey: (row: T) => string;
}

/** A single reusable table shell for every report type - consistent headers, consistent row rhythm. */
export function ReportTable<T>({ columns, rows, renderRow, rowKey }: ReportTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-xs font-medium text-ink-muted ${col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors duration-micro hover:bg-canvas">
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}