export interface InvoiceLineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Per-line tax rate override; falls back to invoice.taxRate when undefined. */
  taxRate?: number;
}

/**
 * `status` is intentionally NOT a stored field — it's derived from the
 * invoice's flags by `getInvoiceStatus()` in `src/lib/invoiceMath.ts`,
 * so no screen can ever show a stale cached status. Totals are similarly
 * computed on-the-fly by `computeInvoiceTotals()`.
 *
 * `paidAmount` tracks money actually received (sum of linked Payment
 * records). An invoice is considered fully paid when
 * paidAmount >= computeInvoiceTotals(invoice).total.
 */
export interface Invoice {
  id: string;
  number: string; // e.g. "INV-1042"
  clientId: string;
  issueDate: string; // ISO date
  dueDate: string; // ISO date
  items: InvoiceLineItem[];
  taxRate: number; // e.g. 0.18 for 18%
  discount: number; // flat currency amount, applied after tax-exclusive subtotal
  notes?: string;
  paymentTerms?: string; // e.g. "Net 15", "Net 30"
  isDraft: boolean;
  sentAt?: string;
  viewedAt?: string;
  paidAt?: string;
  paidAmount?: number; // running total of payments received
  cancelledAt?: string;
}

export type InvoiceStatus = "draft" | "sent" | "pending" | "paid" | "overdue" | "cancelled";

export interface InvoiceStatusInfo {
  status: InvoiceStatus;
  /** Only meaningful when status === "overdue". */
  daysOverdue: number;
  /** "overdue" splits into a severity gradient — see blueprint §4.2. */
  severity: "mild" | "strong" | null;
}
