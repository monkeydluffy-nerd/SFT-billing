import { describe, expect, it } from "vitest";
import {
  computeRevenueSummary,
  computeOutstandingSummary,
  computeOverdueSummary,
  buildOutstandingReportRows,
  buildClientSummaryRows,
} from "./reports";
import type { Client, Invoice, Payment } from "@/types";

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

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Test Client",
    contactName: "Contact",
    email: "test@example.com",
    phone: "123",
    billingAddress: "Address",
    gstin: "29AAAAA0000A1Z5",
    pan: "AAAAA0000A",
    notes: undefined,
    ...overrides,
  };
}

describe("reports - shared balance calculation", () => {
  it("computeRevenueSummary uses outstanding balance", () => {
    const invoices = [
      makeInvoice({ id: "1" }), // total 100
      makeInvoice({ id: "2" }), // total 100
      makeInvoice({ id: "3", isDraft: true }), // draft
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 100),
    ];

    const summary = computeRevenueSummary(invoices, payments, asOf);
    expect(summary.billed).toBe(200); // 100 + 100 (draft excluded)
    expect(summary.collected).toBe(130); // 30 + 100
    // Outstanding: invoice 1 = 70, invoice 2 = 0
    expect(summary.outstanding).toBe(70);
  });

  it("computeOutstandingSummary uses outstanding balance", () => {
    const invoices = [
      makeInvoice({ id: "1", clientId: "client-1" }),
      makeInvoice({ id: "2", clientId: "client-2" }),
      makeInvoice({ id: "3", isDraft: true }),
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 100),
    ];

    const summary = computeOutstandingSummary(invoices, payments, asOf);
    // Invoice 1: 100 - 30 = 70 outstanding
    // Invoice 2: 100 - 100 = 0 outstanding (not counted)
    expect(summary.totalOutstanding).toBe(70);
    expect(summary.invoiceCount).toBe(1); // Only invoice 1 has outstanding > 0
    expect(summary.clientsAffected).toBe(1);
  });

  it("computeOverdueSummary uses outstanding balance", () => {
    const invoices = [
      makeInvoice({ id: "1", dueDate: "2025-06-01T00:00:00.000Z" }), // overdue
      makeInvoice({ id: "2", dueDate: "2025-06-30T00:00:00.000Z" }), // pending
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 50),
    ];

    const summary = computeOverdueSummary(invoices, payments, asOf);
    // Invoice 1: 100 - 30 = 70 overdue
    // Invoice 2: not overdue
    expect(summary.totalOverdue).toBe(70);
    expect(summary.invoiceCount).toBe(1);
  });

  it("buildOutstandingReportRows uses shared balance", () => {
    const invoices = [
      makeInvoice({ id: "1", clientId: "client-1" }),
      makeInvoice({ id: "2", clientId: "client-2" }),
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 100),
    ];
    const clients = [
      makeClient({ id: "client-1" }),
      makeClient({ id: "client-2" }),
    ];

    const rows = buildOutstandingReportRows(invoices, payments, clients, asOf);
    expect(rows.length).toBe(1); // Only invoice 1 has outstanding > 0
    expect(rows[0].invoiceNumber).toBe("INV-1");
    expect(rows[0].total).toBe(100);
    expect(rows[0].paid).toBe(30);
    expect(rows[0].outstanding).toBe(70);
  });

  it("buildClientSummaryRows uses outstanding balance", () => {
    const invoices = [
      makeInvoice({ id: "1", clientId: "client-1" }),
      makeInvoice({ id: "2", clientId: "client-1" }),
      makeInvoice({ id: "3", clientId: "client-2" }),
    ];
    const payments = [
      makePayment(invoices[0], 30),
      makePayment(invoices[1], 100),
      makePayment(invoices[2], 50),
    ];
    const clients = [
      makeClient({ id: "client-1" }),
      makeClient({ id: "client-2" }),
    ];

    const rows = buildClientSummaryRows(invoices, payments, clients, asOf);
    
    // Client 1: invoice 1 (100-30=70 outstanding) + invoice 2 (100-100=0 outstanding) = 70 outstanding
    const client1 = rows.find(r => r.clientId === "client-1");
    expect(client1).toBeDefined();
    expect(client1!.totalBilled).toBe(200);
    expect(client1!.totalCollected).toBe(130);
    expect(client1!.outstanding).toBe(70);

    // Client 2: invoice 3 (100-50=50 outstanding)
    const client2 = rows.find(r => r.clientId === "client-2");
    expect(client2).toBeDefined();
    expect(client2!.totalBilled).toBe(100);
    expect(client2!.totalCollected).toBe(50);
    expect(client2!.outstanding).toBe(50);
  });

  it("fully paid invoices do not contribute to outstanding", () => {
    const invoices = [
      makeInvoice({ id: "1" }),
      makeInvoice({ id: "2" }),
    ];
    const payments = [
      makePayment(invoices[0], 100),
      makePayment(invoices[1], 100),
    ];

    const summary = computeOutstandingSummary(invoices, payments, asOf);
    expect(summary.totalOutstanding).toBe(0);
    expect(summary.invoiceCount).toBe(0);
  });

  it("draft invoices are excluded from all summaries", () => {
    const invoices = [
      makeInvoice({ id: "1", isDraft: true }),
      makeInvoice({ id: "2" }),
    ];
    const payments = [
      makePayment(invoices[0], 100),
      makePayment(invoices[1], 50),
    ];

    const summary = computeOutstandingSummary(invoices, payments, asOf);
    // Only invoice 2 counts, outstanding = 50
    expect(summary.totalOutstanding).toBe(50);
    expect(summary.invoiceCount).toBe(1);
  });
});