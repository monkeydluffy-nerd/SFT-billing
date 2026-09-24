import { describe, expect, it } from "vitest";
import { buildPaymentReportRows } from "./reports";
import { mockClients, mockInvoices } from "@/data";
import type { Payment } from "@/types";

describe("Reports stable invoice-id passthrough", () => {
  it("keeps the payment's exact invoice id alongside its display number", () => {
    const invoice = mockInvoices[0];
    const payment: Payment = {
      id: "payment-report-row",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 100,
      method: "cash",
      receivedAt: invoice.issueDate,
    };

    expect(buildPaymentReportRows([payment], [invoice], mockClients)).toEqual([
      expect.objectContaining({
        id: payment.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
      }),
    ]);
  });
});
