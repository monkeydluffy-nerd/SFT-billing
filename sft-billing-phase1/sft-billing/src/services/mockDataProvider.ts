import type { DataProvider } from "./dataProvider";
import {
  mockClients,
  mockInvoices,
  mockPayments,
  mockActivity,
  mockReports,
  mockCurrentUser,
} from "@/data";
import type { Invoice, Payment } from "@/types";

// In-memory mutable copies so saveInvoice/recordPayment (wired up fully in
// Phase 2/3) have somewhere real to write during development.
const invoiceStore: Invoice[] = [...mockInvoices];
const paymentStore: Payment[] = [...mockPayments];

/** Small simulated latency — real enough to exercise loading states, never long enough to feel sluggish. */
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockDataProvider: DataProvider = {
  async getClients() {
    return delay(mockClients);
  },
  async getClient(id) {
    return delay(mockClients.find((c) => c.id === id));
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

  async getPayments() {
    return delay(paymentStore);
  },
  async recordPayment(payment) {
    paymentStore.unshift(payment);
    return delay(payment);
  },

  async getActivity() {
    return delay(mockActivity);
  },

  async getReports() {
    return delay(mockReports);
  },

  async getCurrentUser() {
    return delay(mockCurrentUser);
  },
};
