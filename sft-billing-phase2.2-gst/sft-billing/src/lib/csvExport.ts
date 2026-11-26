/**
 * Client-side CSV export - works entirely in the browser today, no
 * backend needed. This is the export path Reports can genuinely offer
 * right now; Excel export lives in xlsxExport.ts.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  downloadCsvRows(filename, [headers, ...rows]);
}

/** Writes already laid-out rows (any widths) as a UTF-8 CSV download. */
export function downloadCsvRows(filename: string, tableRows: (string | number)[][]): void {
  const escapeCell = (value: string | number): string => {
    let str = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = tableRows.map((row) => row.map(escapeCell).join(","));
  const csvContent = lines.join("\r\n");
  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}