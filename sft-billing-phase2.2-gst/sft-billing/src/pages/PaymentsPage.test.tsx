import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentsPage } from "./PaymentsPage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import type { Invoice, Payment, PaymentProof, RecordPaymentResult } from "@/types";

const invoice: Invoice = {
  id: "iv_1",
  number: "INV-1",
  clientId: mockClients[0].id,
  issueDate: "2025-05-01T00:00:00.000Z",
  dueDate: "2025-05-20T00:00:00.000Z",
  items: [{ id: "li_1", description: "x", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: "2025-05-01T00:00:00.000Z",
};

const payment: Payment = {
  id: "pm_1",
  invoiceId: invoice.id,
  clientId: invoice.clientId,
  amount: 1180,
  method: "upi",
  receivedAt: "2025-05-10T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedPaymentId: null,
    pendingInvoiceFilter: null,
    paymentReceiptReturnState: null,
  });
});

describe("Unit: Payment_Receipt_View reachability from Payments_Page", () => {
  it("activating the invoice number opens the exact invoice detail id, not the payment receipt", async () => {
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([payment]);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    useWorkspaceStore.setState({ currentPage: "payments", selectedInvoiceId: "different-invoice" });

    render(<PaymentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Open invoice INV-1" }));

    const state = useWorkspaceStore.getState();
    expect(state.currentPage).toBe("invoice-detail");
    expect(state.selectedInvoiceId).toBe(invoice.id);
    expect(state.selectedPaymentId).toBeNull();
    expect(state.currentPage).not.toBe("payments");
  });
});

describe("PaymentsPage persisted proof state", () => {
  it("renders the provider's persisted proof metadata and replaces it through the same record boundary", async () => {
    const persistedPayment: Payment = {
      ...payment,
      paymentProof: {
        fileName: "persisted-receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 18,
        uploadedAt: "2025-05-10T00:01:00.000Z",
        attachmentReference: "payment-proofs/pm_1/current-token",
      },
    };
    const replacementProof: PaymentProof = {
      fileName: "replacement-receipt.pdf",
      mimeType: persistedPayment.paymentProof!.mimeType,
      sizeBytes: persistedPayment.paymentProof!.sizeBytes,
      uploadedAt: "2025-05-10T00:02:00.000Z",
      attachmentReference: persistedPayment.paymentProof!.attachmentReference,
    };
    const replacement: Payment = {
      ...persistedPayment,
      paymentProof: replacementProof,
    };
    const result: RecordPaymentResult = { payment: replacement };
    const getPayments = vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([persistedPayment]);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockResolvedValue(result);
    const file = new File(["replacement"], "replacement-receipt.pdf", { type: "application/pdf" });

    render(<PaymentsPage />);

    expect(await screen.findByText("Proof: persisted-receipt.pdf")).toBeInTheDocument();
    expect(screen.queryByText(persistedPayment.paymentProof!.attachmentReference)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replace proof for payment pm_1" }));
    expect(await screen.findByText("persisted-receipt.pdf")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Proof/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Replace proof" }));

    await waitFor(() => expect(recordPayment).toHaveBeenCalledTimes(1));
    expect(recordPayment.mock.calls[0][0]).toMatchObject({
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      method: payment.method,
    });
    expect(recordPayment.mock.calls[0][0]).not.toHaveProperty("paymentProof");
    expect(recordPayment.mock.calls[0][1]).toMatchObject({ fileName: file.name, content: file });
    await waitFor(() => expect(getPayments).toHaveBeenCalledTimes(2));
  });
});
