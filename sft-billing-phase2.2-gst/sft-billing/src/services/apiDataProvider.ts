import type { DataProvider } from "./dataProvider";
import type {
  ActivityEvent,
  BusinessProfile,
  Client,
  Invoice,
  InvoiceLineItem,
  Payment,
  PaymentProof,
  PaymentProofError,
  PaymentProofUpload,
  RecordPaymentResult,
} from "@/types";
import { mockProducts, mockReports, mockCurrentUser } from "@/data";

/**
 * Real HTTP implementation of DataProvider, talking to the local FastAPI
 * + openpyxl backend (see backend/app) instead of an in-memory mock. This
 * is what makes data survive a reload/restart - every write here lands
 * on disk in backend/data/*.xlsx.
 *
 * getProducts/getReports/getCurrentUser are NOT backed by the API yet
 * (the backend has no routes for them) - they intentionally fall back to
 * the existing mock data rather than hitting a nonexistent endpoint, so
 * they're honestly "not wired up yet" rather than silently broken.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const isMultipart = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  if (!isMultipart && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, "Could not reach the local billing service. Make sure it's running.");
  }

  if (!response.ok) {
    let responseBody: unknown;
    let detail = response.statusText;
    try {
      responseBody = await response.json();
      const body = asRecord(responseBody);
      const rawDetail = body?.detail;
      detail = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail ?? responseBody) ?? detail;
    } catch {
      // response wasn't JSON - keep statusText
    }
    throw new ApiError(response.status, detail, responseBody);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Backend <-> frontend shape adapters
// ---------------------------------------------------------------------------

function toFrontendPaymentProof(value: unknown): PaymentProof | undefined {
  const proof = asRecord(value);
  if (!proof) return undefined;

  const fileName = proof.fileName ?? proof.file_name;
  const mimeType = proof.mimeType ?? proof.mime_type;
  const rawSizeBytes = proof.sizeBytes ?? proof.size_bytes;
  const uploadedAt = proof.uploadedAt ?? proof.uploaded_at;
  const attachmentReference = proof.attachmentReference ?? proof.attachment_reference;
  const sizeBytes = typeof rawSizeBytes === "number" ? rawSizeBytes : Number(rawSizeBytes);

  if (
    typeof fileName !== "string" ||
    typeof mimeType !== "string" ||
    !Number.isFinite(sizeBytes) ||
    typeof uploadedAt !== "string" ||
    typeof attachmentReference !== "string" ||
    !fileName ||
    !mimeType ||
    !uploadedAt ||
    !attachmentReference
  ) {
    // A partially populated legacy proof row is not safe to expose as a
    // usable attachment. The payment itself remains available to callers.
    return undefined;
  }

  return {
    fileName,
    mimeType,
    sizeBytes,
    uploadedAt,
    attachmentReference,
  };
}

function toFrontendPayment(apiPayment: unknown): Payment {
  const payment = asRecord(apiPayment);
  if (!payment) {
    throw new ApiError(0, "Billing service returned an invalid payment record.", apiPayment);
  }

  const paymentProof = toFrontendPaymentProof(payment.paymentProof ?? payment.payment_proof ?? payment.proof);
  return {
    id: payment.id as string,
    invoiceId: payment.invoiceId as string,
    clientId: payment.clientId as string,
    amount: payment.amount as number,
    method: payment.method as Payment["method"],
    receivedAt: payment.receivedAt as string,
    reference: payment.reference as string | undefined,
    ...(paymentProof ? { paymentProof } : {}),
  };
}

function toFrontendPaymentProofError(value: unknown): PaymentProofError | undefined {
  const error = asRecord(value);
  if (!error) return undefined;

  const code = error.code;
  const stage = error.stage;
  if (
    code !== "proof_storage_failed" &&
    code !== "proof_unavailable" &&
    code !== "proof_invalid"
  ) {
    return undefined;
  }
  if (stage !== "write" && stage !== "readback" && stage !== "metadata_enrichment" && stage !== "cleanup") {
    return undefined;
  }

  const paymentId = error.paymentId ?? error.payment_id;
  const retryable = error.retryable;
  if (typeof paymentId !== "string" || typeof error.message !== "string" || typeof retryable !== "boolean") {
    return undefined;
  }

  return {
    code,
    stage,
    message: error.message,
    paymentId,
    retryable,
  };
}

function toRecordPaymentEnvelope(value: unknown): Record<string, unknown> | undefined {
  const response = asRecord(value);
  const detail = asRecord(response?.detail);
  if (detail && (detail.payment !== undefined || detail.proofError !== undefined || detail.proof_error !== undefined)) {
    return detail;
  }
  return response;
}

function toRecordPaymentResult(apiResult: unknown): RecordPaymentResult {
  const envelope = toRecordPaymentEnvelope(apiResult);
  const paymentValue = envelope?.payment ?? apiResult;
  const proofError = toFrontendPaymentProofError(envelope?.proofError ?? envelope?.proof_error);
  return {
    payment: toFrontendPayment(paymentValue),
    ...(proofError ? { proofError } : {}),
  };
}

function toApiPaymentPayload(payment: Omit<Payment, "paymentProof">): Record<string, unknown> {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    clientId: payment.clientId,
    amount: payment.amount,
    method: payment.method,
    receivedAt: payment.receivedAt,
    reference: payment.reference,
  };
}

function toPaymentFormData(payload: Record<string, unknown>, proof: PaymentProofUpload): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  }
  formData.append("proof", proof.content, proof.fileName);
  return formData;
}

/** Backend Invoice responses include computed `status`/`totals` that the
 * frontend Invoice type doesn't have (the frontend derives these itself
 * via getInvoiceStatus/computeInvoiceTotals) - strip them so both code
 * paths keep computing status/totals the same way regardless of which
 * DataProvider is active. */
