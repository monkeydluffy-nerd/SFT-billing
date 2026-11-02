import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PaymentReceiptView } from "./PaymentReceiptView";
import { activeDataProvider } from "@/services";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { BusinessProfile, Client, Invoice, Payment } from "@/types";

const onClose = vi.fn();

function makeInvoice(): Invoice {
  return {
    id: "invoice-1",
    number: "INV-1001",
    clientId: "client-1",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-20T00:00:00.000Z",
    items: [{ id: "line-1", description: "Consulting", quantity: 1, unitPrice: 100 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2025-05-01T00:00:00.000Z",
  };
}

function makeClient(): Client {
  return {
    id: "client-1",
    name: "Acme Industries",
    contactName: "Asha Rao",
    email: "accounts@acme.example",
    phone: "+91 90000 00000",
    billingAddress: "1 Main Street, Chennai 600001",
    gstin: "33AAAAA0000A1Z5",
  };
}

function mockReceiptData({
  payment,
  invoice,
  client,
  business,
}: {
  payment: Payment;
  invoice?: Invoice;
  client?: Client;
  business?: BusinessProfile;
}) {
  vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([payment]);
  vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue(invoice ? [invoice] : []);
  vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(client ? [client] : []);
  vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(business as BusinessProfile);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onClose.mockReset();
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedPaymentId: null,
    paymentReceiptReturnState: null,
  });
});

describe("PaymentReceiptView navigation and document states", () => {
  it("renders an explicit loading state while receipt records are unresolved", async () => {
    vi.spyOn(activeDataProvider, "getPayments").mockImplementation(() => new Promise<Payment[]>(() => {}));
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);

    render(<PaymentReceiptView paymentId="loading-payment" onClose={onClose} />);

    expect(await screen.findByRole("status")).toHaveTextContent("Loading payment receipt…");
  });

  it("shows an explicit provider error instead of treating the payment as missing", async () => {
    vi.spyOn(activeDataProvider, "getPayments").mockRejectedValue(new Error("Receipt service unavailable"));
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);

    render(<PaymentReceiptView paymentId="payment-42" onClose={onClose} />);

    await waitFor(() => expect(screen.getByText("Couldn't load payment receipt")).toBeInTheDocument());
    expect(screen.getByText("Receipt service unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Payment not found")).not.toBeInTheDocument();
  });

  it("renders a printable receipt projection and links to the exact associated invoice", async () => {
    const invoice = makeInvoice();
    const client = makeClient();
    const payment: Payment = {
      id: "payment-1",
      invoiceId: invoice.id,
      clientId: client.id,
      amount: 100,
      method: "upi",
      receivedAt: "2025-05-10T00:00:00.000Z",
      reference: "UTR-123",
    };
    mockReceiptData({ payment, invoice, client, business: mockBusinessProfile });
    useWorkspaceStore.setState({ currentPage: "payments" });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(<PaymentReceiptView paymentId={payment.id} onClose={onClose} />);

    const receipt = await screen.findByTestId("payment-receipt");
    expect(within(receipt).getByRole("heading", { name: "Payment receipt" })).toBeInTheDocument();
    expect(within(receipt).getByText(payment.id)).toBeInTheDocument();
    expect(within(receipt).getByText(invoice.number)).toBeInTheDocument();
    expect(within(receipt).getByText(client.name)).toBeInTheDocument();
    expect(within(receipt).getByText("10 May 2025")).toBeInTheDocument();
    expect(within(receipt).getByText("₹100")).toBeInTheDocument();
    expect(within(receipt).getByText("UPI")).toBeInTheDocument();
    expect(within(receipt).getByText(payment.reference as string)).toBeInTheDocument();
    expect(within(receipt).getByText(mockBusinessProfile.name)).toBeInTheDocument();
    expect(within(receipt).getByText(mockBusinessProfile.address)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Print receipt" }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(within(receipt).getByRole("button", { name: `Open invoice ${invoice.number}` }));
    await waitFor(() => expect(useWorkspaceStore.getState().selectedInvoiceId).toBe(invoice.id));
    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
  });

  it("shows a not-found state for a stale payment id with a return action", async () => {
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);

    render(<PaymentReceiptView paymentId="stale-payment" onClose={onClose} />);

    await waitFor(() => expect(screen.getByText("Payment not found")).toBeInTheDocument());
    expect(screen.getByText("This payment may have been removed.")).toBeInTheDocument();

    screen.getByRole("button", { name: "Close" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the payment visible when its invoice is unavailable without guessing another invoice", async () => {
    const payment: Payment = {
      id: "payment-1",
      invoiceId: "missing-invoice",
      clientId: "client-1",
      amount: 100,
      method: "cash",
      receivedAt: "2025-05-10T00:00:00.000Z",
    };
    mockReceiptData({ payment, business: mockBusinessProfile });

    render(<PaymentReceiptView paymentId={payment.id} onClose={onClose} />);

    const receipt = await screen.findByTestId("payment-receipt");
    expect(within(receipt).getByText("Invoice unavailable")).toBeInTheDocument();
    expect(within(receipt).getByText("₹100")).toBeInTheDocument();
    expect(within(receipt).queryByRole("button", { name: /Open invoice/ })).not.toBeInTheDocument();
  });

  it("shows missing customer and proof-unavailable states without exposing an attachment reference", async () => {
    const invoice = makeInvoice();
    const payment: Payment = {
      id: "payment-1",
      invoiceId: invoice.id,
      clientId: "missing-client",
      amount: 100,
      method: "cash",
      receivedAt: "2025-05-10T00:00:00.000Z",
      paymentProof: {
        fileName: "proof.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        uploadedAt: "2025-05-10T00:00:00.000Z",
        attachmentReference: "",
      },
    };
    mockReceiptData({ payment, invoice, business: undefined });

    render(<PaymentReceiptView paymentId={payment.id} onClose={onClose} />);

    const receipt = await screen.findByTestId("payment-receipt");
    expect(within(receipt).getByText("Customer unavailable")).toBeInTheDocument();
    expect(within(receipt).getByText("Business details unavailable")).toBeInTheDocument();
    expect(within(receipt).getByTestId("payment-proof-unavailable")).toBeInTheDocument();
    expect(within(receipt).getByText("Proof unavailable")).toBeInTheDocument();
    expect(receipt.textContent).not.toContain("attachmentReference");
  });
});
