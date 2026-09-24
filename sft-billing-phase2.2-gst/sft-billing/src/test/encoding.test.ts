import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INVOICE_DOCUMENT_LABELS } from "@/components/create-invoice/invoiceDocumentModel";

const SRC_ROOT = path.resolve(__dirname, "..");

const AFFECTED_PRODUCTION_FILES = [
  "pages/CreateInvoicePage.tsx",
  "components/create-invoice/InvoicePreview.tsx",
  "components/create-invoice/InvoiceDocumentRenderer.tsx",
  "components/create-invoice/invoiceDocumentModel.ts",
  "components/payments/PaymentReceiptView.tsx",
  "pages/WorkspaceSettingsPage.tsx",
  "services/invoiceExportService.ts",
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

  it("preserves the intended invoice document symbols and icon labels", () => {
    const createInvoice = readSource("pages/CreateInvoicePage.tsx");
    const receipt = readSource("components/payments/PaymentReceiptView.tsx");
    const exportService = readSource("services/invoiceExportService.ts");

    expect(createInvoice).toContain("Preparing a blank invoice…");
    expect(createInvoice).toContain("· Net 15");
    expect(createInvoice).toContain("Round to nearest ₹");
    expect(createInvoice).toContain("ArrowLeft");
    expect(createInvoice).toContain("CheckCircle2");
    expect(receipt).toContain("Loading payment receipt…");
    expect(receipt).toContain("&apos;");
    expect(exportService).toContain("const currencyFormat =");
    expect(exportService).toContain("labels.currencySymbol");
    expect(INVOICE_DOCUMENT_LABELS).toMatchObject({
      separator: "·",
      emptyValue: "—",
      minus: "−",
      currencySymbol: "₹",
    });
  });
});
