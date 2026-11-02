import type {
  Invoice,
  InvoiceLedgerStatusInfo,
  InvoiceStatusInfo,
  InvoiceWorkflowStatusInfo,
  Payment,
} from "@/types";
import { amountInWords } from "./amountInWords";

/**
 * Every screen (Overview, Invoices, Clients, AURA) calls THIS function
 * rather than reading a stored status - see the note in types/invoice.ts.
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
  cgstAmount: number;
  sgstAmount: number;
  discount: number;
  /** The total before round-off is applied - useful for showing "round off" as an explicit, separate line. */
  rawTotal: number;
  roundOff: number;
  total: number;
}

/**
 * The single source of truth for every number on an invoice - the
 * Overview dashboard, the Invoices list, the live Create Invoice
 * preview, and payment recording all call this instead of computing
 * their own. GST is CGST + SGST (see InvoiceGst in types/invoice.ts),
 * not one flat "tax %", and round-off is a distinct, explicit value
 * rather than folded silently into the total.
 */
export function computeInvoiceTotals(
  invoice: Pick<Invoice, "items" | "gst" | "discount" | "roundOff">,
): InvoiceTotals {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxableValue = Math.max(0, subtotal - invoice.discount);
  const cgstAmount = taxableValue * invoice.gst.cgstRate;
  const sgstAmount = taxableValue * invoice.gst.sgstRate;
  const rawTotal = taxableValue + cgstAmount + sgstAmount;
  const roundOff = invoice.roundOff ?? 0;
  const total = Math.max(0, rawTotal + roundOff);
  return { subtotal, cgstAmount, sgstAmount, discount: invoice.discount, rawTotal, roundOff, total };
}

/**
 * The round-off value that would take `rawTotal` to the nearest whole
 * rupee - offered as a one-click suggestion in Create Invoice, never
 * applied automatically (round-off is a user decision, not a silent one).
 */
export function suggestRoundOff(rawTotal: number): number {
  return Math.round(rawTotal) - rawTotal;
}

/**
 * The ONE place that pairs a grand total with its words representation.
 * Every screen that shows both a total and its amount-in-words (invoice
 * preview, invoice export, AURA) must call this instead of calling
 * computeInvoiceTotals() and amountInWords() separately - that split is
 * exactly what previously let the two drift apart (a stale total quoted
 * in words while a different total rendered on screen). Calling this
 * once guarantees the number and the words always describe the same
 * final grand total (taxable value + CGST + SGST + round-off).
 */
export function getInvoiceTotalsWithWords(
  invoice: Pick<Invoice, "items" | "gst" | "discount" | "roundOff">,
): InvoiceTotals & { amountInWords: string } {
  const totals = computeInvoiceTotals(invoice);
  return { ...totals, amountInWords: amountInWords(totals.total) };
}

/**
 * The ledger-derived counterpart to getInvoiceStatus(), scoped to
 * Billed_Invoice records only. Draft invoices return `null` because they
 * have no ledger status. Takes `payments` explicitly (the caller
 * is responsible for filtering to this invoice's payments, though this
 * function filters again by invoiceId defensively) so this stays a pure
 * function with no data-layer dependency, matching the existing style of
 * computeInvoiceTotals(). Never reads `paidAt`.
 */
export function getInvoiceLedgerStatus(
  invoice: Invoice,
  payments: Payment[],
  asOf: Date = new Date(),
): InvoiceLedgerStatusInfo | null {
  if (invoice.isDraft) return null;

  const paid = payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + p.amount, 0);
  const { total } = computeInvoiceTotals(invoice);

  if (paid >= total) {
    return { status: "received", daysOverdue: 0, severity: null };
  }

  const due = new Date(invoice.dueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / msPerDay);

  if (daysPastDue <= 0) {
    return { status: "outstanding", daysOverdue: 0, severity: null };
  }

  return {
    status: "overdue",
    daysOverdue: daysPastDue,
    severity: daysPastDue >= 30 ? "strong" : "mild",
  };
}

