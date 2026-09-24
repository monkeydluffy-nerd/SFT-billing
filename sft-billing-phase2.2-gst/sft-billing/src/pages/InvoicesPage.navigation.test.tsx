import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvoicesPage } from "./InvoicesPage";
import { activeDataProvider } from "@/services";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { Client, Invoice } from "@/types";

const client: Client = {
  id: "client-invoices-navigation",
  name: "Invoices Client",
  contactName: "Accounts",
  email: "accounts@example.com",
  billingAddress: "1 Test Street",
  clientSince: "2026-01-01",
};

const invoice: Invoice = {
  id: "invoice-invoices-navigation",
  number: "INV-INVOICES-42",
  clientId: client.id,
  issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  items: [{ id: "line-invoices-navigation", description: "Consulting", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: new Date().toISOString(),
};

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

describe("Invoices invoice-number navigation", () => {
  it("opens the exact invoice detail id instead of a filtered invoice list", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([client]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    useWorkspaceStore.setState({ currentPage: "invoices", selectedInvoiceId: "different-invoice" });

    render(<InvoicesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Open invoice INV-INVOICES-42" }));

    const state = useWorkspaceStore.getState();
    expect(state.currentPage).toBe("invoice-detail");
    expect(state.selectedInvoiceId).toBe(invoice.id);
    expect(state.currentPage).not.toBe("invoices");
    expect(state.pendingInvoiceFilter).toBeNull();
  });
});
