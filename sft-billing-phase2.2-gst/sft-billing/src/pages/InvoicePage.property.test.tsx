import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, waitFor, within } from "@testing-library/react";
import { InvoicePage } from "./InvoicePage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import { computeInvoiceTotals, getInvoiceLedgerStatus } from "@/lib/invoiceMath";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice, Payment } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_detail",
    number: "INV-DETAIL",
    clientId: "cl_acme",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-20T00:00:00.000Z",
    items: [{ id: "li_1", description: "Consulting", quantity: 2, unitPrice: 500 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2025-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Feature: core-business-system, Property 10: Detail page totals and ledger status always match the calculation layer", () => {
  it("renders the same total and ledger status the Invoice_Math_Module computes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 50000 }),
        fc.integer({ min: 0, max: 60000 }),
        fc.integer({ min: -30, max: 30 }),
        fc.nat(),
        async (quantity, unitPrice, paidAmount, dueOffsetDays, seed) => {
          const dueDate = new Date(Date.now() + dueOffsetDays * 86400000).toISOString();
          const invoice = makeInvoice({
            id: `iv_detail_${seed}`,
            dueDate,
            items: [{ id: "li_1", description: "x", quantity, unitPrice }],
          });
          const payments: Payment[] = paidAmount > 0
            ? [{ id: `pm_${seed}`, invoiceId: invoice.id, clientId: invoice.clientId, amount: paidAmount, method: "bank_transfer", receivedAt: invoice.issueDate }]
            : [];

          vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
          vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(payments);
          vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);

          useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: invoice.id });

          const { unmount, container } = render(<InvoicePage />);

          const expectedTotals = computeInvoiceTotals(invoice);
          const expectedLedger = getInvoiceLedgerStatus(invoice, payments);
          expect(expectedLedger).not.toBeNull();
          if (!expectedLedger) {
            unmount();
            return;
          }

          await waitFor(() => expect(within(container).getAllByText(formatCurrency(expectedTotals.total)).length).toBeGreaterThan(0));

          if (expectedLedger.status === "received") {
            expect(within(container).getAllByText("Received").length).toBeGreaterThan(0);
          } else if (expectedLedger.status === "outstanding") {
            expect(within(container).getAllByText("Outstanding").length).toBeGreaterThan(0);
          } else {
            expect(
              within(container).getAllByText(expectedLedger.daysOverdue === 1 ? "1 day overdue" : `${expectedLedger.daysOverdue} days overdue`).length,
            ).toBeGreaterThan(0);
          }

          unmount();
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  }, 120000);
});
