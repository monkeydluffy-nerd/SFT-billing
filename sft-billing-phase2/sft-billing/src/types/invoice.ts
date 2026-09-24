export interface InvoiceLineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * `status` is intentionally NOT a stored field. It's derived from
 * `isDraft` / `paidAt` / `dueDate` by `getInvoiceStatus()` in
 * `src/lib/invoiceMath.ts`, so a single invoice can never disagree with
 * itself (e.g. "Paid" while also flagged overdue on another screen).
 * Same for totals: `subtotal` / `tax` / `total` are computed from
 * `items`, `taxRate`, and `discount` by `computeInvoiceTotals()` — never
 * hard-coded alongside the line items that produced them.
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
  isDraft: boolean;
  sentAt?: string;
  viewedAt?: string;
  paidAt?: string;
}

export type InvoiceStatus = "draft" | "paid" | "pending" | "overdue";

export interface InvoiceStatusInfo {
  status: InvoiceStatus;
  /** Only meaningful when status === "overdue". */
  daysOverdue: number;
  /** "overdue" splits into a severity gradient — see blueprint §4.2. */
  severity: "mild" | "strong" | null;
}

/** What a new Create Invoice draft should start pre-filled with — set by "New Invoice", "Duplicate", or AURA. */
export interface InvoiceDraftPrefill {
  /** Present only when re-opening an EXISTING draft to keep editing it (not creating a new one) — see lib/invoiceDraft.ts. */
  invoiceId?: string;
  clientId?: string;
  items?: InvoiceLineItem[];
  taxRate?: number;
  discount?: number;
  notes?: string;
}
