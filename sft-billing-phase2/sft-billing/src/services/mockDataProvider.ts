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
import type { ActivityEvent, Client, Invoice, Payment } from "@/types";

// In-memory mutable copies so saveInvoice/recordPayment/addActivityEvent/
// createClient have somewhere real to write during development.
const clientStore: Client[] = [...mockClients];
const invoiceStore: Invoice[] = [...mockInvoices];
const paymentStore: Payment[] = [...mockPayments];
const activityStore: ActivityEvent[] = [...mockActivity];

let activityCounter = activityStore.length;

/** Small simulated latency — real enough to exercise loading states, never long enough to feel sluggish. */
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
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
    return delay(paymentStore);
  },
  async recordPayment(payment) {
    paymentStore.unshift(payment);
    return delay(payment);
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
    return delay(mockBusinessProfile);
  },
};
