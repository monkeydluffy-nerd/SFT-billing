import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReportsPage } from "./ReportsPage";
import { activeDataProvider } from "@/services";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { Client, Invoice, Payment } from "@/types";

const client: Client = {
  id: "client-reports-navigation",
  name: "Reports Client",
  contactName: "Accounts",
  email: "accounts@example.com",
  billingAddress: "1 Test Street",
};

const invoice: Invoice = {
  id: "invoice-reports-navigation",
  number: "INV-REPORTS-42",
  clientId: client.id,
  issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  items: [{ id: "line-reports-navigation", description: "Consulting", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: new Date().toISOString(),
};

const payment: Payment = {
  id: "payment-reports-navigation",
  invoiceId: invoice.id,
  clientId: client.id,
  amount: 1180,
  method: "bank_transfer",
  receivedAt: new Date().toISOString(),
};

const overdueInvoice: Invoice = {
  ...invoice,
  id: "invoice-reports-overdue-navigation",
  number: "INV-REPORTS-OVERDUE-42",
  dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
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

describe("Reports invoice navigation", () => {
  it.each([
    { report: "Revenue", invoiceNumber: invoice.number, invoiceId: invoice.id },
    { report: "Invoices", invoiceNumber: invoice.number, invoiceId: invoice.id },
    { report: "Payments", invoiceNumber: invoice.number, invoiceId: invoice.id },
    { report: "Outstanding", invoiceNumber: invoice.number, invoiceId: invoice.id },
    { report: "Overdue", invoiceNumber: overdueInvoice.number, invoiceId: overdueInvoice.id },
  ])("opens the exact detail id from the $report table", async ({ report, invoiceNumber, invoiceId }) => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice, overdueInvoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([client]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([payment]);

    render(<ReportsPage />);

    fireEvent.click(await screen.findByRole("tab", { name: report }));
    const buttons = await screen.findAllByRole("button", { name: `Open invoice ${invoiceNumber}` });
    fireEvent.click(buttons[0]);

    const state = useWorkspaceStore.getState();
    expect(state.currentPage).toBe("invoice-detail");
    expect(state.selectedInvoiceId).toBe(invoiceId);
    expect(state.currentPage).not.toBe("invoices");
    expect(state.currentPage).not.toBe("overview");
    expect(state.pendingInvoiceFilter).toBeNull();
  });
});
