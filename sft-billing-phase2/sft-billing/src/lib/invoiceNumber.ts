import type { Invoice } from "@/types";

/**
 * Reads the highest existing "INV-####" number and returns the next one.
 * Called once when Create Invoice opens, so the live preview shows a real
 * invoice number immediately rather than a placeholder — see blueprint
 * §4.3, "watching a real, print-ready invoice assemble itself."
 */
export function nextInvoiceNumber(existing: Invoice[]): string {
  const numbers = existing
    .map((invoice) => parseInt(invoice.number.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = numbers.length > 0 ? Math.max(...numbers) : 1000;
  return `INV-${max + 1}`;
}
