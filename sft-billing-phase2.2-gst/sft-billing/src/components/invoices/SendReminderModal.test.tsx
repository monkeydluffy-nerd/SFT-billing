import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SendReminderModal } from "./SendReminderModal";
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
    id: "iv_outstanding_1",
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

describe("Send_Reminder_Action", () => {
  it("records one activity on confirmation and does not deliver an external message", async () => {
    const invoice = makeBilledInvoice();
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.mocked(downloadInvoiceTemplate).mockResolvedValue({
      fileName: "Invoice_INV-1001.pdf",
      warnings: [],
    });
    vi.spyOn(window, "open").mockReturnValue(null);
    const activitySpy = vi.spyOn(activeDataProvider, "addActivityEvent").mockResolvedValue({
      id: "event-1",
      type: "invoice_reminder_sent",
      occurredAt: "2025-05-03T10:00:00.000Z",
      summary: "Reminder recorded",
    });
    const onSent = vi.fn();

    render(<SendReminderModal open onClose={() => {}} invoice={invoice} onSent={onSent} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/no email is actually sent/i);

    fireEvent.click(screen.getByRole("button", { name: /^Send reminder$/i }));
    await waitFor(() => expect(activitySpy).toHaveBeenCalledTimes(1));
    expect(activitySpy.mock.calls[0][0]).toMatchObject({ type: "invoice_reminder_sent", invoiceId: invoice.id });
    expect(invoice).toMatchObject({
      isDraft: false,
      billedAt: "2025-05-02T10:00:00.000Z",
    });
    expect(invoice.sentAt).toBeUndefined();
    expect(onSent).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it("does not record an activity when confirmation is cancelled", async () => {
    const invoice = makeBilledInvoice();
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    const activitySpy = vi.spyOn(activeDataProvider, "addActivityEvent");
    const onClose = vi.fn();

    render(<SendReminderModal open onClose={onClose} invoice={invoice} onSent={() => {}} />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(activitySpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });
});
