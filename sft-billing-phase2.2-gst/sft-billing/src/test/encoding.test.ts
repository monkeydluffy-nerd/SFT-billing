import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");

const AFFECTED_PRODUCTION_FILES = [
  "pages/CreateInvoicePage.tsx",
  "pages/InvoicePage.tsx",
  "components/create-invoice/DownloadInvoicePdfButton.tsx",
  "services/invoiceTemplateDownloadService.ts",
  "components/payments/PaymentReceiptView.tsx",
  "pages/WorkspaceSettingsPage.tsx",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(path.join(SRC_ROOT, relativePath), "utf-8");
}

describe("production encoding", () => {
  it("contains no UTF-8 mojibake markers in directly affected production sources", () => {
    const mojibakeMarker = /[\u00c2\u00c3\u00e2]/u;
    const offenders = AFFECTED_PRODUCTION_FILES.filter((relativePath) => mojibakeMarker.test(readSource(relativePath)));

    expect(offenders).toEqual([]);
  });

  it("preserves intended UI symbols and routes invoice downloads through the template", () => {
    const createInvoice = readSource("pages/CreateInvoicePage.tsx");
    const invoicePage = readSource("pages/InvoicePage.tsx");
    const receipt = readSource("components/payments/PaymentReceiptView.tsx");
    const exportService = readSource("services/invoiceTemplateDownloadService.ts");

    expect(createInvoice).toContain("Preparing a blank invoice…");
    expect(createInvoice).toContain("· Net 15");
    expect(createInvoice).toContain("Round to nearest ₹");
    expect(createInvoice).toContain("ArrowLeft");
    expect(createInvoice).toContain("CheckCircle2");
    expect(createInvoice).not.toContain("InvoicePreview");
    expect(invoicePage).not.toContain("InvoiceDocumentRenderer");
    expect(receipt).toContain("Loading payment receipt…");
    expect(receipt).toContain("&apos;");
    expect(exportService).toContain('format === "excel"');
    expect(exportService).toContain('format === "excel" ? "xlsx" : "pdf"');
  });
});
