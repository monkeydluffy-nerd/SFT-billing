import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "./useWorkspaceStore";

function resetNavigationState() {
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedClientId: null,
    pendingInvoiceFilter: null,
    selectedPaymentId: null,
    paymentReceiptReturnState: null,
  });
}

describe("workspace navigation state", () => {
  beforeEach(resetNavigationState);

  it("opens invoice detail by the exact stable invoice id and dismisses a receipt overlay", () => {
    useWorkspaceStore.getState().navigateToPaymentReceipt("payment-1");

    useWorkspaceStore.getState().navigateToInvoiceDetail("invoice-42");

    const state = useWorkspaceStore.getState();
    expect(state.currentPage).toBe("invoice-detail");
    expect(state.selectedInvoiceId).toBe("invoice-42");
    expect(state.selectedPaymentId).toBeNull();
    expect(state.paymentReceiptReturnState).toBeNull();
  });

  it("captures and restores the originating workspace when a receipt closes", () => {
    useWorkspaceStore.setState({
      currentPage: "invoice-detail",
      selectedInvoiceId: "invoice-origin",
      selectedClientId: null,
      pendingInvoiceFilter: null,
    });

    useWorkspaceStore.getState().navigateToPaymentReceipt("payment-1");
    expect(useWorkspaceStore.getState().paymentReceiptReturnState).toEqual({
      currentPage: "invoice-detail",
      selectedInvoiceId: "invoice-origin",
      selectedClientId: null,
      pendingInvoiceFilter: null,
    });

    // A receipt is an overlay, but restoring the captured state protects the
    // originating page even if another transient state changed underneath it.
    useWorkspaceStore.setState({ currentPage: "payments", selectedInvoiceId: null });
    useWorkspaceStore.getState().closePaymentReceipt();

    const state = useWorkspaceStore.getState();
    expect(state.currentPage).toBe("invoice-detail");
    expect(state.selectedInvoiceId).toBe("invoice-origin");
    expect(state.selectedPaymentId).toBeNull();
    expect(state.paymentReceiptReturnState).toBeNull();
  });

  it("clears a selected invoice when returning to the invoice list", () => {
    useWorkspaceStore.getState().navigateToInvoiceDetail("invoice-42");
    useWorkspaceStore.getState().goToInvoices();

    expect(useWorkspaceStore.getState().currentPage).toBe("invoices");
    expect(useWorkspaceStore.getState().selectedInvoiceId).toBeNull();
  });
});
