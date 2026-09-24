import { create } from "zustand";
import type { InvoiceDraftPrefill, InvoiceStatus } from "@/types";

export type AppPage =
  | "overview"
  | "invoices"
  | "create-invoice"
  | "clients"
  | "payments"
  | "intelligence"
  | "reports"
  | "settings";

/**
 * Cross-cutting UI state that more than one component needs to read or
 * change — this is intentionally NOT where invoice/client/payment data
 * lives (that's the data layer, see src/services + src/hooks/useInvoices
 * etc.). This store only ever holds ephemeral interface state:
 * navigation, the active in-page filter, and whether transient panels
 * (command palette, AURA) are open.
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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentPage: "overview",
  navigateTo: (page) => set({ currentPage: page }),

  overviewFocus: null,
  focusOverviewStatus: (status) =>
    set((state) => ({ overviewFocus: state.overviewFocus === status ? null : status })),

  pendingInvoiceFilter: null,
  goToInvoices: (status = null) => set({ currentPage: "invoices", pendingInvoiceFilter: status }),
  consumePendingInvoiceFilter: () => {
    const value = get().pendingInvoiceFilter;
    set({ pendingInvoiceFilter: null });
    return value;
  },

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
}));
