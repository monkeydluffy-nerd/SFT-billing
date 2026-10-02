import type { Invoice } from "@/types";

export interface InvoiceFileBundle {
  kind: "sft-billing-invoice";
  version: 1;
  invoice: Invoice;
}

export function invoiceJsonFilename(invoiceNumber: string): string {
  const safeNumber = invoiceNumber.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeNumber || "invoice"}.json`;
}

export function downloadInvoiceJson(invoice: Invoice): string {
  const fileName = invoiceJsonFilename(invoice.number);
  const bundle: InvoiceFileBundle = { kind: "sft-billing-invoice", version: 1, invoice };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return fileName;
}

export async function readInvoiceUpload(file: File): Promise<Invoice> {
  const text = await file.text();
  const parsed = JSON.parse(text) as InvoiceFileBundle | Invoice;
  const invoice = "invoice" in parsed && parsed.invoice ? parsed.invoice : (parsed as Invoice);
  if (!invoice || typeof invoice !== "object" || !invoice.id || !invoice.number || !Array.isArray(invoice.items)) {
    throw new Error("That file is not an SFT invoice export.");
  }
  return invoice;
}
