import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, screen, waitFor } from "@testing-library/react";
import { CreateInvoicePage } from "./CreateInvoicePage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import type { Invoice } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_scope",
    number: "INV-SCOPE",
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

describe("Feature: core-business-system, Property 3: Send Invoice availability is exactly \"billed invoice, on the Detail page\"", () => {
  it("Create_Invoice_Page never renders a Send/Resend invoice affordance, for any invoice state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.option(fc.constant("2025-04-01T00:00:00.000Z"), { nil: undefined }), fc.nat(), async (isDraft, sentAt, seed) => {
        const invoice = makeInvoice({ id: `iv_scope_${seed}`, isDraft, sentAt, billedAt: isDraft ? undefined : "2025-05-01T00:00:00.000Z" });

        vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
        vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
        vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
        vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);

        useWorkspaceStore.setState({
          currentPage: "create-invoice",
          invoiceDraftPrefill: { invoiceId: invoice.id },
        });

        const { unmount } = render(<CreateInvoicePage />);
        await waitFor(() => expect(screen.getByRole("button", { name: /Bill invoice/i })).toBeInTheDocument());

        expect(screen.queryByRole("button", { name: /Send invoice/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Resend invoice/i })).not.toBeInTheDocument();

        unmount();
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  }, 120000);
});