function toFrontendInvoice(apiInvoice: Record<string, unknown>): Invoice {
  const items = (apiInvoice.items as Array<Record<string, unknown>>).map(
    (item): InvoiceLineItem => ({
      id: item.id as string,
      productId: item.productId as string | undefined,
      description: item.description as string,
      hsnCode: item.hsnCode as string | undefined,
      quantity: item.quantity as number,
      unitPrice: item.unitPrice as number,
    }),
  );

  return {
    id: apiInvoice.id as string,
    number: apiInvoice.number as string,
    clientId: apiInvoice.clientId as string,
    issueDate: apiInvoice.issueDate as string,
    dueDate: apiInvoice.dueDate as string,
    items,
    gst: apiInvoice.gst as Invoice["gst"],
    discount: apiInvoice.discount as number,
    roundOff: apiInvoice.roundOff as number,
    notes: apiInvoice.notes as string | undefined,
    terms: apiInvoice.terms as string | undefined,
    supplierCode: apiInvoice.supplierCode as string | undefined,
    poNumber: apiInvoice.poNumber as string | undefined,
    poDate: apiInvoice.poDate as string | undefined,
    transporter: apiInvoice.transporter as string | undefined,
    isDraft: apiInvoice.isDraft as boolean,
    billedAt: apiInvoice.billedAt as string | undefined,
    sentAt: apiInvoice.sentAt as string | undefined,
    viewedAt: apiInvoice.viewedAt as string | undefined,
    paidAt: apiInvoice.paidAt as string | undefined,
  };
}

/** Frontend -> backend: drop client-only fields the backend doesn't accept and let it assign id/number on create. */
function toApiInvoicePayload(invoice: Invoice): Record<string, unknown> {
  return {
    id: invoice.id,
    number: invoice.number,
    clientId: invoice.clientId,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    gst: invoice.gst,
    discount: invoice.discount,
    roundOff: invoice.roundOff,
    notes: invoice.notes,
    terms: invoice.terms,
    supplierCode: invoice.supplierCode,
    poNumber: invoice.poNumber,
    poDate: invoice.poDate,
    transporter: invoice.transporter,
    isDraft: invoice.isDraft,
    billedAt: invoice.billedAt,
    sentAt: invoice.sentAt,
    items: invoice.items,
  };
}

