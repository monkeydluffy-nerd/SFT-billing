export interface InvoiceLineItem {
  id: string;
  productId?: string;
  description: string;
  /** GST HSN/SAC code for this line item — optional, editable. */
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Indian GST is CGST + SGST (or IGST for inter-state, not yet modeled),
 * not a single flat "tax %" — see computeInvoiceTotals in
 * lib/invoiceMath.ts for how these become amounts. Rates are per-invoice
 * and editable; Business Profile only supplies the starting default.
 */
export interface InvoiceGst {
  cgstRate: number; // e.g. 0.09 for 9%
  sgstRate: number; // e.g. 0.09 for 9%
}

/**
 * `status` is intentionally NOT a stored field. It's derived from
 * `isDraft` / `paidAt` / `dueDate` by `getInvoiceStatus()` in
 * `src/lib/invoiceMath.ts`, so a single invoice can never disagree with
 * itself. Same for totals: subtotal/CGST/SGST/round-off/grand-total are
 * computed by `computeInvoiceTotals()` from `items`, `gst`, and
 * `discount` — never hard-coded alongside the data that produced them.
 */
export interface Invoice {
  id: string;
  number: string; // e.g. "INV-1042"
  clientId: string;
  issueDate: string; // ISO date
  dueDate: string; // ISO date
  items: InvoiceLineItem[];
  gst: InvoiceGst;
  discount: number; // flat currency amount, applied to the taxable value before GST
  /** Explicit round-off adjustment to reach a whole-rupee total — see suggestRoundOff() in lib/invoiceMath.ts. Never applied silently. */
  roundOff: number;
  /** Generated from the grand total once totals are known — see lib/amountInWords.ts. Not stored redundantly if it drifts from the total; regenerate on display. */
  amountInWords?: string;
  notes?: string;
  /** Terms / declaration text shown on the printed invoice — defaults from Business Profile, editable per invoice. */
  terms?: string;

  // Optional order/delivery details — never required.
  supplierCode?: string;
  poNumber?: string;
  poDate?: string; // ISO date
  transporter?: string;

  isDraft: boolean;
  /** Set once, by the Bill_Invoice_Action, when the invoice moves from Draft to Billed. Never cleared. Distinct from `sentAt` — billing is not the same as emailing. */
  billedAt?: string;
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

/**
 * The ledger-derived counterpart to InvoiceStatus, scoped to Billed
 * invoices only — computed by getInvoiceLedgerStatus() in
 * lib/invoiceMath.ts from actual recorded Payment amounts, never from a
 * manually set "paid" flag. Kept entirely separate from InvoiceStatus so
 * Reports/Intelligence/AURA (which depend on the unmodified InvoiceStatus
 * type) are unaffected.
 */
export type InvoiceLedgerStatus = "outstanding" | "overdue" | "received";

export interface InvoiceLedgerStatusInfo {
  status: InvoiceLedgerStatus;
  /** Only meaningful when status === "overdue". */
  daysOverdue: number;
  /** "overdue" splits into a severity gradient, mirroring InvoiceStatusInfo. */
  severity: "mild" | "strong" | null;
}

/**
 * Core workflow status combines the editable Draft state with the
 * payment-ledger states used by the workflow pages. It is intentionally
 * separate from InvoiceStatus so legacy Reports/Intelligence/AURA labels
 * and filters remain compatible.
 */
export type InvoiceWorkflowStatus = "draft" | InvoiceLedgerStatus;

export interface InvoiceWorkflowStatusInfo {
  status: InvoiceWorkflowStatus;
  daysOverdue: number;
  severity: "mild" | "strong" | null;
}

/** What a new Create Invoice draft should start pre-filled with — set by "New Invoice", "Duplicate", or AURA. */
export interface InvoiceDraftPrefill {
  /** Present only when re-opening an EXISTING draft to keep editing it (not creating a new one) — see lib/invoiceDraft.ts. */
  invoiceId?: string;
  clientId?: string;
  items?: InvoiceLineItem[];
  gst?: InvoiceGst;
  discount?: number;
  notes?: string;
  terms?: string;
  supplierCode?: string;
  poNumber?: string;
  poDate?: string;
  transporter?: string;
}
