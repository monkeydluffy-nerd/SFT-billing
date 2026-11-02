import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SendInvoiceModal } from "./SendInvoiceModal";
import { activeDataProvider } from "@/services";
import { downloadInvoiceTemplate } from "@/services/invoiceTemplateDownloadService";
import { mockClients } from "@/data/mockClients";
import type { Invoice } from "@/types";

vi.mock("@/services/invoiceTemplateDownloadService", () => ({
  downloadInvoiceTemplate: vi.fn().mockResolvedValue({
    fileName: "Invoice_INV-1001.pdf",
    warnings: [],
  }),
}));

function makeBilledInvoice(): Invoice {
  return {
    id: "iv_billed_1",
    number: "INV-1001",
    clientId: mockClients[0].id,
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-16T00:00:00.000Z",
    items: [{ id: "line-1", description: "Consulting", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2025-05-02T10:00:00.000Z",
  };
}

describe("Send_Invoice_Action", () => {
  it("discloses that confirmation records the send state without external delivery", async () => {
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    const invoice = makeBilledInvoice();

    render(<SendInvoiceModal open onClose={() => {}} invoice={invoice} onSent={() => {}} />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/records invoice .* as sent/i);
    expect(dialog).toHaveTextContent(/no email or external message will be sent/i);
    expect(dialog).not.toHaveTextContent(/will email/i);

    vi.restoreAllMocks();
  });

  it("sets sentAt and records one activity without changing billing state", async () => {
    const invoice = makeBilledInvoice();
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.mocked(downloadInvoiceTemplate).mockResolvedValue({
      fileName: "Invoice_INV-1001.pdf",
      warnings: [],
    });
    vi.spyOn(window, "open").mockReturnValue(null);
    const saveSpy = vi.spyOn(activeDataProvider, "saveInvoice").mockResolvedValue(invoice);
    const activitySpy = vi.spyOn(activeDataProvider, "addActivityEvent").mockResolvedValue({
      id: "event-1",
      type: "invoice_sent",
      occurredAt: "2025-05-03T10:00:00.000Z",
      summary: "Invoice sent",
    });
    const onSent = vi.fn();

    render(<SendInvoiceModal open onClose={() => {}} invoice={invoice} onSent={onSent} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Send invoice$/i }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const saved = saveSpy.mock.calls[0][0] as Invoice;
    expect(saved.isDraft).toBe(false);
    expect(saved.billedAt).toBe(invoice.billedAt);
    expect(saved.sentAt).toBeTruthy();
    expect(activitySpy).toHaveBeenCalledTimes(1);
    expect(activitySpy.mock.calls[0][0]).toMatchObject({ type: "invoice_sent", invoiceId: invoice.id });
    expect(onSent).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });
});
