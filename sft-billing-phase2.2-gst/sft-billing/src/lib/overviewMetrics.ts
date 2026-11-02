import type { Invoice, InvoiceStatus, Payment } from "@/types";
import { getInvoiceStatus, getInvoiceWorkflowStatus, computeInvoiceTotals } from "./invoiceMath";
import { monthKey, monthLabel } from "@/data/dateHelpers";
import {
  getInvoiceOutstandingBalance,
  getInvoiceTotal,
} from "./invoiceBalance";

export interface StatusTotal {
  status: InvoiceStatus;
  count: number;
  amount: number;
}

/**
 * The Overview status strip and the Invoices list filters both call this
 * — one function, one definition of "how many invoices are pending" that
 * every screen agrees on.
 */
export function computeStatusTotals(invoices: Invoice[], asOf: Date = new Date()): Record<InvoiceStatus, StatusTotal> {
  const totals: Record<InvoiceStatus, StatusTotal> = {
    draft: { status: "draft", count: 0, amount: 0 },
    pending: { status: "pending", count: 0, amount: 0 },
    overdue: { status: "overdue", count: 0, amount: 0 },
    paid: { status: "paid", count: 0, amount: 0 },
  };

  for (const invoice of invoices) {
    const { status } = getInvoiceStatus(invoice, asOf);
    const { total } = computeInvoiceTotals(invoice);
    totals[status].count += 1;
    // Drafts are workflow records, never financial totals.
    if (status !== "draft") totals[status].amount += total;
  }

  return totals;
}

/**
 * Core workflow totals for Overview. The returned keys retain the existing
 * Overview/filter compatibility (`pending`/`paid`) while their values come
 * from the ledger-derived `outstanding`/`received` states. Draft amount is
 * deliberately kept at zero because a draft is not billed revenue.
 * 
 * Outstanding/overdue amounts now use the remaining balance (total - payments)
 * instead of the full invoice face value.
 */
export function computeLedgerStatusTotals(
  invoices: Invoice[],
  payments: Payment[],
  asOf: Date = new Date(),
): Record<InvoiceStatus, StatusTotal> {
  const totals: Record<InvoiceStatus, StatusTotal> = {
    draft: { status: "draft", count: 0, amount: 0 },
    pending: { status: "pending", count: 0, amount: 0 },
    overdue: { status: "overdue", count: 0, amount: 0 },
    paid: { status: "paid", count: 0, amount: 0 },
  };

  for (const invoice of invoices) {
    const workflowStatus = getInvoiceWorkflowStatus(invoice, payments, asOf);
    const total = getInvoiceTotal(invoice);

    if (workflowStatus.status === "draft") {
      totals.draft.count += 1;
      continue;
    }

    const status: InvoiceStatus =
      workflowStatus.status === "outstanding"
        ? "pending"
        : workflowStatus.status === "received"
          ? "paid"
          : "overdue";
    totals[status].count += 1;
    
    // Use outstanding balance for pending/overdue, total for paid
    if (status === "paid") {
      totals[status].amount += total;
    } else {
      totals[status].amount += getInvoiceOutstandingBalance(invoice, payments);
    }
  }

  return totals;
}

export interface MonthlyRevenuePoint {
  key: string; // "2026-08"
  label: string; // "Aug 26"
  revenue: number;
}

/**
 * Revenue is recognized on the date a payment was actually received
 * (paidAt), not on the invoice issue date — so the trend line reflects
 * cash collected, matching how the Overview hero metric is computed.
 */
export function computeMonthlyRevenueSeries(invoices: Invoice[], monthsBack = 12, asOf: Date = new Date()): MonthlyRevenuePoint[] {
  const buckets = new Map<string, MonthlyRevenuePoint>();

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    const key = monthKey(d);
    buckets.set(key, { key, label: monthLabel(d), revenue: 0 });
  }

  for (const invoice of invoices) {
    if (invoice.isDraft || !invoice.paidAt) continue;
    const key = monthKey(new Date(invoice.paidAt));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += computeInvoiceTotals(invoice).total;
    }
  }

  return Array.from(buckets.values());
}

/**
 * Ledger-backed Overview revenue series. Unlike the legacy compatibility
 * helper above, this uses recorded payments and ignores any draft payment
 * or legacy paidAt flag, so the displayed metric reflects durable ledger
 * data and never treats a draft as revenue.
 */
export function computeMonthlyPaymentRevenueSeries(
  invoices: Invoice[],
  payments: Payment[],
  monthsBack = 12,
  asOf: Date = new Date(),
): MonthlyRevenuePoint[] {
  const buckets = new Map<string, MonthlyRevenuePoint>();

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    const key = monthKey(d);
    buckets.set(key, { key, label: monthLabel(d), revenue: 0 });
  }

  const billedInvoiceIds = new Set(invoices.filter((invoice) => !invoice.isDraft).map((invoice) => invoice.id));
  for (const payment of payments) {
    if (!billedInvoiceIds.has(payment.invoiceId)) continue;
    const bucket = buckets.get(monthKey(new Date(payment.receivedAt)));
    if (bucket) bucket.revenue += payment.amount;
  }

  return Array.from(buckets.values());
}

export function revenueForCurrentMonth(series: MonthlyRevenuePoint[]): { current: number; previous: number; changePct: number } {
  const current = series[series.length - 1]?.revenue ?? 0;
  const previous = series[series.length - 2]?.revenue ?? 0;
  const changePct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return { current, previous, changePct };
}

/**
 * Compute total outstanding across all invoices.
 * Uses the shared balance calculation for consistency.
 */
export function computeTotalOutstanding(invoices: Invoice[], payments: Payment[]): number {
  return invoices
    .filter((invoice) => !invoice.isDraft)
    .reduce((sum, invoice) => sum + getInvoiceOutstandingBalance(invoice, payments), 0);
}

/**
 * Compute total overdue across all invoices.
 * Uses the shared balance calculation for consistency.
 */
export function computeTotalOverdue(invoices: Invoice[], payments: Payment[], asOf: Date = new Date()): number {
  return invoices
    .filter((invoice) => !invoice.isDraft && getInvoiceStatus(invoice, asOf).status === "overdue")
    .reduce((sum, invoice) => sum + getInvoiceOutstandingBalance(invoice, payments), 0);
}

/**
 * Compute total received (payments) across all invoices.
 */
export function computeTotalReceived(invoices: Invoice[], payments: Payment[]): number {
  const billedInvoiceIds = new Set(invoices.filter((i) => !i.isDraft).map((i) => i.id));
  return payments
    .filter((p) => billedInvoiceIds.has(p.invoiceId))
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Compute total billed (invoice face value) across all invoices.
 */
export function computeTotalBilled(invoices: Invoice[]): number {
  return invoices
    .filter((invoice) => !invoice.isDraft)
    .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
}