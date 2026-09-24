import { describe, expect, it } from "vitest";
import {
  computeInvoiceTotals,
  getClientRollup,
  getGlobalRollup,
  getInvoiceLedgerStatus,
  getInvoiceWorkflowStatus,
} from "./invoiceMath";
import type { Invoice, Payment } from "@/types";

describe("computeInvoiceTotals", () => {
  it("matches the worked example: taxable value 25700, CGST 9%, SGST 9%, zero discount, zero round-off", () => {
    const totals = computeInvoiceTotals({
      items: [{ id: "li_1", description: "Item", quantity: 1, unitPrice: 25700 }],
      gst: { cgstRate: 0.09, sgstRate: 0.09 },
      discount: 0,
      roundOff: 0,
    });

    expect(totals.subtotal - totals.discount).toBe(25700);
    expect(totals.cgstAmount).toBe(2313);
    expect(totals.sgstAmount).toBe(2313);
    expect(totals.rawTotal).toBe(30326);
    expect(totals.total).toBe(30326);
  });
});

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

const asOf = new Date("2025-06-15T00:00:00.000Z");

describe("getInvoiceLedgerStatus", () => {
  it("does not assign a ledger status to a draft invoice", () => {
    const draft = makeInvoice({ isDraft: true });

    expect(getInvoiceLedgerStatus(draft, [], asOf)).toBeNull();
  });

  it("derives billed status from payment totals and due date, independently of paidAt", () => {
    const outstanding = makeInvoice({
      id: "invoice-outstanding",
      dueDate: "2025-06-30T00:00:00.000Z",
      paidAt: "2025-06-01T00:00:00.000Z",
    });
    const overdue = makeInvoice({ id: "invoice-overdue", dueDate: "2025-06-01T00:00:00.000Z" });
    const received = makeInvoice({ id: "invoice-received", dueDate: "2025-06-01T00:00:00.000Z" });
    const payments: Payment[] = [
      { id: "payment-outstanding", invoiceId: outstanding.id, clientId: outstanding.clientId, amount: 25, method: "cash", receivedAt: asOf.toISOString() },
      { id: "payment-overdue", invoiceId: overdue.id, clientId: overdue.clientId, amount: 25, method: "cash", receivedAt: asOf.toISOString() },
      { id: "payment-received", invoiceId: received.id, clientId: received.clientId, amount: 100, method: "cash", receivedAt: asOf.toISOString() },
    ];

    expect(getInvoiceLedgerStatus(outstanding, payments, asOf)).toMatchObject({ status: "outstanding", daysOverdue: 0 });
    expect(getInvoiceLedgerStatus(overdue, payments, asOf)).toMatchObject({ status: "overdue", daysOverdue: 14 });
    expect(getInvoiceLedgerStatus(received, payments, asOf)).toMatchObject({ status: "received", daysOverdue: 0 });
  });
});

describe("invoice financial rollups", () => {
  it("exclude drafts and partition billed totals by payment-derived ledger status", () => {
    const received = makeInvoice({ id: "invoice-received", dueDate: "2025-06-01T00:00:00.000Z" });
    const outstanding = makeInvoice({ id: "invoice-outstanding", dueDate: "2025-06-30T00:00:00.000Z" });
    const overdue = makeInvoice({ id: "invoice-overdue", clientId: "client-2", dueDate: "2025-06-01T00:00:00.000Z" });
    const draft = makeInvoice({ id: "invoice-draft", isDraft: true });
    const invoices = [received, outstanding, overdue, draft];
    const payments: Payment[] = [
      { id: "payment-received", invoiceId: received.id, clientId: received.clientId, amount: 100, method: "cash", receivedAt: asOf.toISOString() },
      { id: "payment-overdue", invoiceId: overdue.id, clientId: overdue.clientId, amount: 25, method: "cash", receivedAt: asOf.toISOString() },
    ];

    expect(getClientRollup("client-1", invoices, payments, asOf)).toEqual({
      clientId: "client-1",
      totalBilled: 200,
      totalReceived: 100,
      totalOutstanding: 100,
      totalOverdue: 0,
    });
    expect(getGlobalRollup(invoices, payments, asOf)).toEqual({
      totalBilled: 300,
      totalReceived: 100,
      totalOutstanding: 100,
      totalOverdue: 100,
    });
  });
});

describe("getInvoiceWorkflowStatus", () => {
  it("moves a billed invoice from outstanding to overdue to received using ledger state", () => {
    const invoice = makeInvoice({
      id: "invoice-transition",
      dueDate: "2025-06-30T00:00:00.000Z",
    });
    const beforeDueDate = new Date("2025-06-15T00:00:00.000Z");
    const afterDueDate = new Date("2025-07-01T00:00:00.000Z");

    expect(getInvoiceWorkflowStatus(invoice, [], beforeDueDate)).toMatchObject({ status: "outstanding" });
    expect(getInvoiceWorkflowStatus(invoice, [], afterDueDate)).toMatchObject({ status: "overdue", daysOverdue: 1 });
    expect(
      getInvoiceWorkflowStatus(
        invoice,
        [
          {
            id: "payment-transition",
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            amount: 100,
            method: "cash",
            receivedAt: afterDueDate.toISOString(),
          },
        ],
        afterDueDate,
      ),
    ).toMatchObject({ status: "received", daysOverdue: 0 });
  });
});
