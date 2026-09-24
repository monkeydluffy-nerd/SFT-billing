import type { Invoice, InvoiceStatus, InvoiceStatusInfo } from "@/types";

/**
 * Every screen (Overview, Invoices, Clients, AURA) calls THIS function
 * rather than reading a stored status — see the note in types/invoice.ts.
 * `asOf` defaults to "now" but is a parameter so status can be computed
 * consistently against a fixed clock in tests/demos.
 *
 * Status priority: cancelled > draft > paid (fully) > sent > overdue > pending
 */
export function getInvoiceStatus(invoice: Invoice, asOf: Date = new Date()): InvoiceStatusInfo {
  if (invoice.cancelledAt) {
    return { status: "cancelled", daysOverdue: 0, severity: null };
  }
  if (invoice.isDraft) {
    return { status: "draft", daysOverdue: 0, severity: null };
  }

  // Check if fully paid
  const { total } = computeInvoiceTotals(invoice);
  const paid = invoice.paidAmount ?? (invoice.paidAt ? total : 0);
  if (paid >= total && total > 0) {
    return { status: "paid", daysOverdue: 0, severity: null };
  }

  const due = new Date(invoice.dueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / msPerDay);

  if (daysPastDue > 0) {
    return {
      status: "overdue",
      daysOverdue: daysPastDue,
      severity: daysPastDue >= 30 ? "strong" : "mild",
    };
  }

  // Not yet due — distinguish sent vs pending
  if (invoice.sentAt) {
    return { status: "pending", daysOverdue: 0, severity: null };
  }

  return { status: "sent", daysOverdue: 0, severity: null };
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  outstanding: number; // total - paidAmount
}

export function computeInvoiceTotals(invoice: Pick<Invoice, "items" | "taxRate" | "discount" | "paidAmount">): InvoiceTotals {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * invoice.taxRate;
  const total = Math.max(0, subtotal + taxAmount - invoice.discount);
  const outstanding = Math.max(0, total - (invoice.paidAmount ?? 0));
  return { subtotal, taxAmount, discount: invoice.discount, total, outstanding };
}

/** Returns the InvoiceStatus string in a human-readable label. */
export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
