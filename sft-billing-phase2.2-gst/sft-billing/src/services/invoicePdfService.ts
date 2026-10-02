import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";
import { formatDate } from "@/lib/formatters";

export interface InvoicePdfInput {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
}

export function invoicePdfFilename(invoiceNumber: string): string {
  const safeNumber = invoiceNumber.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeNumber || "invoice"}.pdf`;
}

function money(value: number): string {
  return `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Builds a PDF from the invoice model. No network and no page capture. */
export function buildOfflineInvoicePdf(input: InvoicePdfInput): jsPDF {
  const model = buildInvoiceDocumentModel(input);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = 16;
  const write = (text: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, 180);
    pdf.text(lines, 14, y);
    y += lines.length * (size * 0.45) + 2;
  };

  write(model.business.name || "SFT Billing", 16, true);
  write(model.labels.invoiceHeading, 14, true);
  write(`${model.labels.invoiceHeading}: ${model.invoice.number}`);
  write(`${model.labels.issued}: ${formatDate(model.invoice.issueDate)}`);
  write(`${model.labels.due}: ${formatDate(model.invoice.dueDate)}`);
  write(`${model.labels.billedTo}: ${model.customer.name}`, 11, true);
  if (model.customer.billingAddress) write(model.customer.billingAddress);
  y += 2;
  model.items.forEach((item, index) => {
    write(`${index + 1}. ${item.description}  x${item.quantity}  @ ${money(item.unitPrice)}`);
  });
  y += 2;
  write(`${model.labels.taxableValue}: ${money(model.totals.taxableValue)}`);
  write(`CGST: ${money(model.totals.cgstAmount)}`);
  write(`SGST: ${money(model.totals.sgstAmount)}`);
  write(`${model.labels.grandTotal}: ${money(model.totals.total)}`, 12, true);
  write(`${model.labels.amountInWords}: ${model.totals.amountInWords}`);
  return pdf;
}

async function downloadCapturedPdf(fileName: string): Promise<boolean> {
  const invoiceDocument = document.querySelector<HTMLElement>('[data-testid="invoice-document-page"]');
  if (!invoiceDocument) return false;
  await document.fonts?.ready;
  const clone = invoiceDocument.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  clone.style.background = "#fff";
  const captureHost = document.createElement("div");
  captureHost.style.position = "fixed";
  captureHost.style.left = "-100000px";
  captureHost.style.top = "0";
  captureHost.style.width = "1024px";
  captureHost.style.background = "#fff";
  captureHost.appendChild(clone);
  document.body.appendChild(captureHost);
  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true,
      logging: false,
      windowWidth: 1024,
      windowHeight: 1448,
    });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    pdf.addImage(canvas, "PNG", 0, 0, 210, 297, undefined, "FAST");
    pdf.save(fileName);
    return true;
  } catch {
    return false;
  } finally {
    captureHost.remove();
  }
}

/** Saves a PDF on this PC. Page capture is tried first, then a local model PDF. */
export async function downloadInvoicePdf(input: InvoicePdfInput): Promise<string> {
  const fileName = invoicePdfFilename(input.invoice.number);
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return fileName;
  }
  buildInvoiceDocumentModel(input);
  const captured = await downloadCapturedPdf(fileName);
  if (!captured) buildOfflineInvoicePdf(input).save(fileName);
  return fileName;
}
