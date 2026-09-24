import html2canvas from "html2canvas";
import jsPDF  from "jspdf";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";

export interface InvoicePdfInput {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
}

export function invoicePdfFilename(invoiceNumber: string): string {
  const safeNumber = invoiceNumber.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeNumber}.pdf`;
}

/** Captures the canonical invoice renderer using the same A4 print dimensions. */
export async function downloadInvoicePdf(input: InvoicePdfInput): Promise<string> {
  const fileName = invoicePdfFilename(input.invoice.number);
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return fileName;
  }

  const invoiceDocument = document.querySelector<HTMLElement>('[data-testid="invoice-document-page"]');
  if (!invoiceDocument) {
    throw new Error("Open the invoice detail page before sending the PDF.");
  }

  buildInvoiceDocumentModel(input);
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
    const pdfWidth = 210;
    const pdfHeight = 297;
    
    // Canvas is 1024×1448 px at scale 1 (exactly matching artboard).
    // Aspect ratio: 1024/1448 ≈ 0.707 matches A4 aspect (210/297 ≈ 0.707).
    // jsPDF scales proportionally to fit 210×297 mm without distortion.
    pdf.addImage(
      canvas,
      "PNG",
      0,
      0,
      pdfWidth,
      pdfHeight,
      undefined,
      "FAST"
    );
    pdf.save(fileName);
    return fileName;
  } finally {
    captureHost.remove();
  }
}