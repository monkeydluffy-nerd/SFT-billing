import { create } from "zustand";
import type { InvoiceStatus } from "@/types";

export type AppPage =
  | "overview"
  | "invoices"
  | "invoice-detail"
  | "create-invoice"
  | "clients"
  | "client-detail"
  | "payments"
  | "intelligence"
  | "reports"
  | "settings";

/**
 * Cross-cutting UI state that more than one component needs to read or
 * change — this is intentionally NOT where invoice/client/payment data
 * lives (that's src/stores/appStore.ts). This store only holds ephemeral
 * interface state: navigation, in-page filters, and transient panels.
 */
interface WorkspaceState {
  currentPage: AppPage;
  navigateTo: (page: AppPage) => void;

  /** Currently selected invoice ID (for the detail page). */
  selectedInvoiceId: string | null;
  /** Navigate to invoice detail view. */
  navigateToInvoice: (id: string) => void;

  /** Currently selected client ID (for the client detail page). */
  selectedClientId: string | null;
  /** Navigate to client detail view. */
  navigateToClient: (id: string) => void;

  /** Pre-selected client when creating invoice from client detail. */
  createInvoiceForClientId: string | null;
  /** Navigate to create invoice, optionally pre-selecting a client. */
  navigateToCreateInvoice: (clientId?: string) => void;

  /** Invoice being edited (navigated to create-invoice with an existing invoice). */
  editingInvoiceId: string | null;
  /** Navigate to edit an existing invoice. */
  navigateToEditInvoice: (id: string) => void;

  /** Drives the Overview "click a metric, the workspace transforms" interaction. */
  overviewFocus: InvoiceStatus | null;
  focusOverviewStatus: (status: InvoiceStatus | null) => void;

  /** Drives the Invoices page active status filter tab. */
  invoiceStatusFilter: InvoiceStatus | "all";
  setInvoiceStatusFilter: (filter: InvoiceStatus | "all") => void;

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

  selectedInvoiceId: null,
  navigateToInvoice: (id) => set({ currentPage: "invoice-detail", selectedInvoiceId: id }),

  selectedClientId: null,
  navigateToClient: (id) => set({ currentPage: "client-detail", selectedClientId: id }),

  createInvoiceForClientId: null,
  navigateToCreateInvoice: (clientId) =>
    set({ currentPage: "create-invoice", createInvoiceForClientId: clientId ?? null, editingInvoiceId: null }),

  editingInvoiceId: null,
  navigateToEditInvoice: (id) =>
    set({ currentPage: "create-invoice", editingInvoiceId: id, createInvoiceForClientId: null }),

  overviewFocus: null,
  focusOverviewStatus: (status) =>
    set((state) => ({ overviewFocus: state.overviewFocus === status ? null : status })),

  invoiceStatusFilter: "all",
  setInvoiceStatusFilter: (filter) => set({ invoiceStatusFilter: filter }),

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
