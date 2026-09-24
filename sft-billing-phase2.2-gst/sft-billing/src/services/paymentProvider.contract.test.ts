import { afterEach, describe, expect, it, vi } from "vitest";
import { apiDataProvider } from "./apiDataProvider";
import { mockDataProvider } from "./mockDataProvider";
import type { Payment, PaymentProofUpload } from "@/types";

function makePayment(id: string): Payment {
  return {
    id,
    invoiceId: "iv_provider_contract",
    clientId: "cl_provider_contract",
    amount: 1250,
    method: "upi",
    receivedAt: "2025-06-15T10:30:00.000Z",
    reference: "CONTRACT-REF",
  };
}

function makeProof(fileName: string): PaymentProofUpload {
  return {
    fileName,
    mimeType: "application/pdf",
    sizeBytes: 13,
    content: new Blob(["proof-content"], { type: "application/pdf" }),
  };
}

function asApiPayment(payment: Payment, snakeCaseProof = false): Record<string, unknown> {
  const { paymentProof, ...paymentFields } = payment;
  return {
    ...paymentFields,
    ...(paymentProof
      ? {
          [snakeCaseProof ? "payment_proof" : "paymentProof"]: snakeCaseProof
            ? {
                file_name: paymentProof.fileName,
                mime_type: paymentProof.mimeType,
                size_bytes: paymentProof.sizeBytes,
                uploaded_at: paymentProof.uploadedAt,
                attachment_reference: paymentProof.attachmentReference,
              }
            : paymentProof,
        }
      : {}),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 422 ? "Unprocessable Entity" : "OK",
    json: async () => body,
  } as Response;
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body, status));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DataProvider payment contract", () => {
  it("records a payment without proof and retrieves the same durable payment", async () => {
    const payment = makePayment("pm_provider_no_proof");

    const result = await mockDataProvider.recordPayment(payment);
    const reloaded = (await mockDataProvider.getPayments()).find((item) => item.id === payment.id);

    expect(result).toEqual({ payment });
    expect(reloaded).toEqual(payment);
  });

  it("records one proof and persists its metadata with the exact payment", async () => {
    const payment = makePayment("pm_provider_with_proof");
    const proof = makeProof("payment-receipt.pdf");

    const result = await mockDataProvider.recordPayment(payment, proof);
    const persisted = (await mockDataProvider.getPayments()).find((item) => item.id === payment.id);

    expect(result.proofError).toBeUndefined();
    expect(result.payment).toMatchObject({
      ...payment,
      paymentProof: {
        fileName: proof.fileName,
        mimeType: proof.mimeType,
        sizeBytes: proof.sizeBytes,
      },
    });
    expect(result.payment.paymentProof?.attachmentReference).toMatch(
      new RegExp(`^payment-proofs/${payment.id}/`),
    );
    expect(persisted).toEqual(result.payment);
  });

  it("keeps mock and API response mapping in parity for JSON and multipart submissions", async () => {
    const noProofPayment = makePayment("pm_provider_api_no_proof");
    const mockNoProof = await mockDataProvider.recordPayment(noProofPayment);
    const noProofFetch = stubFetch(asApiPayment(mockNoProof.payment));

    const apiNoProof = await apiDataProvider.recordPayment(noProofPayment);
    expect(apiNoProof).toEqual(mockNoProof);
    expect(noProofFetch).toHaveBeenCalledTimes(1);
    const [noProofUrl, noProofInit] = noProofFetch.mock.calls[0];
    expect(noProofUrl).toMatch(/\/api\/payments$/);
    expect(noProofInit?.method).toBe("POST");
    expect(JSON.parse(String(noProofInit?.body))).toEqual(
      JSON.parse(JSON.stringify(asApiPayment(noProofPayment))),
    );

    const proofPayment = makePayment("pm_provider_api_with_proof");
    const proofUpload = makeProof("api-payment-proof.pdf");
    const mockWithProof = await mockDataProvider.recordPayment(proofPayment, proofUpload);
    const proofFetch = stubFetch({ payment: asApiPayment(mockWithProof.payment, true) });

    const apiWithProof = await apiDataProvider.recordPayment(proofPayment, proofUpload);
    expect(apiWithProof).toEqual(mockWithProof);
    expect(proofFetch).toHaveBeenCalledTimes(1);
    const [proofUrl, proofInit] = proofFetch.mock.calls[0];
    expect(proofUrl).toMatch(/\/api\/payments$/);
    expect(proofInit?.method).toBe("POST");
    expect(proofInit?.body).toBeInstanceOf(FormData);
    const formData = proofInit?.body as FormData;
    expect(formData.get("id")).toBe(proofPayment.id);
    expect(formData.get("invoiceId")).toBe(proofPayment.invoiceId);
    expect((formData.get("proof") as File | null)?.name).toBe(proofUpload.fileName);
  });

  it("maps persisted proof metadata returned by API payment reads", async () => {
    const payment: Payment = {
      ...makePayment("pm_provider_api_reload"),
      paymentProof: {
        fileName: "reloaded-proof.pdf",
        mimeType: "application/pdf",
        sizeBytes: 24,
        uploadedAt: "2025-06-15T11:00:00.000Z",
        attachmentReference: "payment-proofs/pm_provider_api_reload/proof-stable",
      },
    };
    stubFetch([asApiPayment(payment, true)]);

    const reloaded = await apiDataProvider.getPayments();

    expect(reloaded).toEqual([payment]);
  });

  it("returns the retained mock payment with one actionable proof error", async () => {
    const payment = makePayment("pm_provider_mock_proof_error");
    const invalidProof = { ...makeProof("invalid-proof.pdf"), sizeBytes: -1 };

    const result = await mockDataProvider.recordPayment(payment, invalidProof);
    const reloaded = (await mockDataProvider.getPayments()).find((item) => item.id === payment.id);

    expect(result.payment).toEqual(payment);
    expect(result.payment.paymentProof).toBeUndefined();
    expect(result.proofError).toMatchObject({
      code: "proof_invalid",
      stage: "write",
      paymentId: payment.id,
      retryable: false,
    });
    expect(result.proofError?.message).toBeTruthy();
    expect(Object.keys(result)).toHaveLength(2);
    expect(reloaded).toEqual(payment);
  });

  it("maps a retained-payment proof-error envelope without throwing", async () => {
    const payment = makePayment("pm_provider_api_proof_error");
    const proofError = {
      code: "proof_unavailable",
      stage: "readback",
      message: "Payment proof could not be read back; retry the upload.",
      paymentId: payment.id,
      retryable: true,
    } as const;
    stubFetch(
      {
        detail: {
          payment: asApiPayment(payment),
          proofError,
        },
      },
      422,
    );

    const result = await apiDataProvider.recordPayment(payment, makeProof("unavailable-proof.pdf"));

    expect(result).toEqual({ payment, proofError });
    expect(result.payment.paymentProof).toBeUndefined();
  });

  it("replaces one proof in place through recordPayment without a separate public mutation contract", async () => {
    const payment = makePayment("pm_provider_replacement");
    await mockDataProvider.recordPayment(payment, makeProof("original-proof.pdf"));

    const replacementUpload = makeProof("replacement-proof.pdf");
    const mockReplacement = await mockDataProvider.recordPayment(payment, replacementUpload);
    const matchingPayments = (await mockDataProvider.getPayments()).filter((item) => item.id === payment.id);

    expect(mockReplacement.payment.id).toBe(payment.id);
    expect(mockReplacement.payment.invoiceId).toBe(payment.invoiceId);
    expect(mockReplacement.payment.paymentProof?.fileName).toBe(replacementUpload.fileName);
    expect(matchingPayments).toHaveLength(1);
    expect(matchingPayments[0]).toEqual(mockReplacement.payment);
    expect("replacePayment" in mockDataProvider).toBe(false);

    const apiFetch = stubFetch({ payment: asApiPayment(mockReplacement.payment, true) });
    const apiReplacement = await apiDataProvider.recordPayment(payment, replacementUpload);
    const [, apiInit] = apiFetch.mock.calls[0];

    expect(apiReplacement).toEqual(mockReplacement);
    expect(apiInit?.method).toBe("POST");
    expect(apiInit?.body).toBeInstanceOf(FormData);
    expect((apiInit?.body as FormData).get("id")).toBe(payment.id);
    expect("replacePayment" in apiDataProvider).toBe(false);
  });
});
