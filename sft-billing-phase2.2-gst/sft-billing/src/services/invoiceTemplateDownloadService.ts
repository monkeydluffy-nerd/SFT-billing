import { activeDataProvider } from "@/services";
import type { Invoice } from "@/types";

export type InvoiceTemplateFormat = "excel" | "pdf";

interface InvoiceTemplateDownload {
  fileName: string;
  warnings: string[];
}

function safeInvoiceNumber(number: string): string {
  return number.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "") || "export";
}

export async function downloadInvoiceTemplate(
  invoice: Invoice,
  format: InvoiceTemplateFormat,
): Promise<InvoiceTemplateDownload> {
  const result = format === "excel"
    ? await activeDataProvider.getInvoiceExcel(invoice.id)
    : await activeDataProvider.getInvoicePdf(invoice.id);
  const fileName = `Invoice_${safeInvoiceNumber(invoice.number)}.${format === "excel" ? "xlsx" : "pdf"}`;
  const objectUrlApi = URL;
  const url = objectUrlApi.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => objectUrlApi.revokeObjectURL(url), 1000);
  return { fileName, warnings: result.warnings };
}
