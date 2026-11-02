import type { Payment, PaymentMethod } from "@/types";
import { mockInvoices } from "./mockInvoices";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { createSeededRandom, pick } from "./seedRandom";

const rng = createSeededRandom(4471);
const methods: PaymentMethod[] = ["bank_transfer", "upi", "card", "cheque", "bank_transfer", "upi"];

let paymentCounter = 0;

/**
 * One payment per paid invoice, for exactly that invoice's computed total.
 * This is what guarantees the Payments ledger, the Overview "Paid" figure,
 * and the client's lifetime-billed total can never disagree with each
 * other — they're all reading the same underlying invoice.
 */
export const mockPayments: Payment[] = mockInvoices
  .filter((invoice) => invoice.paidAt)
  .map((invoice) => {
    paymentCounter += 1;
    const { total } = computeInvoiceTotals(invoice);
    return {
      id: `pm_${paymentCounter}`,
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: total,
      method: pick(rng, methods),
      receivedAt: invoice.paidAt as string,
      reference: `REF-${(10000 + paymentCounter).toString()}`,
    } satisfies Payment;
  });
