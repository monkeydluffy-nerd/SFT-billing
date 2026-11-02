import { describe, expect, it } from "vitest";
import {
  getInvoiceOutstandingBalance,
  getInvoicePaidAmount,
  getInvoiceTotal,
  isInvoiceFullyPaid,
  isInvoicePartiallyPaid,
  getInvoicePaymentStatus,
} from "./invoiceBalance";
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

describe("invoiceBalance - shared balance calculation helper", () => {
  describe("getInvoiceTotal", () => {
    it("returns correct total for simple invoice", () => {
      const invoice = makeInvoice({ items: [{ id: "1", description: "Item", quantity: 2, unitPrice: 100 }] });
      expect(getInvoiceTotal(invoice)).toBe(200);
    });

    it("includes GST in total", () => {
      const invoice = makeInvoice({
        items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
      });
      // 100 + 9 + 9 = 118
      expect(getInvoiceTotal(invoice)).toBe(118);
    });

    it("applies discount", () => {
      const invoice = makeInvoice({
        items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }],
        discount: 10,
      });
      expect(getInvoiceTotal(invoice)).toBe(90);
    });

    it("applies roundOff", () => {
      const invoice = makeInvoice({
        items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }],
        roundOff: 0.5,
      });
      expect(getInvoiceTotal(invoice)).toBe(100.5);
    });
  });

  describe("getInvoicePaidAmount", () => {
    it("returns 0 for no payments", () => {
      const invoice = makeInvoice();
      expect(getInvoicePaidAmount(invoice, [])).toBe(0);
    });

    it("sums payments for the invoice", () => {
      const invoice = makeInvoice();
      const payments = [
        makePayment(invoice, 50),
        makePayment(invoice, 30),
      ];
      expect(getInvoicePaidAmount(invoice, payments)).toBe(80);
    });

    it("ignores payments for other invoices", () => {
      const invoice = makeInvoice({ id: "inv-1" });
      const otherInvoice = makeInvoice({ id: "inv-2" });
      const payments = [
        makePayment(invoice, 50),
        makePayment(otherInvoice, 100),
      ];
      expect(getInvoicePaidAmount(invoice, payments)).toBe(50);
    });
  });

  describe("getInvoiceOutstandingBalance", () => {
    it("returns full total for unpaid invoice", () => {
      const invoice = makeInvoice({ items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }] });
      expect(getInvoiceOutstandingBalance(invoice, [])).toBe(100);
    });

    it("returns remaining balance for partially paid invoice", () => {
      const invoice = makeInvoice({ items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }] });
      const payments = [makePayment(invoice, 30)];
      expect(getInvoiceOutstandingBalance(invoice, payments)).toBe(70);
    });

    it("returns 0 for fully paid invoice", () => {
      const invoice = makeInvoice({ items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }] });
      const payments = [makePayment(invoice, 100)];
      expect(getInvoiceOutstandingBalance(invoice, payments)).toBe(0);
    });

    it("returns 0 for overpaid invoice (never negative)", () => {
      const invoice = makeInvoice({ items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }] });
      const payments = [makePayment(invoice, 150)];
      expect(getInvoiceOutstandingBalance(invoice, payments)).toBe(0);
    });

    it("works with GST", () => {
      const invoice = makeInvoice({
        items: [{ id: "1", description: "Item", quantity: 1, unitPrice: 100 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
      });
      const payments = [makePayment(invoice, 50)];
      // Total = 118, paid = 50, outstanding = 68
      expect(getInvoiceOutstandingBalance(invoice, payments)).toBe(68);
    });
  });

  describe("isInvoiceFullyPaid", () => {
    it("returns false for unpaid invoice", () => {
      const invoice = makeInvoice();
      expect(isInvoiceFullyPaid(invoice, [])).toBe(false);
    });

    it("returns false for partially paid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 50)];
      expect(isInvoiceFullyPaid(invoice, payments)).toBe(false);
    });

    it("returns true for fully paid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 100)];
      expect(isInvoiceFullyPaid(invoice, payments)).toBe(true);
    });

    it("returns true for overpaid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 150)];
      expect(isInvoiceFullyPaid(invoice, payments)).toBe(true);
    });
  });

  describe("isInvoicePartiallyPaid", () => {
    it("returns false for unpaid invoice", () => {
      const invoice = makeInvoice();
      expect(isInvoicePartiallyPaid(invoice, [])).toBe(false);
    });

    it("returns true for partially paid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 50)];
      expect(isInvoicePartiallyPaid(invoice, payments)).toBe(true);
    });

    it("returns false for fully paid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 100)];
      expect(isInvoicePartiallyPaid(invoice, payments)).toBe(false);
    });

    it("returns false for overpaid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 150)];
      expect(isInvoicePartiallyPaid(invoice, payments)).toBe(false);
    });
  });

  describe("getInvoicePaymentStatus", () => {
    it("returns 'unpaid' for unpaid invoice", () => {
      const invoice = makeInvoice();
      expect(getInvoicePaymentStatus(invoice, [])).toBe("unpaid");
    });

    it("returns 'partially_paid' for partially paid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 50)];
      expect(getInvoicePaymentStatus(invoice, payments)).toBe("partially_paid");
    });

    it("returns 'paid' for fully paid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 100)];
      expect(getInvoicePaymentStatus(invoice, payments)).toBe("paid");
    });

    it("returns 'paid' for overpaid invoice", () => {
      const invoice = makeInvoice();
      const payments = [makePayment(invoice, 150)];
      expect(getInvoicePaymentStatus(invoice, payments)).toBe("paid");
    });
  });
});