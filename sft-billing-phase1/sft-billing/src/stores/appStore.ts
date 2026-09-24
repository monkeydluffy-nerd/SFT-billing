import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Client, Invoice, Payment, ActivityEvent } from "@/types";
import { mockClients } from "@/data/mockClients";
import { mockInvoices } from "@/data/mockInvoices";
import { mockPayments } from "@/data/mockPayments";
import { mockActivity } from "@/data/mockActivity";
import { computeInvoiceTotals, getInvoiceStatus } from "@/lib/invoiceMath";
import { activitySummary } from "@/lib/activityCopy";
import { nextInvoiceNumber, generateId } from "@/lib/numberGen";
import { formatCurrency } from "@/lib/formatters";

// ---------------------------------------------------------------------------
// Payment method display label
// ---------------------------------------------------------------------------
const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  card: "Card",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
  other: "Other",
};

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
interface AppState {
  invoices: Invoice[];
  clients: Client[];
  payments: Payment[];
  activity: ActivityEvent[];

  // ---- Invoice actions ----
  createInvoice: (invoice: Omit<Invoice, "id" | "number">) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  markInvoiceSent: (id: string) => void;
  cancelInvoice: (id: string) => void;
  duplicateInvoice: (id: string) => Invoice | null;

  // ---- Payment actions ----
  recordPayment: (payment: Omit<Payment, "id">) => Payment;

  // ---- Client actions ----
  createClient: (client: Omit<Client, "id">) => Client;
  updateClient: (client: Client) => void;

  // ---- Selectors ----
  getClientById: (id: string) => Client | undefined;
  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoicesForClient: (clientId: string) => Invoice[];
  getPaymentsForInvoice: (invoiceId: string) => Payment[];
  getPaymentsForClient: (clientId: string) => Payment[];
}

