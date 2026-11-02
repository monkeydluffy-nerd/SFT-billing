import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { SendInvoiceModal } from "./SendInvoiceModal";
import { activeDataProvider } from "@/services";
import { downloadInvoiceTemplate } from "@/services/invoiceTemplateDownloadService";
import { mockClients } from "@/data/mockClients";
import type { Invoice } from "@/types";

vi.mock("@/services/invoiceTemplateDownloadService", () => ({
  downloadInvoiceTemplate: vi.fn().mockResolvedValue({
    fileName: "Invoice_INV-1.pdf",
    warnings: [],
  }),
}));

function makeBilledInvoice(overrides: Partial<Invoice> = {}): Invoice {
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
    isDraft: false,
    billedAt: "2025-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Feature: core-business-system, Property 4: Sending sets sentAt without touching billedAt, and label follows sentAt", () => {
  it("confirming Send/Resend sets sentAt, preserves billedAt, and reads the correct label per prior sentAt", async () => {
    await fc.assert(
      fc.asyncProperty(fc.option(fc.constant("2025-04-15T00:00:00.000Z"), { nil: undefined }), async (priorSentAt) => {
        const invoice = makeBilledInvoice({ sentAt: priorSentAt });
        vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
        vi.mocked(downloadInvoiceTemplate).mockResolvedValue({
          fileName: "Invoice_INV-1.pdf",
          warnings: [],
        });
        vi.spyOn(window, "open").mockReturnValue(null);
        const saveSpy = vi.spyOn(activeDataProvider, "saveInvoice").mockResolvedValue(invoice);
        vi.spyOn(activeDataProvider, "addActivityEvent").mockResolvedValue({
          id: "ev_1",
          type: "invoice_sent",
          occurredAt: new Date().toISOString(),
          summary: "x",
        });

        const onSent = vi.fn();
        const { findByRole, unmount } = render(
          <SendInvoiceModal open onClose={() => {}} invoice={invoice} onSent={onSent} />,
        );

        const expectedLabel = priorSentAt ? "Resend invoice" : "Send invoice";
        const dialog = await findByRole("dialog");
        expect(dialog.textContent).toContain(priorSentAt ? "Resend this invoice?" : "Send this invoice?");

        const confirmButton = await findByRole("button", { name: expectedLabel });
        fireEvent.click(confirmButton);

        await waitFor(() => expect(saveSpy).toHaveBeenCalled());
        const saved = saveSpy.mock.calls[0][0] as Invoice;
        expect(saved.sentAt).not.toBe(priorSentAt);
        expect(saved.sentAt).toBeTruthy();
        expect(saved.billedAt).toBe(invoice.billedAt);

        unmount();
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  }, 30000);
});
