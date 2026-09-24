import { Download, FileSpreadsheet, Printer } from "lucide-react";

interface ExportBarProps {
  onExportExcel: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
}

/**
 * CSV and Print both work entirely client-side today. Excel export for
 * REPORTS specifically (not the per-invoice download, which is real and
 * lives on the invoice screen) isn't wired to a real generator yet, so
 * it's disabled with a tooltip explaining why - a single quiet signal
 * rather than a repeated on-screen badge.
 */
export function ExportBar({ onExportExcel, onExportCsv, onPrint }: ExportBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onExportExcel}
        title="Report-level Excel export isn't available yet - use CSV export or the per-invoice Download Invoice action"
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-faint transition-colors duration-micro cursor-not-allowed opacity-50"
        disabled
      >
        <FileSpreadsheet size={13} aria-hidden />
        Export Excel
      </button>
      <button
        type="button"
        onClick={onExportCsv}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
      >
        <Download size={13} aria-hidden />
        Export CSV
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
      >
        <Printer size={13} aria-hidden />
        Print / PDF
      </button>
    </div>
  );
}