import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Invoice } from "@/types";
import { activeDataProvider } from "@/services";
import { DownloadInvoiceExcelButton } from "./DownloadInvoiceExcelButton";

const invoice: Invoice = {
  id: "invoice-excel-1",
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

describe("DownloadInvoiceExcelButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads the backend workbook and surfaces omitted-template-field warnings", async () => {
    vi.spyOn(activeDataProvider, "getInvoiceExcel").mockResolvedValue({
      blob: new Blob(["xlsx"]),
      warnings: ["Client state", "Package count"],
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:invoice-export"),
      revokeObjectURL: vi.fn(),
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadInvoiceExcelButton invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: "Download Excel" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Excel downloaded" })).toBeInTheDocument());
    expect(activeDataProvider.getInvoiceExcel).toHaveBeenCalledWith(invoice.id);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveAttribute(
      "title",
      "Client state\nPackage count",
    );
  });

  it("shows a clear error when the backend export is unavailable", async () => {
    vi.spyOn(activeDataProvider, "getInvoiceExcel").mockRejectedValue(
      new Error("Excel invoice export requires the backend API provider."),
    );

    render(<DownloadInvoiceExcelButton invoice={invoice} />);
    fireEvent.click(screen.getByRole("button", { name: "Download Excel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Excel invoice export requires the backend API provider.",
    );
  });
});
