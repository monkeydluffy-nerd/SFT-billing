import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { activeDataProvider } from "@/services";
import { mockClients, mockInvoices } from "@/data";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

function resetNavigationState() {
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedClientId: null,
    pendingInvoiceFilter: null,
    selectedPaymentId: null,
    paymentReceiptReturnState: null,
    commandPaletteOpen: false,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetNavigationState();
});

describe("CommandPalette invoice navigation", () => {
  it("opens the exact stable id for a matching invoice result", async () => {
    const invoice = mockInvoices[0];
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    useWorkspaceStore.setState({ commandPaletteOpen: true });

    render(<CommandPalette />);

    const input = await screen.findByRole("textbox", { name: "Command palette search" });
    fireEvent.change(input, { target: { value: invoice.number } });

    const invoiceResult = await screen.findByRole("button", { name: new RegExp(invoice.number) });
    fireEvent.click(invoiceResult);

    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
    expect(useWorkspaceStore.getState().selectedInvoiceId).toBe(invoice.id);
  });
});
