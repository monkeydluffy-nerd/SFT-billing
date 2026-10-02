import type { DataProvider } from "./dataProvider";
import type {
  ActivityEvent,
  BusinessProfile,
  Client,
  Invoice,
  Payment,
  PaymentProofUpload,
  RecordPaymentResult,
} from "@/types";
import { mockProducts, mockReports, mockCurrentUser } from "@/data";

const STORAGE_KEY = "sft-billing-offline-v1";

interface OfflineStore {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  activity: ActivityEvent[];
  business: BusinessProfile;
}

const defaultBusiness = {
  name: "SFT Billing",
  address: "",
  email: "",
  phone: "",
  gstin: "",
  pan: "",
} as BusinessProfile;

function emptyStore(): OfflineStore {
  return {
    clients: [],
    invoices: [],
    payments: [],
    activity: [],
    business: defaultBusiness,
  };
}

function readStore(): OfflineStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<OfflineStore>;
    return {
      clients: parsed.clients ?? [],
      invoices: parsed.invoices ?? [],
      payments: parsed.payments ?? [],
      activity: parsed.activity ?? [],
      business: { ...defaultBusiness, ...(parsed.business ?? {}) },
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: OfflineStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the proof file on this PC."));
    reader.readAsDataURL(file);
  });
}

export const offlineDataProvider: DataProvider = {
  async getClients() {
    return readStore().clients;
  },
  async getClient(id) {
    return readStore().clients.find((client) => client.id === id);
  },
  async createClient(client) {
    const store = readStore();
    store.clients = [client, ...store.clients.filter((item) => item.id !== client.id)];
    writeStore(store);
    return client;
  },
  async updateClient(clientId, update) {
    const store = readStore();
    const current = store.clients.find((client) => client.id === clientId);
    if (!current) throw new Error("Client not found on this PC.");
    const next = { ...current, ...update, id: current.id, clientSince: current.clientSince };
    store.clients = store.clients.map((client) => (client.id === clientId ? next : client));
    writeStore(store);
    return next;
  },
  async getInvoices() {
    return readStore().invoices;
  },
  async getInvoice(id) {
    return readStore().invoices.find((invoice) => invoice.id === id);
  },
  async saveInvoice(invoice) {
    const store = readStore();
    const exists = store.invoices.some((item) => item.id === invoice.id);
    store.invoices = exists
      ? store.invoices.map((item) => (item.id === invoice.id ? invoice : item))
      : [invoice, ...store.invoices];
    writeStore(store);
    return invoice;
  },
  async getProducts() {
    return mockProducts;
  },
  async getPayments() {
    return readStore().payments;
  },
  async recordPayment(payment, proof): Promise<RecordPaymentResult> {
    const store = readStore();
    const existing = store.payments.find((item) => item.id === payment.id);
    let next: Payment = { ...payment, ...(existing?.paymentProof ? { paymentProof: existing.paymentProof } : {}) };
    if (proof) {
      const attachmentReference = await readFileAsDataUrl(proof.content);
      next = {
        ...next,
        paymentProof: {
          fileName: proof.fileName,
          mimeType: proof.content.type || "application/octet-stream",
          sizeBytes: proof.content.size,
          uploadedAt: new Date().toISOString(),
          attachmentReference,
        },
      };
    }
    store.payments = existing
      ? store.payments.map((item) => (item.id === payment.id ? next : item))
      : [next, ...store.payments];
    if (!existing) {
      store.activity = [
        {
          id: `act-${payment.id}`,
          type: "payment_recorded",
          title: "Payment recorded",
          description: `Payment saved on this PC for invoice ${payment.invoiceId}.`,
          occurredAt: payment.receivedAt,
          invoiceId: payment.invoiceId,
          clientId: payment.clientId,
        } as ActivityEvent,
        ...store.activity,
      ];
    }
    writeStore(store);
    return { payment: next };
  },
  async getActivity() {
    return readStore().activity;
  },
  async addActivityEvent(event) {
    const store = readStore();
    const saved = { ...event, id: `act-${Date.now()}` } as ActivityEvent;
    store.activity = [saved, ...store.activity];
    writeStore(store);
    return saved;
  },
  async getReports() {
    return mockReports;
  },
  async getCurrentUser() {
    return mockCurrentUser;
  },
  async getBusinessProfile() {
    return readStore().business;
  },
  async updateBusinessProfile(update) {
    const store = readStore();
    store.business = { ...store.business, ...update };
    writeStore(store);
    return store.business;
  },
};
