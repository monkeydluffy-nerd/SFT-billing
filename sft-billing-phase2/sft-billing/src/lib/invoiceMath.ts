import type { Invoice, InvoiceStatusInfo } from "@/types";

/**
 * Every screen (Overview, Invoices, Clients, AURA) calls THIS function
 * rather than reading a stored status — see the note in types/invoice.ts.
 * `asOf` defaults to "now" but is a parameter so status can be computed
 * consistently against a fixed clock in tests/demos.
 */
export function getInvoiceStatus(invoice: Invoice, asOf: Date = new Date()): InvoiceStatusInfo {
  if (invoice.isDraft) {
    return { status: "draft", daysOverdue: 0, severity: null };
  }
  if (invoice.paidAt) {
    return { status: "paid", daysOverdue: 0, severity: null };
  }

  const due = new Date(invoice.dueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / msPerDay);

  if (daysPastDue <= 0) {
    return { status: "pending", daysOverdue: 0, severity: null };
  }

  return {
    status: "overdue",
    daysOverdue: daysPastDue,
    severity: daysPastDue >= 30 ? "strong" : "mild",
  };
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
}

export function computeInvoiceTotals(invoice: Pick<Invoice, "items" | "taxRate" | "discount">): InvoiceTotals {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * invoice.taxRate;
  const total = Math.max(0, subtotal + taxAmount - invoice.discount);
  return { subtotal, taxAmount, discount: invoice.discount, total };
}
