import { describe, expect, it } from "vitest";
import {
  computeLedgerStatusTotals,
  computeMonthlyPaymentRevenueSeries,
  revenueForCurrentMonth,
} from "./overviewMetrics";
import type { Invoice, Payment } from "@/types";

const asOf = new Date("2025-06-15T00:00:00.000Z");

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    number: "INV-1",
    clientId: "client-1",
    issueDate: "2025-06-01T00:00:00.000Z",
    dueDate: "2025-06-30T00:00:00.000Z",
    items: [{ id: "line-1", description: "Item", quantity: 1, unitPrice: 100 }],
    gst: { cgstRate: 0, sgstRate: 0 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    ...overrides,
  };
}

function makePayment(invoice: Invoice, amount: number, receivedAt = asOf.toISOString()): Payment {
  return {
    id: `payment-${invoice.id}`,
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    amount,
    method: "bank_transfer",
    receivedAt,
  };
}

describe("Overview ledger adapters", () => {
  it("uses payment-derived billed states and excludes draft amounts", () => {
    const received = makeInvoice({ id: "received", dueDate: "2025-06-01T00:00:00.000Z" });
    const outstanding = makeInvoice({ id: "outstanding", dueDate: "2025-06-30T00:00:00.000Z", paidAt: asOf.toISOString() });
    const draft = makeInvoice({ id: "draft", isDraft: true, paidAt: asOf.toISOString() });
    const totals = computeLedgerStatusTotals(
      [received, outstanding, draft],
      [makePayment(received, 100), makePayment(draft, 100)],
      asOf,
    );

    expect(totals.paid).toMatchObject({ count: 1, amount: 100 });
    expect(totals.pending).toMatchObject({ count: 1, amount: 100 });
    expect(totals.draft).toMatchObject({ count: 1, amount: 0 });
  });

  it("uses billed payment dates and ignores payments associated with drafts", () => {
    const billed = makeInvoice({ id: "billed" });
    const draft = makeInvoice({ id: "draft", isDraft: true });
    const series = computeMonthlyPaymentRevenueSeries(
      [billed, draft],
      [
        makePayment(billed, 75, "2025-05-20T00:00:00.000Z"),
        makePayment(billed, 25, "2025-06-10T00:00:00.000Z"),
        makePayment(draft, 999, "2025-06-11T00:00:00.000Z"),
      ],
      2,
      asOf,
    );

    expect(revenueForCurrentMonth(series)).toMatchObject({ current: 25, previous: 75 });
  });
});
