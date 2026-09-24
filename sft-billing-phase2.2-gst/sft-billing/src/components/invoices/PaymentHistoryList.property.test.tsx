import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { render, fireEvent } from "@testing-library/react";
import { PaymentHistoryList } from "./PaymentHistoryList";
import type { Payment } from "@/types";

const paymentArb = fc.record({
  id: fc.uuid(),
  invoiceId: fc.constantFrom("inv_a", "inv_b", "inv_c"),
  clientId: fc.constant("cl_1"),
  amount: fc.integer({ min: 1, max: 100000 }),
  method: fc.constantFrom<Payment["method"]>("bank_transfer", "card", "upi", "cheque", "cash"),
  receivedAt: fc.constant("2025-05-01T00:00:00.000Z"),
});

describe("Feature: core-business-system, Property 11: Detail page payment history is exactly that invoice's payments, each linking to its own receipt", () => {
  it("renders exactly the payments passed in, and each row opens the receipt for its own payment id", () => {
    fc.assert(
      fc.property(fc.uniqueArray(paymentArb, { selector: (p) => p.id, maxLength: 8 }), (payments) => {
        const opened: string[] = [];
        const { getAllByRole, unmount } = render(
          <PaymentHistoryList payments={payments} onOpenReceipt={(id) => opened.push(id)} />,
        );

        if (payments.length === 0) {
          unmount();
          return;
        }

        const rows = getAllByRole("button");
        expect(rows.length).toBe(payments.length);

        rows.forEach((row, i) => {
          fireEvent.click(row);
          expect(opened[opened.length - 1]).toBe(payments[i].id);
        });

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
