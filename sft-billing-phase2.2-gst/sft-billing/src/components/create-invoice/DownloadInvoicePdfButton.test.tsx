import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Invoice } from "@/types";
import { activeDataProvider } from "@/services";
import { DownloadInvoicePdfButton } from "./DownloadInvoicePdfButton";

const invoice: Invoice = {
  id: "invoice-pdf-1",
  number: "001/2026-27",
  clientId: "client-1",
  issueDate: "2026-10-22",
  dueDate: "2026-11-06",
  items: [{ id: "item-1", description: "Consulting", quantity: 1, unitPrice: 100 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
};

describe("DownloadInvoicePdfButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads the backend PDF converted from the invoice template", async () => {
    vi.spyOn(activeDataProvider, "getInvoicePdf").mockResolvedValue({
      blob: new Blob(["pdf"]),
      warnings: [],
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:invoice-pdf"),
      revokeObjectURL: vi.fn(),
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadInvoicePdfButton invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "PDF downloaded" })).toBeInTheDocument(),
    );
    expect(activeDataProvider.getInvoicePdf).toHaveBeenCalledWith(invoice.id);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("shows an explicit error when PDF conversion is unavailable", async () => {
    vi.spyOn(activeDataProvider, "getInvoicePdf").mockRejectedValue(
      new Error("Excel could not convert the invoice template to PDF."),
    );

    render(<DownloadInvoicePdfButton invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Excel could not convert the invoice template to PDF.",
    );
  });
});
