import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { activeDataProvider } from "@/services";
import type { Invoice, Payment, RecordPaymentResult } from "@/types";

const invoice: Invoice = {
  id: "iv_payment_modal_validation",
  number: "INV-PAYMENT-VALIDATION",
  clientId: "cl_payment_modal_validation",
  issueDate: "2025-06-01T00:00:00.000Z",
  dueDate: "2025-06-30T00:00:00.000Z",
  items: [{ id: "line_payment_modal_validation", description: "Service", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: "2025-06-01T00:00:00.000Z",
};

const basePayment: Payment = {
  id: "pm_payment_modal",
  invoiceId: invoice.id,
  clientId: invoice.clientId,
  amount: 500,
  method: "upi",
  receivedAt: "2025-06-10T00:00:00.000Z",
  reference: "PAY-REF",
};

function renderModal(
  props: Partial<React.ComponentProps<typeof RecordPaymentModal>> = {},
) {
  return render(
    <RecordPaymentModal
      open
      onClose={vi.fn()}
      invoices={[invoice]}
      clients={[]}
      onRecorded={vi.fn()}
      {...props}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecordPaymentModal payment validation", () => {
  it("rejects missing invoice, amount, and method without calling the provider", () => {
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment");

    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    expect(screen.getByText("Select an invoice.")).toBeInTheDocument();
    expect(screen.getByText("Enter an amount greater than zero.")).toBeInTheDocument();
    expect(screen.getByText("Select a payment method.")).toBeInTheDocument();
    expect(recordPayment).not.toHaveBeenCalled();
  });
});

describe("RecordPaymentModal proof boundary", () => {
  it("submits one optional proof file through the provider and returns its persisted result", async () => {
    const persistedPayment: Payment = {
      ...basePayment,
      paymentProof: {
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12,
        uploadedAt: "2025-06-10T00:01:00.000Z",
        attachmentReference: "payment-proofs/pm_payment_modal/proof-token",
      },
    };
    const result: RecordPaymentResult = { payment: persistedPayment };
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockResolvedValue(result);
    const onRecorded = vi.fn();
    const onPersisted = vi.fn();
    const file = new File(["proof"], "receipt.pdf", { type: "application/pdf" });

    renderModal({ onRecorded, onPersisted });

    fireEvent.change(screen.getByLabelText("Invoice"), { target: { value: invoice.id } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "upi" } });
    fireEvent.change(screen.getByLabelText(/Proof/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(result));
    expect(onPersisted).toHaveBeenCalledWith(result);
    expect(recordPayment).toHaveBeenCalledTimes(1);

    const [submittedPayment, submittedProof] = recordPayment.mock.calls[0];
    expect(submittedPayment).toMatchObject({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "upi",
    });
    expect(submittedPayment).not.toHaveProperty("paymentProof");
    expect(submittedProof).toMatchObject({
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
      sizeBytes: file.size,
      content: file,
    });
  });

  it("keeps the same payment and prior proof visible when replacement fails", async () => {
    const priorPayment: Payment = {
      ...basePayment,
      paymentProof: {
        fileName: "original-proof.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20,
        uploadedAt: "2025-06-10T00:01:00.000Z",
        attachmentReference: "payment-proofs/pm_payment_modal/original-token",
      },
    };
    const proofError = {
      code: "proof_unavailable" as const,
      stage: "readback" as const,
      message: "Payment was recorded, but its proof could not be read back. Retry the proof upload.",
      paymentId: priorPayment.id,
      retryable: true,
    };
    const result: RecordPaymentResult = {
      payment: priorPayment,
      proofError,
    };
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockResolvedValue(result);
    const onRecorded = vi.fn();
    const onPersisted = vi.fn();
    const file = new File(["replacement"], "replacement-proof.pdf", { type: "application/pdf" });

    renderModal({ paymentToReplace: priorPayment, onRecorded, onPersisted });

    expect(await screen.findByText("original-proof.pdf")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Proof/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Replace proof" }));

    expect(await screen.findByText(proofError.message)).toBeInTheDocument();
    expect(screen.getByText("original-proof.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove proof/i })).not.toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
    expect(onPersisted).toHaveBeenCalledWith(result);

    const [submittedPayment, submittedProof] = recordPayment.mock.calls[0];
    expect(submittedPayment).toEqual({
      id: priorPayment.id,
      invoiceId: priorPayment.invoiceId,
      clientId: priorPayment.clientId,
      amount: priorPayment.amount,
      method: priorPayment.method,
      receivedAt: priorPayment.receivedAt,
      reference: priorPayment.reference,
    });
    expect(submittedProof).toMatchObject({ fileName: file.name, content: file });
  });
});

describe("Task 6.3 retained payment and replacement flows", () => {
  it("records a valid payment without proof through the provider boundary", async () => {
    const onRecorded = vi.fn();
    const onPersisted = vi.fn();
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockImplementation(async (submittedPayment) => ({
      payment: { ...submittedPayment },
    }));

    renderModal({ onRecorded, onPersisted });

    fireEvent.change(screen.getByLabelText("Invoice"), { target: { value: invoice.id } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "upi" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));

    const [submittedPayment, submittedProof] = recordPayment.mock.calls[0];
    expect(submittedPayment).toMatchObject({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 500,
      method: "upi",
    });
    expect(submittedPayment).not.toHaveProperty("paymentProof");
    expect(submittedProof).toBeUndefined();
    expect(onPersisted).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({ id: submittedPayment.id, invoiceId: invoice.id }),
      }),
    );
    expect(onRecorded.mock.calls[0][0].payment.id).toBe(submittedPayment.id);
  });

  const retainedProofFailures = [
    {
      stage: "write" as const,
      code: "proof_storage_failed" as const,
      message: "Payment was recorded, but proof storage failed. Retry the proof upload.",
    },
    {
      stage: "readback" as const,
      code: "proof_unavailable" as const,
      message: "Payment was recorded, but proof readback failed. Retry the proof upload.",
    },
    {
      stage: "metadata_enrichment" as const,
      code: "proof_storage_failed" as const,
      message: "Payment was recorded, but proof metadata could not be saved. Retry the proof upload.",
    },
  ];

  it.each(retainedProofFailures)(
    "retains the same payment and shows an actionable $stage proof error",
    async ({ stage, code, message }) => {
      const onRecorded = vi.fn();
      const onPersisted = vi.fn();
      const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockImplementation(async (submittedPayment) => ({
        payment: { ...submittedPayment },
        proofError: {
          code,
          stage,
          message,
          paymentId: submittedPayment.id,
          retryable: true,
        },
      }));
      const file = new File([`${stage}-failure`], `${stage}-failure.pdf`, { type: "application/pdf" });

      renderModal({ onRecorded, onPersisted });

      fireEvent.change(screen.getByLabelText("Invoice"), { target: { value: invoice.id } });
      fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "500" } });
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "upi" } });
      fireEvent.change(screen.getByLabelText(/Proof/), { target: { files: [file] } });
      fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

      await waitFor(() => expect(recordPayment).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));

      const submittedPayment = recordPayment.mock.calls[0][0];
      const persistedResult = onPersisted.mock.calls[0][0] as RecordPaymentResult;
      expect(persistedResult.payment.id).toBe(submittedPayment.id);
      expect(persistedResult.payment.invoiceId).toBe(invoice.id);
      expect(persistedResult.payment.paymentProof).toBeUndefined();
      expect(persistedResult.proofError).toMatchObject({
        code,
        stage,
        paymentId: submittedPayment.id,
      });
      expect(screen.getByText("The payment was recorded without proof. Choose a file to retry.")).toBeInTheDocument();
      expect(onRecorded).not.toHaveBeenCalled();
    },
  );

  it("keeps the prior proof visible until a replacement is successfully enriched", async () => {
    const priorPayment: Payment = {
      ...basePayment,
      paymentProof: {
        fileName: "prior-proof.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        uploadedAt: "2025-06-10T00:01:00.000Z",
        attachmentReference: "payment-proofs/pm_payment_modal/prior-token",
      },
    };
    const replacementProof = {
      fileName: "new-proof.pdf",
      mimeType: "application/pdf",
      sizeBytes: 11,
      uploadedAt: "2025-06-10T00:02:00.000Z",
      attachmentReference: "payment-proofs/pm_payment_modal/new-token",
    };
    const onRecorded = vi.fn();
    let resolveSubmission: ((result: RecordPaymentResult) => void) | undefined;
    const recordPayment = vi.spyOn(activeDataProvider, "recordPayment").mockImplementation(
      () => new Promise((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    const file = new File(["replacement"], replacementProof.fileName, { type: replacementProof.mimeType });

    renderModal({ paymentToReplace: priorPayment, onRecorded });

    expect(await screen.findByText(priorPayment.paymentProof!.fileName)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Proof/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Replace proof" }));

    await waitFor(() => expect(recordPayment).toHaveBeenCalledTimes(1));
    expect(screen.getByText(priorPayment.paymentProof!.fileName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    const submittedPayment = recordPayment.mock.calls[0][0];
    expect(submittedPayment).toMatchObject({
      id: priorPayment.id,
      invoiceId: priorPayment.invoiceId,
      amount: priorPayment.amount,
      method: priorPayment.method,
    });
    expect(resolveSubmission).toBeDefined();
    resolveSubmission?.({ payment: { ...priorPayment, paymentProof: replacementProof } });

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    expect(onRecorded.mock.calls[0][0].payment).toMatchObject({
      id: priorPayment.id,
      invoiceId: priorPayment.invoiceId,
      paymentProof: replacementProof,
    });
  });
});
