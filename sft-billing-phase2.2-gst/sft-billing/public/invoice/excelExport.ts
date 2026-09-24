import ExcelJS from 'exceljs';
import type { Invoice } from './types';

const NAVY = 'FF2B3A4A';
const COPPER = 'FFC0673A';
const ROW_ALT = 'FFF6F6F6';
const BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFDDDDDD' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

/**
 * Builds an .xlsx Buffer for the given (already-computed) invoice.
 * Reuses invoice.totals / invoice.items straight from buildInvoice(),
 * so the Excel figures can never drift from what's shown on screen.
 */
export async function exportInvoiceToExcel(invoice: Invoice): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = invoice.seller.legalName;
  wb.created = new Date();

  const sheet = wb.addWorksheet('Invoice', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  sheet.columns = [
    { width: 6 }, { width: 26 }, { width: 10 }, { width: 8 },
    { width: 8 }, { width: 10 }, { width: 14 }, { width: 12 },
    { width: 12 }, { width: 14 },
  ];

  let r = 1;
  const titleRow = sheet.getRow(r);
  sheet.mergeCells(r, 1, r, 10);
  titleRow.getCell(1).value = invoice.seller.legalName;
  titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: NAVY } };
  r += 1;

  sheet.mergeCells(r, 1, r, 10);
  sheet.getRow(r).getCell(1).value = `GSTIN: ${invoice.seller.gstin}   PAN: ${invoice.seller.pan}`;
  r += 2;

  sheet.mergeCells(r, 1, r, 5);
  sheet.getCell(r, 1).value = 'Bill To';
  sheet.getCell(r, 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COPPER } };
  sheet.mergeCells(r, 6, r, 10);
  sheet.getCell(r, 6).value = 'Invoice Details';
  sheet.getCell(r, 6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(r, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  r += 1;

  sheet.mergeCells(r, 1, r, 5);
  sheet.getCell(r, 1).value = [invoice.buyer.name, ...invoice.buyer.address].join('\n');
  sheet.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(r).height = 60;

  invoice.meta.forEach((m, i) => {
    const row = r + i;
    if (row > sheet.rowCount) sheet.getRow(row);
    sheet.mergeCells(row, 6, row, 7);
    sheet.getCell(row, 6).value = m.label;
    sheet.getCell(row, 6).font = { bold: true };
    sheet.mergeCells(row, 8, row, 10);
    sheet.getCell(row, 8).value = m.value;
  });
  r += Math.max(invoice.meta.length, 4) + 1;

  const headerRow = r;
  const headers = [
    'S.No.', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit', 'Rate',
    'Taxable Value', `CGST ${invoice.tax.cgstRate}%`, `SGST ${invoice.tax.sgstRate}%`, 'Amount',
  ];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = ALL_BORDERS;
  });
  r += 1;

  invoice.items.forEach((item, idx) => {
    const row = sheet.getRow(r + idx);
    const values = [
      item.serial, item.description, item.hsn, item.qty, item.unit,
      item.rate, item.taxableValue, item.cgst, item.sgst, item.amount,
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.border = ALL_BORDERS;
      if (i >= 5) cell.numFmt = '#,##0.00';
      if (i === 1) cell.alignment = { horizontal: 'left' };
      else if (i >= 5) cell.alignment = { horizontal: 'right' };
      else cell.alignment = { horizontal: 'center' };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT } };
    });
  });
  r += invoice.items.length + 1;

  const totalsRows: [string, number][] = [
    ['Taxable Amount', invoice.totals.taxableAmount],
    [`CGST @ ${invoice.tax.cgstRate}%`, invoice.totals.cgstTotal],
    [`SGST @ ${invoice.tax.sgstRate}%`, invoice.totals.sgstTotal],
    ['Round Off', invoice.totals.roundOff],
  ];
  totalsRows.forEach(([label, value], i) => {
    const row = r + i;
    sheet.mergeCells(row, 7, row, 8);
    sheet.getCell(row, 7).value = label;
    sheet.getCell(row, 7).font = { bold: true };
    sheet.mergeCells(row, 9, row, 10);
    sheet.getCell(row, 9).value = value;
    sheet.getCell(row, 9).numFmt = '"₹" #,##0.00';
    sheet.getCell(row, 9).alignment = { horizontal: 'right' };
  });
  const grandRow = r + totalsRows.length;
  sheet.mergeCells(grandRow, 7, grandRow, 8);
  sheet.getCell(grandRow, 7).value = 'Grand Total';
  sheet.getCell(grandRow, 7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(grandRow, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COPPER } };
  sheet.mergeCells(grandRow, 9, grandRow, 10);
  sheet.getCell(grandRow, 9).value = invoice.totals.grandTotal;
  sheet.getCell(grandRow, 9).numFmt = '"₹" #,##0.00';
  sheet.getCell(grandRow, 9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(grandRow, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COPPER } };
  sheet.getCell(grandRow, 9).alignment = { horizontal: 'right' };
  r = grandRow + 2;

  sheet.mergeCells(r, 1, r, 10);
  sheet.getCell(r, 1).value = `Amount in Words: ${invoice.amountInWords}`;
  sheet.getCell(r, 1).font = { italic: true };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Browser convenience: builds the file and triggers a download. */
export async function downloadInvoiceExcel(invoice: Invoice, filename = 'invoice.xlsx') {
  const buffer = await exportInvoiceToExcel(invoice);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
