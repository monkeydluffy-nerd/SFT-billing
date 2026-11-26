import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/shared/Button";

interface ExportBarProps {
  onExportExcel: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
}

/** CSV, Excel and Print all work client-side from the rows currently on screen. */
export function ExportBar({ onExportExcel, onExportCsv, onPrint }: ExportBarProps) {
  return (
    <div className="print:hidden flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onExportExcel}
        title="Download this report as an Excel workbook"
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
