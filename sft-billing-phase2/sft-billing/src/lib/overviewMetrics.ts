import type { Invoice, InvoiceStatus } from "@/types";
import { getInvoiceStatus, computeInvoiceTotals } from "./invoiceMath";
import { monthKey, monthLabel } from "@/data/dateHelpers";

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
    totals[status].amount += total;
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
    if (!invoice.paidAt) continue;
    const key = monthKey(new Date(invoice.paidAt));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += computeInvoiceTotals(invoice).total;
    }
  }

  return Array.from(buckets.values());
}

export function revenueForCurrentMonth(series: MonthlyRevenuePoint[]): { current: number; previous: number; changePct: number } {
  const current = series[series.length - 1]?.revenue ?? 0;
  const previous = series[series.length - 2]?.revenue ?? 0;
  const changePct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return { current, previous, changePct };
}