// ---------------------------------------------------------------------------
// Helper: append activity event
// ---------------------------------------------------------------------------
function makeEvent(
  activity: ActivityEvent[],
  type: ActivityEvent["type"],
  summary: string,
  extra?: Partial<Pick<ActivityEvent, "clientId" | "invoiceId" | "paymentId" | "amount">>
): ActivityEvent[] {
  const event: ActivityEvent = {
    id: generateId("evt"),
    type,
    occurredAt: new Date().toISOString(),
    summary,
    ...extra,
  };
  return [event, ...activity];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Seed from mock data on first load (localStorage will override if present)
      invoices: mockInvoices,
      clients: mockClients,
      payments: mockPayments,
      activity: mockActivity,

      // ---- Invoice actions ----

      createInvoice: (draft) => {
        const state = get();
        const number = nextInvoiceNumber(state.invoices.map((i) => i.number));
        const invoice: Invoice = {
          ...draft,
          id: generateId("iv"),
          number,
        };
        const client = state.clients.find((c) => c.id === invoice.clientId);
        const summary = activitySummary("invoice_created", {
          invoiceNumber: number,
          clientName: client?.name,
        });
        set((s) => ({
          invoices: [invoice, ...s.invoices],
          activity: makeEvent(s.activity, "invoice_created", summary, {
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            amount: computeInvoiceTotals(invoice).total,
          }),
        }));
        return invoice;
      },

      updateInvoice: (invoice) => {
        const state = get();
        const client = state.clients.find((c) => c.id === invoice.clientId);
        const summary = activitySummary("invoice_updated", {
          invoiceNumber: invoice.number,
          clientName: client?.name,
        });
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === invoice.id ? invoice : i)),
          activity: makeEvent(s.activity, "invoice_updated", summary, {
            invoiceId: invoice.id,
            clientId: invoice.clientId,
          }),
        }));
      },

      markInvoiceSent: (id) => {
        const state = get();
        const invoice = state.invoices.find((i) => i.id === id);
        if (!invoice) return;
        const client = state.clients.find((c) => c.id === invoice.clientId);
        const updated: Invoice = {
          ...invoice,
          isDraft: false,
          sentAt: invoice.sentAt ?? new Date().toISOString(),
        };
        const summary = activitySummary("invoice_sent", {
          invoiceNumber: invoice.number,
          clientName: client?.name,
        });
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === id ? updated : i)),
          activity: makeEvent(s.activity, "invoice_sent", summary, {
            invoiceId: id,
            clientId: invoice.clientId,
          }),
        }));
      },

      cancelInvoice: (id) => {
        const state = get();
        const invoice = state.invoices.find((i) => i.id === id);
        if (!invoice) return;
        const updated: Invoice = {
          ...invoice,
          cancelledAt: new Date().toISOString(),
        };
        const summary = activitySummary("invoice_cancelled", {
          invoiceNumber: invoice.number,
        });
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === id ? updated : i)),
          activity: makeEvent(s.activity, "invoice_cancelled", summary, {
            invoiceId: id,
            clientId: invoice.clientId,
          }),
        }));
      },

      duplicateInvoice: (id) => {
        const state = get();
        const original = state.invoices.find((i) => i.id === id);
        if (!original) return null;
        const number = nextInvoiceNumber(state.invoices.map((i) => i.number));
        const today = new Date().toISOString().split("T")[0];
        const dueOffset =
          (new Date(original.dueDate).getTime() - new Date(original.issueDate).getTime()) /
          (1000 * 60 * 60 * 24);
        const dueDate = new Date(
          Date.now() + dueOffset * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0];
        const duplicate: Invoice = {
          ...original,
          id: generateId("iv"),
          number,
          issueDate: today,
          dueDate,
          isDraft: true,
          sentAt: undefined,
          viewedAt: undefined,
          paidAt: undefined,
          paidAmount: undefined,
          cancelledAt: undefined,
        };
        const client = state.clients.find((c) => c.id === duplicate.clientId);
        const summary = activitySummary("invoice_created", {
          invoiceNumber: number,
          clientName: client?.name,
        });
        set((s) => ({
          invoices: [duplicate, ...s.invoices],
          activity: makeEvent(s.activity, "invoice_created", summary, {
            invoiceId: duplicate.id,
            clientId: duplicate.clientId,
          }),
        }));
        return duplicate;
      },

      // ---- Payment actions ----

      recordPayment: (paymentDraft) => {
        const state = get();
        const payment: Payment = { ...paymentDraft, id: generateId("pm") };

        // Update the linked invoice's paidAmount and paidAt
        const invoice = state.invoices.find((i) => i.id === payment.invoiceId);
        let updatedInvoices = state.invoices;
        if (invoice) {
          const { total } = computeInvoiceTotals(invoice);
          const newPaidAmount = (invoice.paidAmount ?? 0) + payment.amount;
          const isFullyPaid = newPaidAmount >= total;
          const updatedInvoice: Invoice = {
            ...invoice,
            paidAmount: newPaidAmount,
            paidAt: isFullyPaid ? (invoice.paidAt ?? payment.receivedAt) : undefined,
          };
          updatedInvoices = state.invoices.map((i) =>
            i.id === invoice.id ? updatedInvoice : i
          );
        }

        const client = state.clients.find((c) => c.id === payment.clientId);
        const summary = activitySummary("payment_received", {
          amount: formatCurrency(payment.amount),
          clientName: client?.name,
          paymentMethod: METHOD_LABELS[payment.method],
        });

        set((s) => ({
          payments: [payment, ...s.payments],
          invoices: updatedInvoices,
          activity: makeEvent(s.activity, "payment_received", summary, {
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            clientId: payment.clientId,
            amount: payment.amount,
          }),
        }));

        return payment;
      },

      // ---- Client actions ----

      createClient: (draft) => {
        const client: Client = { ...draft, id: generateId("cl") };
        const summary = activitySummary("client_added", { clientName: client.name });
        set((s) => ({
          clients: [client, ...s.clients],
          activity: makeEvent(s.activity, "client_added", summary, {
            clientId: client.id,
          }),
        }));
        return client;
      },

      updateClient: (client) => {
        const summary = activitySummary("client_updated", { clientName: client.name });
        set((s) => ({
          clients: s.clients.map((c) => (c.id === client.id ? client : c)),
          activity: makeEvent(s.activity, "client_updated", summary, {
            clientId: client.id,
          }),
        }));
      },

      // ---- Selectors ----

      getClientById: (id) => get().clients.find((c) => c.id === id),

      getInvoiceById: (id) => get().invoices.find((i) => i.id === id),

      getInvoicesForClient: (clientId) =>
        get().invoices.filter((i) => i.clientId === clientId),

      getPaymentsForInvoice: (invoiceId) =>
        get().payments.filter((p) => p.invoiceId === invoiceId),

      getPaymentsForClient: (clientId) =>
        get().payments.filter((p) => p.clientId === clientId),
    }),
    {
      name: "sft-billing-app-store",
      // Only persist business data, not derived UI state
      partialize: (state) => ({
        invoices: state.invoices,
        clients: state.clients,
        payments: state.payments,
        activity: state.activity,
      }),
    }
  )
);

// Convenience selector hooks
export const useInvoicesStore = () => useAppStore((s) => s.invoices);
export const useClientsStore = () => useAppStore((s) => s.clients);
export const usePaymentsStore = () => useAppStore((s) => s.payments);
export const useActivityStore = () => useAppStore((s) => s.activity);
