import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OverviewPage } from "./OverviewPage";
import { activeDataProvider } from "@/services";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { Client, Invoice } from "@/types";

const client: Client = {
  id: "client-overview-navigation",
  name: "Overview Client",
  contactName: "Accounts",
  email: "accounts@example.com",
  billingAddress: "1 Test Street",
};

const invoice: Invoice = {
  id: "invoice-overview-navigation",
  number: "INV-OVERVIEW-42",
  clientId: client.id,
  issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  items: [{ id: "line-overview-navigation", description: "Consulting", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: new Date().toISOString(),
};

function resetNavigationState() {
  useWorkspaceStore.setState({
    currentPage: "overview",
    overviewFocus: null,
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

describe("Overview invoice-number navigation", () => {
  it("opens the exact focused invoice detail id instead of the summary dashboard or invoice list", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([client]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getActivity").mockResolvedValue([]);
    useWorkspaceStore.setState({ currentPage: "overview", overviewFocus: "pending" });

    render(<OverviewPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Open invoice INV-OVERVIEW-42" }, { timeout: 5000 }));

    const state = useWorkspaceStore.getState();
    expect(state.currentPage).toBe("invoice-detail");
    expect(state.selectedInvoiceId).toBe(invoice.id);
    expect(state.currentPage).not.toBe("overview");
    expect(state.currentPage).not.toBe("invoices");
  });
});
