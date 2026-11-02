import type { Invoice } from "@/types";

/**
 * Applies the only draft-to-billed transition supported by the invoice
 * lifecycle. Keeping this transition pure makes it explicit that billing
 * changes only the lifecycle fields and never implies sending.
 */
export function billInvoice(invoice: Invoice, billedAt: string): Invoice {
  return {
    ...invoice,
    isDraft: false,
    billedAt,
  };
}
