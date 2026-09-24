import type { DataProvider } from "./dataProvider";
import {
  mockClients,
  mockInvoices,
  mockProducts,
  mockPayments,
  mockActivity,
  mockReports,
  mockCurrentUser,
  mockBusinessProfile,
} from "@/data";
import type {
  ActivityEvent,
  BusinessProfile,
  Client,
  Invoice,
  Payment,
  PaymentProof,
  PaymentProofError,
  PaymentProofUpload,
  RecordPaymentResult,
} from "@/types";
import { isSupportedPaymentProof, PAYMENT_PROOF_INVALID_MESSAGE } from "@/lib/paymentProof";

// In-memory mutable copies so saveInvoice/recordPayment/addActivityEvent/
// createClient have somewhere real to write during development.
function clonePayment(payment: Payment): Payment {
  return {
    ...payment,
    ...(payment.paymentProof ? { paymentProof: { ...payment.paymentProof } } : {}),
  };
}

const clientStore: Client[] = [...mockClients];
const invoiceStore: Invoice[] = [...mockInvoices];
const paymentStore: Payment[] = mockPayments.map(clonePayment);
const activityStore: ActivityEvent[] = [...mockActivity];
let businessProfileStore: BusinessProfile = { ...mockBusinessProfile };

let activityCounter = activityStore.length;
let proofCounter = 0;

/** Small simulated latency — real enough to exercise loading states, never long enough to feel sluggish. */
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function proofValidationError(paymentId: string, message: string): PaymentProofError {
  return {
    code: "proof_invalid",
    stage: "write",
    message,
    paymentId,
    retryable: false,
  };
}

function createMockProof(
  paymentId: string,
  upload: PaymentProofUpload,
): { proof?: PaymentProof; error?: PaymentProofError } {
  if (
    !upload.fileName.trim() ||
    !upload.mimeType.trim() ||
    !Number.isFinite(upload.sizeBytes) ||
    upload.sizeBytes < 0
  ) {
    return {
      error: proofValidationError(paymentId, "Payment proof metadata is invalid."),
    };
  }

  if (!isSupportedPaymentProof(upload.fileName, upload.mimeType)) {
    return {
      error: proofValidationError(paymentId, PAYMENT_PROOF_INVALID_MESSAGE),
    };
  }

  proofCounter += 1;
  return {
    proof: {
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      uploadedAt: new Date().toISOString(),
      attachmentReference: `payment-proofs/${paymentId}/proof-${proofCounter}`,
    },
  };
}

export const mockDataProvider: DataProvider = {
  async getClients() {
    return delay(clientStore);
  },
  async getClient(id) {
    return delay(clientStore.find((c) => c.id === id));
  },
  async createClient(client) {
    clientStore.unshift(client);
    return delay(client);
  },
  async updateClient(clientId, update) {
    const index = clientStore.findIndex((client) => client.id === clientId);
    if (index < 0) throw new Error("Client not found.");
    const updated = { ...clientStore[index], ...update, id: clientStore[index].id, clientSince: clientStore[index].clientSince };
    clientStore[index] = updated;
    return delay(updated);
  },

  async getInvoices() {
    return delay(invoiceStore);
  },
  async getInvoice(id) {
    return delay(invoiceStore.find((i) => i.id === id));
  },
  async saveInvoice(invoice) {
    const index = invoiceStore.findIndex((i) => i.id === invoice.id);
    if (index >= 0) {
      invoiceStore[index] = invoice;
    } else {
      invoiceStore.unshift(invoice);
    }
    return delay(invoice);
  },

  async getProducts() {
    return delay(mockProducts);
  },

  async getPayments() {
    return delay(paymentStore.map(clonePayment));
  },
  async recordPayment(payment, proof): Promise<RecordPaymentResult> {
    const existingIndex = paymentStore.findIndex((storedPayment) => storedPayment.id === payment.id);

    if (existingIndex >= 0) {
      const existingPayment = paymentStore[existingIndex];
      if (existingPayment.invoiceId !== payment.invoiceId) {
        return delay({
          payment: clonePayment(existingPayment),
          proofError: proofValidationError(
            existingPayment.id,
            "Payment proof replacement must use the payment's existing invoice.",
          ),
        });
      }

      // A payment id already in the store identifies a proof replacement, not
      // a second ledger record. Keep the append-only payment fields intact.
      if (!proof) return delay({ payment: clonePayment(existingPayment) });

      const result = createMockProof(existingPayment.id, proof);
      if (result.error || !result.proof) {
        return delay({ payment: clonePayment(existingPayment), proofError: result.error });
      }

      const enrichedPayment = { ...existingPayment, paymentProof: result.proof };
      paymentStore[existingIndex] = enrichedPayment;
      return delay({ payment: clonePayment(enrichedPayment) });
    }

    // Persist the payment row before proof enrichment, mirroring the backend
    // durable-payment-first contract. A failed proof therefore retains the
    // newly recorded payment without proof metadata.
    const persistedPayment: Payment = { ...payment };
    paymentStore.unshift(persistedPayment);

    if (!proof) return delay({ payment: clonePayment(persistedPayment) });

    const result = createMockProof(persistedPayment.id, proof);
    if (result.error || !result.proof) {
      return delay({ payment: clonePayment(persistedPayment), proofError: result.error });
    }

    const enrichedPayment = { ...persistedPayment, paymentProof: result.proof };
    paymentStore[0] = enrichedPayment;
    return delay({ payment: clonePayment(enrichedPayment) });
  },

  async getActivity() {
    return delay(activityStore);
  },
  async addActivityEvent(event) {
    activityCounter += 1;
    const fullEvent: ActivityEvent = { ...event, id: `ev_runtime_${activityCounter}` };
    activityStore.unshift(fullEvent);
    return delay(fullEvent);
  },

  async getReports() {
    return delay(mockReports);
  },

  async getCurrentUser() {
    return delay(mockCurrentUser);
  },
  async getBusinessProfile() {
    return delay(businessProfileStore);
  },
  async updateBusinessProfile(update) {
    businessProfileStore = { ...businessProfileStore, ...update };
    return delay(businessProfileStore);
  },
};
