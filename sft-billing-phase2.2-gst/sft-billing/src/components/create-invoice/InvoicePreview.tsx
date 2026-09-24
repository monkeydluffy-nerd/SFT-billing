import type { BusinessProfile, Client, Invoice } from "@/types";
import { InvoiceDocumentRenderer } from "./InvoiceDocumentRenderer";
import { buildInvoiceDocumentModel } from "./invoiceDocumentModel";

interface InvoicePreviewProps {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
}

/**
 * Adapts Create Invoice inputs to the shared normalized document model.
 * InvoiceDocumentRenderer owns the invoice document structure and labels so
 * detail and output consumers can use the same renderer without duplicating
 * markup or monetary calculations.
 */
export function InvoicePreview({ invoice, client, business }: InvoicePreviewProps) {
  const model = buildInvoiceDocumentModel({ invoice, client, business });
  return <InvoiceDocumentRenderer model={model} />;
}
