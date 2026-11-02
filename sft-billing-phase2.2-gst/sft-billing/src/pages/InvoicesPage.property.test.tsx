import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { InvoicesPage } from "./InvoicesPage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import type { Invoice, Payment } from "@/types";

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

describe("Feature: core-business-system, Property 6: Removed actions never appear", () => {
  it("no 'Mark paid' and no 'Duplicate' action renders anywhere on the Invoices_Page, for any invoice mix", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }), fc.nat(), async (draftFlags, seed) => {
        const invoices: Invoice[] = draftFlags.map((isDraft, i) =>
          makeInvoice({
            id: `iv_${seed}_${i}`,
            number: `INV-${seed}-${i}`,
            isDraft,
            billedAt: isDraft ? undefined : "2025-05-01T00:00:00.000Z",
          }),
        );
        const payments: Payment[] = [];

        vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue(invoices);
        vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
        vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(payments);

        useWorkspaceStore.setState({ currentPage: "invoices", pendingInvoiceFilter: null });

        const { unmount, container } = render(<InvoicesPage />);

        // Wait for invoice row expand buttons (client name + chevron per row)
        await waitFor(() =>
          expect(
            container.querySelectorAll('button[aria-expanded][aria-label^="Expand invoice"], button[aria-expanded][aria-label^="Collapse invoice"]').length
          ).toBe(invoices.length * 2),
        );

        // Expand every row to reveal its action buttons.
        const toggles = Array.from(
          container.querySelectorAll('button[aria-expanded][aria-label^="Expand invoice"], button[aria-expanded][aria-label^="Collapse invoice"]')
        );
        toggles.forEach((toggle) => fireEvent.click(toggle));

        await waitFor(() => {
          expect(within(container).queryByRole("button", { name: /Mark paid/i })).not.toBeInTheDocument();
          expect(within(container).queryByRole("button", { name: /Duplicate/i })).not.toBeInTheDocument();
        });

        unmount();
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  }, 120000);
});