export const apiDataProvider: DataProvider = {
  async getClients() {
    return request<Client[]>("/api/clients");
  },
  async getClient(id) {
    try {
      return await request<Client>(`/api/clients/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },
  async createClient(client) {
    return request<Client>("/api/clients", { method: "POST", body: JSON.stringify(client) });
  },
  async updateClient(clientId, update) {
    return request<Client>(`/api/clients/${clientId}`, { method: "PUT", body: JSON.stringify(update) });
  },

  async getInvoices() {
    const apiInvoices = await request<Record<string, unknown>[]>("/api/invoices");
    return apiInvoices.map(toFrontendInvoice);
  },
  async getInvoice(id) {
    try {
      const apiInvoice = await request<Record<string, unknown>>(`/api/invoices/${id}`);
      return toFrontendInvoice(apiInvoice);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },
  async saveInvoice(invoice) {
    // The backend distinguishes create (POST, no existing id) from update
    // (PUT /:id) - saveInvoice's single-method "create or update" contract
    // is preserved here by checking whether the invoice already exists.
    const existing = await this.getInvoice(invoice.id).catch(() => undefined);
    const payload = toApiInvoicePayload(invoice);
    const apiInvoice = existing
      ? await request<Record<string, unknown>>(`/api/invoices/${invoice.id}`, { method: "PUT", body: JSON.stringify(payload) })
      : await request<Record<string, unknown>>("/api/invoices", { method: "POST", body: JSON.stringify(payload) });
    return toFrontendInvoice(apiInvoice);
  },

  // Not backed by the API yet - the backend has no /api/products route.
  async getProducts() {
    return mockProducts;
  },

  async getPayments() {
    const apiPayments = await request<unknown[]>("/api/payments");
    return apiPayments.map(toFrontendPayment);
  },
  async recordPayment(payment, proof): Promise<RecordPaymentResult> {
    const payload = toApiPaymentPayload(payment);
    const requestInit: RequestInit = proof
      ? { method: "POST", body: toPaymentFormData(payload, proof) }
      : { method: "POST", body: JSON.stringify(payload) };

    try {
      const apiResult = await request<unknown>("/api/payments", requestInit);
      return toRecordPaymentResult(apiResult);
    } catch (error) {
      // Task 3 may return a non-2xx proof-specific envelope after the payment
      // row is durable. Preserve that payment instead of turning a proof
      // failure into a lost/unknown payment at the provider boundary.
      if (error instanceof ApiError) {
        const envelope = toRecordPaymentEnvelope(error.body);
        const retainedPayment = envelope?.payment;
        const proofError = toFrontendPaymentProofError(envelope?.proofError ?? envelope?.proof_error);
        if (retainedPayment !== undefined && proofError) {
          return { payment: toFrontendPayment(retainedPayment), proofError };
        }
      }
      throw error;
    }
  },

  async getActivity() {
    return request<ActivityEvent[]>("/api/activities");
  },
  async addActivityEvent(event) {
    return request<ActivityEvent>("/api/activities", { method: "POST", body: JSON.stringify(event) });
  },

  // Not backed by the API yet - the backend has no /api/reports route.
  async getReports() {
    return mockReports;
  },

  // Not backed by the API yet - there is no auth/user concept in the backend.
  async getCurrentUser() {
    return mockCurrentUser;
  },
  async getBusinessProfile() {
    return request<BusinessProfile>("/api/business-profile");
  },
  async updateBusinessProfile(update) {
    return request<BusinessProfile>("/api/business-profile", { method: "PUT", body: JSON.stringify(update) });
  },
};