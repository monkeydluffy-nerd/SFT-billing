import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Invoice } from "@/types";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import { mockClients } from "@/data/mockClients";
import { activeDataProvider } from "@/services";
import * as invoicePdfService from "@/services/invoicePdfService";
import { DownloadInvoiceButton } from "./DownloadInvoiceButton";

const draft: Invoice = {
  id: "invoice-download-draft",
  number: "INV-DOWNLOAD-1",
  clientId: mockClients[0].id,
  issueDate: "2025-05-01T00:00:00.000Z",
  dueDate: "2025-05-16T00:00:00.000Z",
  items: [{ id: "line-download", description: "Consulting", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: true,
};

describe("Download invoice lifecycle semantics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to the existing export boundary without billing or saving the draft", async () => {
    const exportSpy = vi.spyOn(invoicePdfService, "downloadInvoicePdf").mockResolvedValue("INV-DOWNLOAD-1.pdf");
    const saveSpy = vi.spyOn(activeDataProvider, "saveInvoice").mockResolvedValue(draft);

    const { unmount } = render(
      <DownloadInvoiceButton invoice={draft} client={mockClients[0]} business={mockBusinessProfile} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Download invoice/i }));

    await waitFor(() => expect(exportSpy).toHaveBeenCalledTimes(1));
    expect(exportSpy).toHaveBeenCalledWith({ invoice: draft, client: mockClients[0], business: mockBusinessProfile });
    expect(saveSpy).not.toHaveBeenCalled();
    expect(draft).toMatchObject({ isDraft: true });
    expect(draft.billedAt).toBeUndefined();

    unmount();
  });
});
