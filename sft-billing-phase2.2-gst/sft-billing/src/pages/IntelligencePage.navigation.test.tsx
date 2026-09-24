import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntelligencePage } from "./IntelligencePage";
import { activeDataProvider } from "@/services";
import { mockClients, mockInvoices, mockPayments } from "@/data";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

function resetNavigationState() {
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedClientId: null,
    pendingInvoiceFilter: null,
    selectedPaymentId: null,
    paymentReceiptReturnState: null,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetNavigationState();
});

describe("Intelligence invoice navigation", () => {
  it("opens the stable invoice id carried by an attention item", async () => {
    const targetInvoice = mockInvoices.find((candidate) => candidate.id === "iv_acme_overdue_strong1");
    if (!targetInvoice) throw new Error("Expected seeded overdue invoice fixture");

    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue(mockInvoices);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(mockPayments);

    render(<IntelligencePage />);

    const invoiceNumber = await screen.findByText(targetInvoice.number);
    const attentionRow = invoiceNumber.closest("button");
    if (!attentionRow) throw new Error("Expected an invoice-level Intelligence attention action");
    fireEvent.click(attentionRow);

    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
    expect(useWorkspaceStore.getState().selectedInvoiceId).toBe(targetInvoice.id);
  });
});
