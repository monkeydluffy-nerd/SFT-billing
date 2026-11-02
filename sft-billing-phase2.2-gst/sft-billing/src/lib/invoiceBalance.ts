import type { Invoice, Payment } from "@/types";
import { computeInvoiceTotals } from "./invoiceMath";

/**
 * Calculate the outstanding balance for an invoice.
 * This is the single source of truth for outstanding balance calculations.
 * 
 * @param invoice - The invoice to calculate balance for
 * @param payments - All payments (will be filtered to this invoice)
 * @returns The outstanding balance (never negative)
 */
export function getInvoiceOutstandingBalance(
  invoice: Invoice,
  payments: Payment[]
): number {
  const { total } = computeInvoiceTotals(invoice);
  const paid = payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, total - paid);
}

/**
 * Calculate the paid amount for an invoice.
 * 
 * @param invoice - The invoice to calculate paid amount for
 * @param payments - All payments (will be filtered to this invoice)
 * @returns The total paid amount
 */
export function getInvoicePaidAmount(
  invoice: Invoice,
  payments: Payment[]
): number {
  return payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Calculate the total invoice amount (including tax, discount, round-off).
 * 
 * @param invoice - The invoice to calculate total for
 * @returns The total invoice amount
 */
export function getInvoiceTotal(invoice: Invoice): number {
  return computeInvoiceTotals(invoice).total;
}

/**
 * Check if an invoice is fully paid.
 * 
 * @param invoice - The invoice to check
 * @param payments - All payments (will be filtered to this invoice)
 * @returns True if the invoice is fully paid
 */
export function isInvoiceFullyPaid(
  invoice: Invoice,
  payments: Payment[]
): boolean {
  return getInvoiceOutstandingBalance(invoice, payments) === 0;
}

/**
 * Check if an invoice is partially paid.
 * 
 * @param invoice - The invoice to check
 * @param payments - All payments (will be filtered to this invoice)
 * @returns True if the invoice is partially paid (some payment but not fully paid)
 */
export function isInvoicePartiallyPaid(
  invoice: Invoice,
  payments: Payment[]
): boolean {
  const paid = getInvoicePaidAmount(invoice, payments);
  const total = getInvoiceTotal(invoice);
  return paid > 0 && paid < total;
}

/**
 * Get the payment status of an invoice.
 * 
 * @param invoice - The invoice to check
 * @param payments - All payments (will be filtered to this invoice)
 * @returns "unpaid" | "partially_paid" | "paid"
 */
export function getInvoicePaymentStatus(
  invoice: Invoice,
  payments: Payment[]
): "unpaid" | "partially_paid" | "paid" {
  const paid = getInvoicePaidAmount(invoice, payments);
  const total = getInvoiceTotal(invoice);
  
  if (paid === 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partially_paid";
}