/**
 * Core workflow adapter: drafts remain a workflow state, while every billed
 * invoice gets its status exclusively from the payment ledger. This keeps
 * page-level filtering and status presentation on one calculation path.
 */
export function getInvoiceWorkflowStatus(
  invoice: Invoice,
  payments: Payment[],
  asOf: Date = new Date(),
): InvoiceWorkflowStatusInfo {
  if (invoice.isDraft) {
    return { status: "draft", daysOverdue: 0, severity: null };
  }

  // A billed invoice always has a ledger status; the guard keeps this
  // adapter total if the underlying function is changed in the future.
  return getInvoiceLedgerStatus(invoice, payments, asOf) ?? {
    status: "outstanding",
    daysOverdue: 0,
    severity: null,
  };
}

export interface ClientRollup {
  clientId: string;
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
}

/**
 * Excludes Draft_Invoice records entirely (Requirements 7.3, 8.3, 9.3,
 * 11.2). "Billed" = sum of computeInvoiceTotals().total over every
 * non-draft invoice for the client; the other three buckets partition
 * that same set by getInvoiceLedgerStatus().
 */
export function getClientRollup(
  clientId: string,
  invoices: Invoice[],
  payments: Payment[],
  asOf: Date = new Date(),
): ClientRollup {
  const billed = invoices.filter((i) => i.clientId === clientId && !i.isDraft);
  let totalBilled = 0;
  let totalReceived = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const invoice of billed) {
    const { total } = computeInvoiceTotals(invoice);
    totalBilled += total;
    const info = getInvoiceLedgerStatus(invoice, payments, asOf);
    if (!info) continue;
    if (info.status === "received") totalReceived += total;
    else if (info.status === "outstanding") totalOutstanding += total;
    else totalOverdue += total;
  }

  return { clientId, totalBilled, totalReceived, totalOutstanding, totalOverdue };
}

export interface GlobalRollup {
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
}

/**
 * Same computation as getClientRollup but across every non-draft
 * invoice, unscoped by client — used where a workspace-wide figure is
 * needed.
 */
export function getGlobalRollup(invoices: Invoice[], payments: Payment[], asOf: Date = new Date()): GlobalRollup {
  const billed = invoices.filter((i) => !i.isDraft);
  let totalBilled = 0;
  let totalReceived = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const invoice of billed) {
    const { total } = computeInvoiceTotals(invoice);
    totalBilled += total;
    const info = getInvoiceLedgerStatus(invoice, payments, asOf);
    if (!info) continue;
    if (info.status === "received") totalReceived += total;
    else if (info.status === "outstanding") totalOutstanding += total;
    else totalOverdue += total;
  }

  return { totalBilled, totalReceived, totalOutstanding, totalOverdue };
}

export interface LineItemTotals {
  baseValue: number;
  allocatedDiscount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  total: number;
}

/**
 * Calculates the allocated discount and exact tax amounts for a single line item,
 * using proportional allocation of the invoice-level flat discount.
 * 
 * Takes `renderedSubtotal` (the sum of base values for only the items being rendered)
 * to ensure that if any line items were normalized out (e.g. empty descriptions), 
 * the discount allocation remains mathematically bound to the items that actually appear.
 */
export function computeLineItemTotals(
  item: { quantity: number; unitPrice: number },
  renderedSubtotal: number,
  masterDiscount: number,
  cgstRate: number,
  sgstRate: number
): LineItemTotals {
  const baseValue = item.quantity * item.unitPrice;
  const ratio = renderedSubtotal > 0 ? baseValue / renderedSubtotal : 0;
  const allocatedDiscount = masterDiscount * ratio;
  const taxableValue = Math.max(0, baseValue - allocatedDiscount);
  const cgstAmount = taxableValue * cgstRate;
  const sgstAmount = taxableValue * sgstRate;
  const total = taxableValue + cgstAmount + sgstAmount;

  return { baseValue, allocatedDiscount, taxableValue, cgstAmount, sgstAmount, total };
}