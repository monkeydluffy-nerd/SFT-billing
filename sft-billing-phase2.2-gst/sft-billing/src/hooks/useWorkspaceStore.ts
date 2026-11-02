import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { InvoiceDraftPrefill, InvoiceStatus } from "@/types";

export type AppPage =
  | "overview"
  | "invoices"
  | "create-invoice"
  | "clients"
  | "products"
  | "payments"
  | "reports"
  | "intelligence"
  | "settings"
  | "invoice-detail";

export interface PaymentReceiptReturnState {
  currentPage: AppPage;
  selectedInvoiceId: string | null;
  selectedClientId: string | null;
  pendingInvoiceFilter: InvoiceStatus | null;
}

const fallbackThemeStorage = new Map<string, string>();

const themeStorage = {
  getItem: (name: string) => {
    const storage = getBrowserStorage();
    return storage?.getItem(name) ?? fallbackThemeStorage.get(name) ?? null;
  },
  setItem: (name: string, value: string) => {
    const storage = getBrowserStorage();
    if (storage) {
      storage.setItem(name, value);
      fallbackThemeStorage.delete(name);
    } else {
      fallbackThemeStorage.set(name, value);
    }
  },
  removeItem: (name: string) => {
    fallbackThemeStorage.delete(name);
    const storage = getBrowserStorage();
    if (storage) {
      storage.removeItem(name);
    }
  },
};

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage;
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      return undefined;
    }
    throw error;
  }
}

/**
 * Cross-cutting UI state that more than one component needs to read or
 * change — this is intentionally NOT where invoice/client/payment data
 * lives (that's the data layer, see src/services + src/hooks/useInvoices
 * etc.). It holds interface state such as navigation and transient panels;
 * the selected theme is the only preference persisted across launches.
 */
interface WorkspaceState {
  currentPage: AppPage;
  navigateTo: (page: AppPage) => void;

  /** Drives the Overview "click a metric, the workspace transforms" interaction (blueprint §5.1). */
  overviewFocus: InvoiceStatus | null;
  focusOverviewStatus: (status: InvoiceStatus | null) => void;

  /** Set by AURA / the command palette when they navigate to Invoices with a status already chosen. InvoicesPage consumes this once on mount. */
  pendingInvoiceFilter: InvoiceStatus | null;
  goToInvoices: (status?: InvoiceStatus | null) => void;
  consumePendingInvoiceFilter: () => InvoiceStatus | null;

  /** Which client's detail view to show — ClientsPage vs ClientDetailPage are distinguished by this, both under currentPage === "clients". */
  selectedClientId: string | null;
  navigateToClientDetail: (clientId: string) => void;
  goToClients: () => void;

  /** Which invoice's detail view to show — a dedicated AppPage value so the Invoice_Detail_Page can be reached directly from Overview, Payments, and Clients, not only from Invoices. */
  selectedInvoiceId: string | null;
  navigateToInvoiceDetail: (invoiceId: string) => void;

  /** Which payment's receipt to show and which workspace state to restore when it closes. */
  selectedPaymentId: string | null;
  paymentReceiptReturnState: PaymentReceiptReturnState | null;
  navigateToPaymentReceipt: (paymentId: string) => void;
  closePaymentReceipt: () => void;

  /** Opens Create Invoice, optionally pre-filled (client, line items, etc.) — used by "New Invoice", "Duplicate", and AURA. */
  invoiceDraftPrefill: InvoiceDraftPrefill | null;
  openCreateInvoice: (prefill?: InvoiceDraftPrefill) => void;
  closeCreateInvoice: () => void;

  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  auraOpen: boolean;
  openAura: () => void;
  closeAura: () => void;
  toggleAura: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      currentPage: "overview",
      navigateTo: (page) =>
        set({
          currentPage: page,
          selectedClientId: null,
          selectedInvoiceId: null,
          selectedPaymentId: null,
          paymentReceiptReturnState: null,
          pendingInvoiceFilter: null,
        }),

      overviewFocus: null,
      focusOverviewStatus: (status) =>
        set((state) => ({ overviewFocus: state.overviewFocus === status ? null : status })),

      pendingInvoiceFilter: null,
      goToInvoices: (status = null) =>
        set({
          currentPage: "invoices",
          pendingInvoiceFilter: status,
          selectedInvoiceId: null,
          selectedPaymentId: null,
          paymentReceiptReturnState: null,
        }),
      consumePendingInvoiceFilter: () => {
        const value = get().pendingInvoiceFilter;
        set({ pendingInvoiceFilter: null });
        return value;
      },

      selectedClientId: null,
      navigateToClientDetail: (clientId) =>
        set({ currentPage: "clients", selectedClientId: clientId, selectedInvoiceId: null, selectedPaymentId: null, paymentReceiptReturnState: null }),
      goToClients: () => set({ currentPage: "clients", selectedClientId: null, selectedInvoiceId: null, selectedPaymentId: null, paymentReceiptReturnState: null }),

      selectedInvoiceId: null,
      navigateToInvoiceDetail: (invoiceId) =>
        set({
          currentPage: "invoice-detail",
          selectedInvoiceId: invoiceId,
          selectedPaymentId: null,
          paymentReceiptReturnState: null,
        }),

      selectedPaymentId: null,
      paymentReceiptReturnState: null,
      navigateToPaymentReceipt: (paymentId) =>
        set((state) => ({
          selectedPaymentId: paymentId,
          paymentReceiptReturnState:
            state.paymentReceiptReturnState ?? {
              currentPage: state.currentPage,
              selectedInvoiceId: state.selectedInvoiceId,
              selectedClientId: state.selectedClientId,
              pendingInvoiceFilter: state.pendingInvoiceFilter,
            },
        })),
      closePaymentReceipt: () =>
        set((state) => {
          const returnState = state.paymentReceiptReturnState;
          if (!returnState) return { selectedPaymentId: null };

          return {
            selectedPaymentId: null,
            paymentReceiptReturnState: null,
            currentPage: returnState.currentPage,
            selectedInvoiceId: returnState.selectedInvoiceId,
            selectedClientId: returnState.selectedClientId,
            pendingInvoiceFilter: returnState.pendingInvoiceFilter,
          };
        }),

      invoiceDraftPrefill: null,
      openCreateInvoice: (prefill) => set({ currentPage: "create-invoice", invoiceDraftPrefill: prefill ?? {} }),
      closeCreateInvoice: () => set({ currentPage: "invoices", invoiceDraftPrefill: null }),

      commandPaletteOpen: false,
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),

      auraOpen: false,
      openAura: () => set({ auraOpen: true }),
      closeAura: () => set({ auraOpen: false }),
      toggleAura: () => set({ auraOpen: !get().auraOpen }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      theme: "light",
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
    }),
    {
      name: "sft-billing-theme",
      partialize: (state) => ({ theme: state.theme }),
      storage: createJSONStorage(() => themeStorage),
    },
  ),
);
