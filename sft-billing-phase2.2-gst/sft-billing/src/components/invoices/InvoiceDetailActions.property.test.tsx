import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, screen } from "@testing-library/react";
import { InvoiceDetailActions } from "./InvoiceDetailActions";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import type { Invoice, InvoiceLedgerStatusInfo } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_1",
    number: "INV-1",
    clientId: "cl_acme",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-20T00:00:00.000Z",
    items: [{ id: "li_1", description: "Consulting", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: true,
    ...overrides,
  };
}

const noop = () => {};

describe("Feature: core-business-system, Property 5: Row and Detail actions are fully determined by draft/billed state and ledger status", () => {
  it("Draft_Invoice shows only Continue editing; Billed_Invoice shows Send always, Reminder iff outstanding/overdue, Record payment iff not received", async () => {
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.option(fc.constant("2025-04-01T00:00:00.000Z"), { nil: undefined }),
        fc.constantFrom<InvoiceLedgerStatusInfo["status"]>("outstanding", "overdue", "received"),
        async (isDraft, sentAt, ledgerStatus) => {
          const invoice = makeInvoice({ isDraft, sentAt, billedAt: isDraft ? undefined : "2025-05-01T00:00:00.000Z" });
          const ledgerInfo: InvoiceLedgerStatusInfo | null = isDraft
            ? null
            : { status: ledgerStatus, daysOverdue: ledgerStatus === "overdue" ? 5 : 0, severity: ledgerStatus === "overdue" ? "mild" : null };

          const { unmount } = render(
            <InvoiceDetailActions
              invoice={invoice}
              ledgerInfo={ledgerInfo}
              onContinueEditing={noop}
              onSent={noop}
              onReminderSent={noop}
              onPaymentRecorded={noop}
            />,
          );

          if (isDraft) {
            expect(screen.getByRole("button", { name: /Continue editing/i })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /Send invoice/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /Resend invoice/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /Send reminder/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /Record payment/i })).not.toBeInTheDocument();
          } else {
            expect(screen.queryByRole("button", { name: /Continue editing/i })).not.toBeInTheDocument();
            const sendLabel = sentAt ? /Resend invoice/i : /^Send invoice$/i;
            expect(screen.getByRole("button", { name: sendLabel })).toBeInTheDocument();

            const remindButton = screen.queryByRole("button", { name: /Send reminder/i });
            if (ledgerStatus === "outstanding" || ledgerStatus === "overdue") {
              expect(remindButton).toBeInTheDocument();
            } else {
              expect(remindButton).not.toBeInTheDocument();
            }

            const recordButton = screen.queryByRole("button", { name: /Record payment/i });
            if (ledgerStatus === "received") {
              expect(recordButton).not.toBeInTheDocument();
            } else {
              expect(recordButton).toBeInTheDocument();
            }
          }

          unmount();
        },
      ),
      { numRuns: 100 },
    );

    vi.restoreAllMocks();
  });
});
