import { describe, expect, it } from "vitest";
import {
  computeLedgerStatusTotals,
  computeTotalOutstanding,
  computeTotalOverdue,
  computeTotalReceived,
  computeTotalBilled,
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

describe("overviewMetrics - ledger-based totals with shared balance", () => {
  it("computeLedgerStatusTotals uses outstanding balance for pending/overdue", () => {
    const unpaid = makeInvoice({ id: "unpaid", dueDate: "2025-06-30T00:00:00.000Z" });
    const partial = makeInvoice({ id: "partial", dueDate: "2025-06-30T00:00:00.000Z" });
    const paid = makeInvoice({ id: "paid", dueDate: "2025-06-01T00:00:00.000Z" });
    const overdue = makeInvoice({ id: "overdue", dueDate: "2025-06-01T00:00:00.000Z" });
    const draft = makeInvoice({ id: "draft", isDraft: true });

    const totals = computeLedgerStatusTotals(
      [unpaid, partial, paid, overdue, draft],
      [
        makePayment(partial, 30), // Partial payment of 30 on 100 total
        makePayment(paid, 100),   // Full payment on 100 total
      ],
      asOf,
    );

    // Unpaid: outstanding = 100
    // Partial: outstanding = 70 (100 - 30)
    // Total pending = 100 + 70 = 170
    expect(totals.pending.amount).toBe(170);
    // Overdue: outstanding = 100
    expect(totals.overdue.amount).toBe(100);
    // Paid: total = 100 (full invoice total, not outstanding)
    expect(totals.paid.amount).toBe(100);
    // Draft: amount = 0
    expect(totals.draft.amount).toBe(0);
  });

  it("computeTotalOutstanding sums outstanding balances", () => {
    const invoices = [
      makeInvoice({ id: "1" }),
      makeInvoice({ id: "2" }),
      makeInvoice({ id: "3", isDraft: true }),
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 100),
    ];

    const outstanding = computeTotalOutstanding(invoices, payments);
    // Invoice 1: 100 - 30 = 70
    // Invoice 2: 100 - 100 = 0
    // Invoice 3: draft = excluded
    expect(outstanding).toBe(70);
  });

  it("computeTotalOverdue sums outstanding balances for overdue invoices", () => {
    const invoices = [
      makeInvoice({ id: "1", dueDate: "2025-06-01T00:00:00.000Z" }), // overdue
      makeInvoice({ id: "2", dueDate: "2025-06-30T00:00:00.000Z" }), // pending
      makeInvoice({ id: "3", dueDate: "2025-06-01T00:00:00.000Z", isDraft: true }), // overdue but draft
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 50),
    ];

    const overdue = computeTotalOverdue(invoices, payments, asOf);
    // Invoice 1: 100 - 30 = 70 (overdue)
    // Invoice 2: not overdue
    // Invoice 3: draft excluded
    expect(overdue).toBe(70);
  });

  it("computeTotalReceived sums payments for billed invoices", () => {
    const invoices = [
      makeInvoice({ id: "1" }),
      makeInvoice({ id: "2", isDraft: true }),
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[0], 20),
      makePayment(invoices[1], 100), // draft payment ignored
    ];

    const received = computeTotalReceived(invoices, payments);
    expect(received).toBe(50);
  });

  it("computeTotalBilled sums invoice totals for non-draft invoices", () => {
    const invoices = [
      makeInvoice({ id: "1", items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }] }),
      makeInvoice({ id: "2", items: [{ id: "2", description: "Item", quantity: 2, unitPrice: 200 }] }),
      makeInvoice({ id: "3", isDraft: true }),
    ];

    const billed = computeTotalBilled(invoices);
    expect(billed).toBe(500); // 100 + 400
  });
});