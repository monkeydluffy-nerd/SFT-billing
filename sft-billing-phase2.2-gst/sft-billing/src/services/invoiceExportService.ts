import ExcelJS from "exceljs";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";
import { computeLineItemTotals } from "@/lib/invoiceMath";
import { formatDate } from "@/lib/formatters";

export interface InvoiceExportInput {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
}

// Minimal professional brand palette
const SLATE_DARK = "#1E293B"; // Slate 800
const SLATE_LIGHT = "#F1F5F9"; // Slate 100

// Native Excel Indian number format code (crores/lakhs) ensuring numeric value is preserved
const INDIAN_CURRENCY_FORMAT = "[$₹-en-IN]#,##,##0.00";

function formatPercent(rate: number): string {
  return Number((rate * 100).toFixed(2)) + "%";
}

function setColumnWidths(sheet: ExcelJS.Worksheet): void {
  sheet.getColumn("A").width = 5;  // S.No
  sheet.getColumn("B").width = 35; // Description
  sheet.getColumn("C").width = 11; // HSN/SAC
  sheet.getColumn("D").width = 8;  // Qty
  sheet.getColumn("E").width = 7;  // Unit (Blank)
  sheet.getColumn("F").width = 12; // Rate
  sheet.getColumn("G").width = 14; // Taxable Value
  sheet.getColumn("H").width = 12; // CGST
  sheet.getColumn("I").width = 12; // SGST
  sheet.getColumn("J").width = 15; // Amount
}

function applyStandardBorders(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
}

