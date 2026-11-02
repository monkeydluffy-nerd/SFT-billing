import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateInvoicePage } from "./CreateInvoicePage";
import { activeDataProvider } from "@/services";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import { mockClients } from "@/data/mockClients";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { Invoice } from "@/types";

const draftInvoice: Invoice = {
  id: "iv_layout",
  number: "INV-LAYOUT",
  clientId: "cl_acme",
  issueDate: "2025-05-01T00:00:00.000Z",
  dueDate: "2025-05-20T00:00:00.000Z",
  items: [{ id: "li_layout", description: "Consulting", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: true,
};

describe("CreateInvoicePage layout", () => {
  beforeEach(() => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([draftInvoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    vi.spyOn(activeDataProvider, "releaseReservation").mockResolvedValue({ released: true, invoiceId: draftInvoice.id });
    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: { invoiceId: draftInvoice.id },
      selectedClientId: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the invoice builder and actions in normal page flow without a document preview", async () => {
    const { container } = render(
      <main className="flex-1 overflow-y-auto">
        <CreateInvoicePage />
      </main>,
    );

    // Wait for loading to complete - the component shows "Loading..." while draft is null
    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    await screen.findByRole("button", { name: /Round to nearest/ });

    const main = container.querySelector("main");
    const page = main?.querySelector(":scope > div.min-h-full");
    const content = page?.querySelector(":scope > div.invoice-create-layout");
    const footer = page && Array.from(page.children).find((child) => child.classList.contains("border-t"));

    expect(main).toHaveClass("overflow-y-auto");
    expect(page).not.toBeNull();
    expect(page?.querySelectorAll(".overflow-y-auto")).toHaveLength(0);
    expect(content).not.toHaveClass("overflow-y-auto");
    expect(content).not.toHaveClass("flex-1");
    expect(footer).toBeDefined();
    expect(footer).not.toHaveClass("sticky", "fixed");

    expect(screen.getByRole("button", { name: /Round to nearest/ })).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-document-page")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download invoice/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save as draft/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bill invoice/ })).toBeInTheDocument();
    expect(screen.getByText("Total due")).toBeInTheDocument();
  });

  it("shows reservation failures and retries invoice initialization", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    vi.spyOn(activeDataProvider, "releaseReservation").mockResolvedValue({ released: true, invoiceId: "test" });
    const reserveNumber = vi
      .spyOn(activeDataProvider, "reserveInvoiceNumber")
      .mockRejectedValueOnce(new Error("Invoice number reservation failed."))
      .mockResolvedValue("030/2026-27");
    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: null,
      selectedClientId: null,
    });

    render(<CreateInvoicePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invoice number reservation failed.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByRole("button", { name: /Bill invoice/i });
    await waitFor(() => expect(reserveNumber).toHaveBeenCalledTimes(2));
  });
});