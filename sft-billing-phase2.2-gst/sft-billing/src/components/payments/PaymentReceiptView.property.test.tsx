import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { PaymentReceiptView } from "./PaymentReceiptView";
import { activeDataProvider } from "@/services";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { METHOD_LABELS } from "@/lib/paymentLabels";
import type { Invoice, Payment } from "@/types";

function makeInvoice(id: string): Invoice {
  return {
    id,
    number: `INV-${id}`,
    clientId: "cl_acme",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-20T00:00:00.000Z",
    items: [{ id: "li_1", description: "x", quantity: 1, unitPrice: 100 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2025-05-01T00:00:00.000Z",
  };
}

describe("Feature: core-business-system, Property 13: Payment receipt fields and invoice link always match the underlying payment", () => {
  it("displays the exact amount/method/receivedAt/reference and navigates to the correct invoice on link click", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom<Payment["method"]>("bank_transfer", "card", "upi", "cheque", "cash"),
        fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
        fc.nat(),
        async (amount, method, reference, seed) => {
          const invoiceId = `inv_${seed}`;
          const invoice = makeInvoice(invoiceId);
          const payment: Payment = {
            id: `pm_${seed}`,
            invoiceId,
            clientId: "cl_acme",
            amount,
            method,
            receivedAt: "2025-05-10T00:00:00.000Z",
            reference,
          };

          vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([payment]);
          vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);

          useWorkspaceStore.setState({ selectedInvoiceId: null, currentPage: "payments" });
          cleanup();

          const { findAllByRole, unmount } = render(<PaymentReceiptView paymentId={payment.id} onClose={() => {}} />);
          const dialogs = await findAllByRole("dialog");
          const dialog = dialogs[dialogs.length - 1];

          await waitFor(() => expect(dialog.textContent).toContain(formatCurrency(amount)));
          expect(dialog.textContent).toContain(METHOD_LABELS[method]);
          expect(dialog.textContent).toContain(formatDate(payment.receivedAt));
          expect(dialog.textContent).toContain(reference ?? "—");

          const invoiceLink = within(dialog).getByText(invoice.number);
          fireEvent.click(invoiceLink);
          await waitFor(() => expect(useWorkspaceStore.getState().selectedInvoiceId).toBe(invoiceId));
          expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");

          unmount();
          cleanup();
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  }, 120000);
});
