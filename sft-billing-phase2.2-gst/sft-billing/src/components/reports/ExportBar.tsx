import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/shared/Button";

interface ExportBarProps {
  onExportExcel: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
}

/**
 * CSV and Print work entirely client-side. Excel export for REPORTS isn't
 * wired to a generator yet (the per-invoice download is real and lives on
 * the invoice page), so it stays disabled with an explanatory tooltip.
 */
export function ExportBar({ onExportExcel, onExportCsv, onPrint }: ExportBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onExportExcel}
        title="Report-level Excel export isn't available yet - use CSV export or the per-invoice Download Invoice action"
        disabled
      >
        <FileSpreadsheet size={13} aria-hidden />
        Export Excel
      </Button>
      <Button variant="secondary" size="sm" onClick={onExportCsv}>
        <Download size={13} aria-hidden />
        Export CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={onPrint}>
        <Printer size={13} aria-hidden />
        Print / PDF
      </Button>
    </div>
  );
}
