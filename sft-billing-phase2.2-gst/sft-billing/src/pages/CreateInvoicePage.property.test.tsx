import { describe, expect, it, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CreateInvoicePage } from "./CreateInvoicePage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import type { Invoice } from "@/types";

// Fast, deterministic stand-ins for the mock data provider's async calls,
// so the property test can run many iterations quickly and predictably —
// only the invoice-lifecycle-relevant calls are stubbed.
function makeDraftInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_test_1",
    number: "INV-TEST-1",
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

describe("Feature: core-business-system, Property 1 & 2: Billing sets billedAt/clears draft without touching sentAt, and confirming persists + navigates", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: null,
      selectedClientId: null,
    });
  });

  it("confirming Bill invoice on an existing draft (any prior sentAt) sets isDraft:false and billedAt, leaves sentAt untouched, saves, and navigates to Invoices", async () => {
    await fc.assert(
      fc.asyncProperty(fc.option(fc.constant("2025-04-01T00:00:00.000Z"), { nil: undefined }), fc.nat(), async (priorSentAt, seed) => {
        const draft = makeDraftInvoice({ id: `iv_prop_${seed}`, sentAt: priorSentAt });

        vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([draft]);
        vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
        vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
        vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
        const saveSpy = vi.spyOn(activeDataProvider, "saveInvoice").mockResolvedValue(draft);
        vi.spyOn(activeDataProvider, "addActivityEvent").mockResolvedValue({
          id: "ev_1",
          type: "invoice_created",
          occurredAt: draft.issueDate,
          summary: "x",
        });

        useWorkspaceStore.setState({
          currentPage: "create-invoice",
          invoiceDraftPrefill: { invoiceId: draft.id },
        });

        const { unmount, findByRole } = render(<CreateInvoicePage />);

        try {
          const billButton = await findByRole("button", { name: /Bill invoice/i }, { timeout: 5000 });
          fireEvent.click(billButton);

          const dialog = await findByRole("dialog", {}, { timeout: 5000 });
          const confirmButton = within(dialog).getByRole("button", { name: /^Bill invoice$/i });
          fireEvent.click(confirmButton);

          await waitFor(() => expect(saveSpy).toHaveBeenCalled());
          const savedInvoice = saveSpy.mock.calls[0][0] as Invoice;

          expect(savedInvoice.isDraft).toBe(false);
          expect(savedInvoice.billedAt).toBeTruthy();
          expect(savedInvoice.sentAt).toBe(priorSentAt);

          await waitFor(() => expect(useWorkspaceStore.getState().currentPage).toBe("invoices"), { timeout: 2000 });
        } finally {
          unmount();
          vi.restoreAllMocks();
        }
      }),
      { numRuns: 100 },
    );
  }, 180000);
});

describe("Unit: Bill/Send modal wording", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: null,
      selectedClientId: null,
    });
  });

  it("the billing confirmation modal contains no email-sending language", async () => {
    const draft = makeDraftInvoice();
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([draft]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);

    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: { invoiceId: draft.id },
    });

    render(<CreateInvoicePage />);

    const billButton = await screen.findByRole("button", { name: /Bill invoice/i }, { timeout: 5000 });
    fireEvent.click(billButton);

    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    expect(within(dialog).getByText(/Bill this invoice\?/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/will email/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/sent to/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/not be emailed/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});

describe("Unit: Save as draft preserves lifecycle state", () => {
  it("persists an existing draft without billing it or creating a duplicate activity", async () => {
    const sentAt = "2025-04-01T00:00:00.000Z";
    const draft = makeDraftInvoice({ id: "iv_save_draft", number: "INV-SAVE-1", sentAt });
    const saveSpy = vi.spyOn(activeDataProvider, "saveInvoice").mockResolvedValue(draft);
    const activitySpy = vi.spyOn(activeDataProvider, "addActivityEvent");

    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([draft]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: { invoiceId: draft.id },
      selectedClientId: null,
    });

    const { unmount, findByRole } = render(<CreateInvoicePage />);
    try {
      fireEvent.click(await findByRole("button", { name: /Save as draft/i }, { timeout: 5000 }));

      await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
      const saved = saveSpy.mock.calls[0][0] as Invoice;
      expect(saved).toMatchObject({
        id: draft.id,
        number: draft.number,
        isDraft: true,
        sentAt,
      });
      expect(saved.billedAt).toBeUndefined();
      expect(activitySpy).not.toHaveBeenCalled();
      await waitFor(() => expect(useWorkspaceStore.getState().currentPage).toBe("invoices"));
    } finally {
      unmount();
      vi.restoreAllMocks();
    }
  });
});
