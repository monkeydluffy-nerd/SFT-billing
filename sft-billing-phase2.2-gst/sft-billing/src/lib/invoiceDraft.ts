import type { Invoice, InvoiceLineItem, InvoiceDraftPrefill, InvoiceGst } from "@/types";
import { nextInvoiceNumber } from "./invoiceNumber";

const NET_TERMS_DAYS = 15;
/** Used only when no Business Profile default is available yet — still fully editable per invoice, never hard-coded onto the invoice itself. */
const FALLBACK_GST: InvoiceGst = { cgstRate: 0.09, sgstRate: 0.09 };

let lineItemCounter = 0;
export function newLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  lineItemCounter += 1;
  return {
    id: `li_draft_${Date.now()}_${lineItemCounter}`,
    description: "",
    hsnCode: "",
    quantity: 1,
    unitPrice: 0,
    ...overrides,
  };
}

/**
 * The single place that decides what a brand-new invoice looks like
 * before the user has touched anything — id, number, dates, empty line
 * item, GST rates. "New Invoice", "Duplicate", and AURA's "create an
 * invoice for X" all funnel through this so a blank invoice never looks
 * different depending on how you got there.
 *
 * Re-opening an EXISTING draft to keep editing it is a different case —
 * see `resolveInvoiceDraft` below, which this function does not handle.
 */
export function createDraftInvoice(
  existing: Invoice[],
  prefill: InvoiceDraftPrefill = {},
  defaultGst?: InvoiceGst,
  businessDeclaration?: string,
): Invoice {
  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + NET_TERMS_DAYS);

  return {
    id: `iv_draft_${Date.now()}`,
    number: nextInvoiceNumber(existing),
    clientId: prefill.clientId ?? "",
    issueDate: now.toISOString(),
    dueDate: due.toISOString(),
    items: prefill.items && prefill.items.length > 0 ? prefill.items : [newLineItem()],
    gst: prefill.gst ?? defaultGst ?? FALLBACK_GST,
    discount: prefill.discount ?? 0,
    roundOff: 0,
    notes: prefill.notes,
    terms: prefill.terms ?? businessDeclaration,
    supplierCode: prefill.supplierCode,
    poNumber: prefill.poNumber,
    poDate: prefill.poDate,
    transporter: prefill.transporter,
    isDraft: true,
  };
}

/**
 * Resolves what Create Invoice should open with: the ORIGINAL invoice
 * (same id/number/issue date) when `prefill.invoiceId` points at a saved
 * draft — so saving continues editing that record instead of creating a
 * second copy — otherwise a brand-new blank/prefilled draft.
 */
export function resolveInvoiceDraft(existing: Invoice[], prefill: InvoiceDraftPrefill = {}, defaultGst?: InvoiceGst): Invoice {
  if (prefill.invoiceId) {
    const original = existing.find((invoice) => invoice.id === prefill.invoiceId);
    if (original) return original;
  }
  return createDraftInvoice(existing, prefill, defaultGst);
}
