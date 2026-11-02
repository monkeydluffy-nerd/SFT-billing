import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentsPage } from "./PaymentsPage";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { Invoice, Payment } from "@/types";

const invoice: Invoice = {
  id: "invoice-payments-integration",
  number: "INV-PAYMENTS-INTEGRATION",
  clientId: mockClients[0].id,
  issueDate: "2025-06-01T00:00:00.000Z",
  dueDate: "2025-06-30T00:00:00.000Z",
  items: [{ id: "line-payments-integration", description: "Integration service", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: "2025-06-01T00:00:00.000Z",
};

function fillPaymentForm(dialog: HTMLElement, proof?: File) {
  fireEvent.change(within(dialog).getByLabelText("Invoice"), { target: { value: invoice.id } });
  fireEvent.change(within(dialog).getByLabelText("Amount"), { target: { value: "500" } });
  fireEvent.change(within(dialog).getByLabelText("Method"), { target: { value: "upi" } });
  if (proof) {
    fireEvent.change(within(dialog).getByLabelText(/Proof/), { target: { files: [proof] } });
  }
}

function mockPaymentLookups(getPayments: () => Promise<Payment[]>) {
  vi.spyOn(activeDataProvider, "getPayments").mockImplementation(getPayments);
  vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
  vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
}

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.setState({ selectedPaymentId: null });
});

describe("PaymentsPage payment proof integration", () => {
  it("rejects a new payment that exceeds the remaining invoice balance", async () => {
    const priorPayment: Payment = {
      id: "payment-partial-ui",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "upi",
      receivedAt: "2025-06-10T00:00:00.000Z",
    };
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment");
    mockPaymentLookups(async () => [priorPayment]);

    render(<PaymentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }, { timeout: 5000 }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    fillPaymentForm(dialog);
    fireEvent.change(within(dialog).getByLabelText("Amount"), { target: { value: "700" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));

    // Use screen.findByText instead of within(dialog) to avoid stale reference after re-render
    expect(await screen.findByText(/Amount cannot exceed outstanding balance of/)).toBeInTheDocument();
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("submits a no-proof payment and refreshes from the provider", async () => {
    const persistedPayment: Payment = {
      id: "payment-no-proof-ui",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "upi",
      receivedAt: "2025-06-10T00:00:00.000Z",
    };
    const getPayments = vi.fn().mockResolvedValue([]);
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockResolvedValue({ payment: persistedPayment });
    mockPaymentLookups(getPayments);

    render(<PaymentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }, { timeout: 5000 }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    fillPaymentForm(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));

    await waitFor(() => expect(recordPayment).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(recordPayment.mock.calls[0][1]).toBeUndefined();
    expect(recordPayment.mock.calls[0][0]).toMatchObject({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "upi",
    });
    await waitFor(() => expect(getPayments).toHaveBeenCalledTimes(2), { timeout: 5000 });
  });

  it("shows proof-bearing payment state only after the provider reload returns persisted metadata", async () => {
    const persistedPayment: Payment = {
      id: "payment-proof-reload-ui",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "upi",
      receivedAt: "2025-06-10T00:00:00.000Z",
      paymentProof: {
        fileName: "persisted-proof.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12,
        uploadedAt: "2025-06-10T00:01:00.000Z",
        attachmentReference: "payment-proofs/payment-proof-reload-ui/proof-token",
      },
    };
    let readCount = 0;
    const getPayments = vi.fn().mockImplementation(async () => {
      readCount += 1;
      return readCount === 1 ? [] : [persistedPayment];
    });
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockResolvedValue({ payment: persistedPayment });
    mockPaymentLookups(getPayments);

    render(<PaymentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }, { timeout: 5000 }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    const proof = new File(["persisted-proof"], persistedPayment.paymentProof!.fileName, { type: "application/pdf" });
    fillPaymentForm(dialog, proof);
    fireEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));

    await waitFor(() => expect(recordPayment).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(recordPayment.mock.calls[0][1]).toMatchObject({
      fileName: proof.name,
      mimeType: proof.type,
      content: proof,
    });
    await waitFor(() => expect(getPayments).toHaveBeenCalledTimes(2), { timeout: 5000 });
    fireEvent.click(await screen.findByRole("button", { name: /Proof attached/ }));
    expect(await screen.findByRole("dialog", { name: "Payment Details" })).toBeInTheDocument();
    expect(screen.getByText(persistedPayment.paymentProof!.fileName)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Payment" }));
    expect(await screen.findByRole("button", { name: "Replace proof" })).toBeInTheDocument();
  });
});