export async function generateInvoiceWorkbook(input: InvoiceExportInput): Promise<Uint8Array> {
  const model = buildInvoiceDocumentModel(input);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoice");

  setColumnWidths(sheet);
  let currentRow = 1;

  // ============================================
  // LOGO FETCHING
  // ============================================
  let logoImageId: number | undefined;
  if (model.business.logoUrl) {
    try {
      const response = await fetch(model.business.logoUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "";
        const extension = (contentType.includes("jpeg") || contentType.includes("jpg")) ? "jpeg" : "png";
        logoImageId = workbook.addImage({ buffer, extension });
      }
    } catch (e) {
      // Silently omit logo if network/CORS prevents access
    }
  }

  // ============================================
  // HEADER: Business Details (Left) | TAX INVOICE (Right)
  // ============================================
  if (logoImageId !== undefined) {
    sheet.addImage(logoImageId, {
      tl: { col: 0, row: currentRow - 1 },
      ext: { width: 120, height: 45 } 
    });
    // Add spacer rows for the logo
    sheet.getRow(currentRow).height = 15;
    sheet.getRow(currentRow + 1).height = 15;
    sheet.getRow(currentRow + 2).height = 15;
    currentRow += 4;
  }

  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  let cell = sheet.getCell(`A${currentRow}`);
  cell.value = model.business.name;
  cell.font = { bold: true, size: 16, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "left", vertical: "middle" };

  sheet.mergeCells(`F${currentRow}:J${currentRow}`);
  cell = sheet.getCell(`F${currentRow}`);
  cell.value = model.labels.invoiceHeading.toUpperCase();
  cell.font = { bold: true, size: 16, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right", vertical: "middle" };
  sheet.getRow(currentRow).height = 24;
  currentRow++;

  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  cell = sheet.getCell(`A${currentRow}`);
  cell.value = model.business.address;
  cell.font = { size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  // Ensure address has height if long
  sheet.getRow(currentRow).height = Math.max(15, Math.ceil(model.business.address.length / 45) * 12);
  currentRow++;

  const contactText = model.business.email && model.business.phone
    ? `${model.business.email}  ${model.labels.separator}  ${model.business.phone}`
    : model.business.email || model.business.phone || "";

  if (contactText) {
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    cell = sheet.getCell(`A${currentRow}`);
    cell.value = contactText;
    cell.font = { size: 9, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    currentRow++;
  }

  const gstinPanText = [
    model.business.gstin ? `GSTIN: ${model.business.gstin}` : null,
    model.business.pan ? `PAN: ${model.business.pan}` : null
  ].filter(Boolean).join(`  ${model.labels.separator}  `);

  if (gstinPanText) {
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    cell = sheet.getCell(`A${currentRow}`);
    cell.value = gstinPanText;
    cell.font = { size: 9, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    currentRow++;
  }

  currentRow++; // Blank row divider

  // ============================================
  // BILL TO & INVOICE META
  // ============================================
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  cell = sheet.getCell(`A${currentRow}`);
  cell.value = model.labels.billedTo.toUpperCase();
  cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
  
  sheet.mergeCells(`F${currentRow}:H${currentRow}`);
  cell = sheet.getCell(`F${currentRow}`);
  cell.value = `${model.labels.invoiceHeading}:`;
  cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right" };

  sheet.mergeCells(`I${currentRow}:J${currentRow}`);
  cell = sheet.getCell(`I${currentRow}`);
  cell.value = model.invoice.number;
  cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right" };
  currentRow++;

  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  cell = sheet.getCell(`A${currentRow}`);
  cell.value = model.customer.name;
  cell.font = { bold: true, size: 10, color: { argb: SLATE_DARK } };

  sheet.mergeCells(`F${currentRow}:H${currentRow}`);
  cell = sheet.getCell(`F${currentRow}`);
  cell.value = `${model.labels.issued}:`;
  cell.font = { size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right" };

  sheet.mergeCells(`I${currentRow}:J${currentRow}`);
  cell = sheet.getCell(`I${currentRow}`);
  cell.value = formatDate(model.invoice.issueDate);
  cell.font = { size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right" };
  currentRow++;

  if (model.customer.billingAddress) {
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    cell = sheet.getCell(`A${currentRow}`);
    cell.value = model.customer.billingAddress;
    cell.font = { size: 9, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    sheet.getRow(currentRow).height = Math.max(15, Math.ceil(model.customer.billingAddress.length / 45) * 12);
  }

  sheet.mergeCells(`F${currentRow}:H${currentRow}`);
  cell = sheet.getCell(`F${currentRow}`);
  cell.value = `${model.labels.due}:`;
  cell.font = { size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right" };

  sheet.mergeCells(`I${currentRow}:J${currentRow}`);
  cell = sheet.getCell(`I${currentRow}`);
  cell.value = formatDate(model.invoice.dueDate);
  cell.font = { size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "right" };
  currentRow++;

  if (model.customer.gstin) {
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    cell = sheet.getCell(`A${currentRow}`);
    cell.value = `GSTIN: ${model.customer.gstin}`;
    cell.font = { size: 9, color: { argb: SLATE_DARK } };
  }
  currentRow++; 

  // ============================================
  // ORDER / DELIVERY DETAILS
  // ============================================
  if (model.orderDelivery) {
    currentRow++;
    sheet.mergeCells(`A${currentRow}:J${currentRow}`);
    cell = sheet.getCell(`A${currentRow}`);
    cell.value = model.labels.orderDelivery.toUpperCase();
    cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
    applyStandardBorders(cell);
    currentRow++;

    const fields = [
      { label: model.labels.supplierCode, val: model.orderDelivery.supplierCode },
      { label: model.labels.poNumber, val: model.orderDelivery.poNumber },
      { label: model.labels.poDate, val: model.orderDelivery.poDate ? formatDate(model.orderDelivery.poDate) : undefined },
      { label: model.labels.transporter, val: model.orderDelivery.transporter }
    ].filter(f => f.val);

    fields.forEach(field => {
      sheet.mergeCells(`A${currentRow}:B${currentRow}`);
      cell = sheet.getCell(`A${currentRow}`);
      cell.value = field.label;
      cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
      
      sheet.mergeCells(`C${currentRow}:E${currentRow}`);
      cell = sheet.getCell(`C${currentRow}`);
      cell.value = field.val;
      cell.font = { size: 9, color: { argb: SLATE_DARK } };
      currentRow++;
    });
  }

  currentRow++; 

  // ============================================
  // LINE ITEMS TABLE
  // ============================================
  const headerLabels = [
    "S.No",
    model.labels.description,
    model.labels.hsn,
    model.labels.quantity,
    "Unit",
    model.labels.rate,
    model.labels.taxableValue,
    `${model.labels.cgst} ${formatPercent(model.gst.cgstRate)}`,
    `${model.labels.sgst} ${formatPercent(model.gst.sgstRate)}`,
    model.labels.grandTotal,
  ];

  const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  columns.forEach((col, idx) => {
    cell = sheet.getCell(`${col}${currentRow}`);
    cell.value = headerLabels[idx];
    cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    applyStandardBorders(cell);
  });
  currentRow++;

  // Calculate the exact rendered subtotal directly from the normalized model items
  const renderedSubtotal = model.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  model.items.forEach((item, index) => {
    const lineMath = computeLineItemTotals(
      item,
      renderedSubtotal,
      model.totals.discount,
      model.gst.cgstRate,
      model.gst.sgstRate
    );

    const rowData = [
      { col: "A", val: index + 1, align: "center", isMoney: false },
      { col: "B", val: item.description, align: "left", isMoney: false, wrap: true },
      { col: "C", val: item.hsnCode || "", align: "center", isMoney: false },
      { col: "D", val: item.quantity, align: "center", isMoney: false },
      { col: "E", val: "", align: "center", isMoney: false }, 
      { col: "F", val: item.unitPrice, align: "right", isMoney: true },
      { col: "G", val: lineMath.taxableValue, align: "right", isMoney: true },
      { col: "H", val: lineMath.cgstAmount, align: "right", isMoney: true },
      { col: "I", val: lineMath.sgstAmount, align: "right", isMoney: true },
      { col: "J", val: lineMath.total, align: "right", isMoney: true, bold: true },
    ];

    rowData.forEach((data) => {
      cell = sheet.getCell(`${data.col}${currentRow}`);
      cell.value = data.val;
      cell.font = { size: 9, color: { argb: SLATE_DARK }, bold: data.bold };
      cell.alignment = { 
        horizontal: data.align as any, 
        vertical: "top", 
        wrapText: data.wrap 
      };
      if (data.isMoney) cell.numFmt = INDIAN_CURRENCY_FORMAT;
      applyStandardBorders(cell);
    });

    // Deterministic row height calculation for long descriptions (approx 35 chars per line)
    const estimatedLines = Math.max(1, Math.ceil(item.description.length / 35));
    sheet.getRow(currentRow).height = Math.max(15, estimatedLines * 12);
    currentRow++;
  });

  // ============================================
  // TOTALS SECTION
  // ============================================
  const renderTotalRow = (label: string, value: number, isBold = false) => {
    sheet.mergeCells(`G${currentRow}:I${currentRow}`);
    cell = sheet.getCell(`G${currentRow}`);
    cell.value = label;
    cell.font = { size: 9, bold: isBold, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    applyStandardBorders(cell);

    cell = sheet.getCell(`J${currentRow}`);
    cell.value = value;
    cell.numFmt = INDIAN_CURRENCY_FORMAT;
    cell.font = { size: 9, bold: isBold, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    applyStandardBorders(cell);
    currentRow++;
  };

  renderTotalRow(model.labels.taxableValue, model.totals.taxableValue);
  
  if (model.totals.discount !== 0) {
    renderTotalRow(model.labels.discount, -model.totals.discount);
  }

  renderTotalRow(`${model.labels.cgst} ${formatPercent(model.gst.cgstRate)}`, model.totals.cgstAmount);
  renderTotalRow(`${model.labels.sgst} ${formatPercent(model.gst.sgstRate)}`, model.totals.sgstAmount);

  if (model.totals.roundOff !== 0) {
    renderTotalRow(model.labels.roundOff, model.totals.roundOff);
  }

  // Grand Total
  sheet.mergeCells(`G${currentRow}:I${currentRow}`);
  cell = sheet.getCell(`G${currentRow}`);
  cell.value = model.labels.grandTotal.toUpperCase();
  cell.font = { bold: true, size: 10, color: { argb: SLATE_DARK } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
  cell.alignment = { horizontal: "right", vertical: "middle" };
  applyStandardBorders(cell);

  cell = sheet.getCell(`J${currentRow}`);
  cell.value = model.totals.total;
  cell.numFmt = INDIAN_CURRENCY_FORMAT;
  cell.font = { bold: true, size: 10, color: { argb: SLATE_DARK } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
  cell.alignment = { horizontal: "right", vertical: "middle" };
  applyStandardBorders(cell);
  currentRow++;

  currentRow++; 

  // ============================================
  // AMOUNT IN WORDS
  // ============================================
  sheet.mergeCells(`A${currentRow}:J${currentRow}`);
  cell = sheet.getCell(`A${currentRow}`);
  cell.value = `${model.labels.amountInWords}: ${model.totals.amountInWords}`;
  cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  currentRow += 2;

  // ============================================
  // BANK DETAILS
  // ============================================
  if (model.bank) {
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    cell = sheet.getCell(`A${currentRow}`);
    cell.value = model.labels.bankDetails.toUpperCase();
    cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
    applyStandardBorders(cell);
    currentRow++;

    const bankFields = [
      { label: model.labels.accountHolderName, val: model.bank.accountHolder },
      { label: model.labels.bankName, val: model.bank.bankName },
      { label: model.labels.branch, val: model.bank.branch },
      { label: model.labels.accountNumber, val: model.bank.accountNumber },
      { label: model.labels.ifscCode, val: model.bank.ifsc }
    ];

    bankFields.forEach(field => {
      sheet.mergeCells(`A${currentRow}:B${currentRow}`);
      cell = sheet.getCell(`A${currentRow}`);
      cell.value = field.label;
      cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
      
      sheet.mergeCells(`C${currentRow}:E${currentRow}`);
      cell = sheet.getCell(`C${currentRow}`);
      cell.value = field.val;
      cell.font = { size: 9, color: { argb: SLATE_DARK } };
      currentRow++;
    });
    currentRow++; 
  }

  // ============================================
  // DECLARATION & SIGNATORY
  // ============================================
  const bottomSectionRow = currentRow;

  if (model.declaration) {
    sheet.mergeCells(`A${bottomSectionRow}:F${bottomSectionRow}`);
    cell = sheet.getCell(`A${bottomSectionRow}`);
    cell.value = model.labels.declarationCertification.toUpperCase();
    cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };

    sheet.mergeCells(`A${bottomSectionRow + 1}:F${bottomSectionRow + 4}`);
    cell = sheet.getCell(`A${bottomSectionRow + 1}`);
    cell.value = model.declaration;
    cell.font = { size: 9, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  }

  if (model.authorizedSignatory) {
    sheet.mergeCells(`H${bottomSectionRow}:J${bottomSectionRow}`);
    cell = sheet.getCell(`H${bottomSectionRow}`);
    cell.value = `For ${model.business.name}`;
    cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "right" };

    sheet.mergeCells(`H${bottomSectionRow + 4}:J${bottomSectionRow + 4}`);
    cell = sheet.getCell(`H${bottomSectionRow + 4}`);
    cell.value = model.authorizedSignatory;
    cell.font = { bold: true, size: 9, color: { argb: SLATE_DARK } };
    cell.alignment = { horizontal: "right", vertical: "bottom" };
  }
  
  currentRow = bottomSectionRow + 5;

  // ============================================
  // PRINT SETUP
  // ============================================
  sheet.pageSetup.paperSize = 9; // A4
  sheet.pageSetup.orientation = "portrait";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  sheet.pageSetup.printArea = `A1:J${currentRow}`;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Uint8Array;
}

export function invoiceExportFilename(invoiceNumber: string): string {
  const safeNumber = invoiceNumber
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `SFT-Invoice-${safeNumber}.xlsx`;
}

export async function downloadInvoiceWorkbook(input: InvoiceExportInput): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("downloadInvoiceWorkbook can only be called in the browser");
  }

  const buffer = await generateInvoiceWorkbook(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([buffer] as any, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = invoiceExportFilename(input.invoice.number);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}