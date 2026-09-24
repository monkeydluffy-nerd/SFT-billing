import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { InvoicePage } from "./InvoicePage";
import { activeDataProvider } from "@/services";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice, Payment } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-detail-1",
    number: "INV-1001",
    clientId: "cl_acme",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-20T00:00:00.000Z",
    items: [{ id: "line-1", description: "Consulting", quantity: 2, unitPrice: 500 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2025-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockDetailData(invoice: Invoice, payments: Payment[] = []) {
  vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
  vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(payments);
  vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
  vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedPaymentId: null,
    paymentReceiptReturnState: null,
  });
});

describe("InvoicePage stable-id navigation states", () => {
  it("shows a provider error instead of treating the selected id as missing", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockRejectedValue(new Error("Invoice service unavailable"));
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: "invoice-42" });

    render(<InvoicePage />);

    await waitFor(() => expect(screen.getByText("Couldn't load invoice")).toBeInTheDocument());
    expect(screen.getByText("Invoice service unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Invoice not found")).not.toBeInTheDocument();
  });

  it("shows an explicit not-found state and Back action for a stale stable invoice id", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: "stale-invoice" });

    render(<InvoicePage />);

    await waitFor(() => expect(screen.getByText("Invoice not found")).toBeInTheDocument());
    expect(screen.getByText("This invoice may have been removed.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back to invoices/i }));
    expect(useWorkspaceStore.getState().currentPage).toBe("invoices");
  });

  it("shows not-found for a missing selected invoice id without resolving the first available invoice", async () => {
    const availableInvoice = makeInvoice({ id: "available-invoice", number: "INV-AVAILABLE" });
    mockDetailData(availableInvoice);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: null });

    render(<InvoicePage />);

    await waitFor(() => expect(screen.getByText("Invoice not found")).toBeInTheDocument());
    expect(screen.queryByText(availableInvoice.number)).not.toBeInTheDocument();
    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");

    fireEvent.click(screen.getByRole("button", { name: /Back to invoices/i }));
    expect(useWorkspaceStore.getState().currentPage).toBe("invoices");
  });

  it("renders an explicit loading state while the selected invoice is unresolved", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockImplementation(() => new Promise<Invoice[]>(() => {}));
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: "loading-invoice" });

    render(<InvoicePage />);

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders the full shared document and billed print/download actions", async () => {
    const invoice = makeInvoice();
    mockDetailData(invoice);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: invoice.id });

    render(<InvoicePage />);

    const model = buildInvoiceDocumentModel({ invoice, client: undefined, business: mockBusinessProfile });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    await waitFor(() => expect(screen.getByTestId("invoice-document")).toBeInTheDocument());
    const documentRegion = screen.getByTestId("invoice-document");
    expect(within(documentRegion).getByText("TAX INVOICE")).toBeInTheDocument();
    expect(within(documentRegion).getAllByText("SFT Billing Services").length).toBeGreaterThan(0);
    expect(within(documentRegion).getByText("Consulting")).toBeInTheDocument();
    expect(
      within(documentRegion).getByText(
        `\u20B9 ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(model.totals.total)}`,
      ),
    ).toBeInTheDocument();
    expect(within(documentRegion).getByText(model.totals.amountInWords)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download invoice" })).toBeInTheDocument();
    expect(screen.getByText("Payment history")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Print / PDF" }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("opens a payment receipt from invoice detail payment history", async () => {
    const invoice = makeInvoice();
    const payment: Payment = {
      id: "payment-detail-1",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "bank_transfer",
      receivedAt: "2025-05-10T00:00:00.000Z",
    };
    mockDetailData(invoice, [payment]);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: invoice.id });

    render(<InvoicePage />);

    await waitFor(() => expect(screen.getByText("Payment history")).toBeInTheDocument());
    const paymentHistory = screen.getByRole("region", { name: "Payment history" });
    fireEvent.click(within(paymentHistory).getByText(formatCurrency(payment.amount)));

    await waitFor(() => expect(useWorkspaceStore.getState().selectedPaymentId).toBe(payment.id));
    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
  });

  it("renders the shared document for a draft and keeps only continuation editing", async () => {
    const invoice = makeInvoice({ isDraft: true, billedAt: undefined });
    mockDetailData(invoice);
    useWorkspaceStore.setState({ currentPage: "invoice-detail", selectedInvoiceId: invoice.id });

    render(<InvoicePage />);

    await waitFor(() => expect(screen.getByTestId("invoice-document")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Continue editing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Print / PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download invoice" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(useWorkspaceStore.getState().currentPage).toBe("create-invoice");
    expect(useWorkspaceStore.getState().invoiceDraftPrefill?.invoiceId).toBe(invoice.id);
  });
});
