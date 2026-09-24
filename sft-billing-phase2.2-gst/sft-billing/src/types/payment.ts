export type PaymentMethod = "bank_transfer" | "card" | "upi" | "cheque" | "cash";

/** Metadata for the one current proof attachment associated with a payment. */
export interface PaymentProof {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string; // ISO timestamp
  /** Opaque, application-managed reference; never a browser or filesystem path. */
  attachmentReference: string;
}

/** Input-only proof upload; binary content is not persisted in the domain model. */
export interface PaymentProofUpload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Blob;
}

export interface PaymentProofError {
  code: "proof_storage_failed" | "proof_unavailable" | "proof_invalid";
  stage: "write" | "readback" | "metadata_enrichment" | "cleanup";
  message: string;
  paymentId: string;
  retryable: boolean;
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  receivedAt: string; // ISO date
  reference?: string;
  paymentProof?: PaymentProof;
}

export interface RecordPaymentResult {
  payment: Payment;
  proofError?: PaymentProofError;
}
