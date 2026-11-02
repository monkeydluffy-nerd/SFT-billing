import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client, Invoice, Payment } from "@/types";
import { activeDataProvider } from "@/services";
import { InvoicesPage } from "./InvoicesPage";

const mocks = vi.hoisted(() => ({
  useInvoices: vi.fn(),
  useClients: vi.fn(),
  usePayments: vi.fn(),
  useWorkspaceStore: vi.fn(),
}));

vi.mock("@/hooks/useInvoices", () => ({ useInvoices: mocks.useInvoices }));
vi.mock("@/hooks/useClients", () => ({ useClients: mocks.useClients }));
vi.mock("@/hooks/usePayments", () => ({ usePayments: mocks.usePayments }));
vi.mock("@/hooks/useWorkspaceStore", () => ({ useWorkspaceStore: mocks.useWorkspaceStore }));

const invoice: Invoice = {
  id: "invoice-draft-delete",
  number: "050/2026-27",
  clientId: "client-delete",
  issueDate: "2026-10-01",
  dueDate: "2026-11-01",
  items: [{ id: "line-delete", description: "Service", quantity: 1, unitPrice: 100 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: true,
};
const client: Client = {
  id: "client-delete",
  name: "Example Client",
  email: null,
  billingAddress: "Test address",
};
const noPayments: Payment[] = [];

function setupPage(invoices: Invoice[] = [invoice], payments: Payment[] = noPayments) {
  const reloadInvoices = vi.fn();
  const reloadPayments = vi.fn();
  mocks.useInvoices.mockReturnValue({
    data: invoices,
    loading: false,
    error: null,
    reload: reloadInvoices,
  });
  mocks.useClients.mockReturnValue({ data: [client], loading: false, error: null });
  mocks.usePayments.mockReturnValue({
    data: payments,
    loading: false,
    error: null,
    reload: reloadPayments,
  });
  mocks.useWorkspaceStore.mockReturnValue({
    openCreateInvoice: vi.fn(),
    consumePendingInvoiceFilter: vi.fn(() => null),
    navigateToInvoiceDetail: vi.fn(),
  });
  return { reloadInvoices, reloadPayments };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("InvoicesPage invoice deletion", () => {
  it("confirms the invoice number and client, then refreshes invoices and payments", async () => {
    const user = userEvent.setup();
    const { reloadInvoices, reloadPayments } = setupPage();
    const deleteInvoice = vi.spyOn(activeDataProvider, "deleteInvoice").mockResolvedValue();
    render(<InvoicesPage />);

    await user.click(screen.getByRole("button", { name: "Expand invoice 050/2026-27" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete invoice 050/2026-27?" });
    expect(dialog).toHaveTextContent("Example Client");
    expect(dialog).toHaveTextContent("050/2026-27");
    await user.click(within(dialog).getByRole("button", { name: "Delete draft" }));

    expect(deleteInvoice).toHaveBeenCalledWith(invoice.id);
    expect(reloadInvoices).toHaveBeenCalledOnce();
    expect(reloadPayments).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Draft invoice 050/2026-27 deleted");
    // Dialog closes with animation, wait for it to be removed
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"), { timeout: 5000 });
  });

  it("explains that billed and payment-linked invoices cannot be deleted", async () => {
    const user = userEvent.setup();
    const deleteInvoice = vi.spyOn(activeDataProvider, "deleteInvoice");
    setupPage([{ ...invoice, isDraft: false, billedAt: "2026-10-01T10:00:00Z" }]);
    const { rerender } = render(<InvoicesPage />);

    await user.click(screen.getByRole("button", { name: "Expand invoice 050/2026-27" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const billedDialog = screen.getByRole("dialog", { name: "Delete invoice 050/2026-27?" });
    expect(billedDialog).toHaveTextContent("Billed invoices cannot be permanently deleted");
    expect(within(billedDialog).queryByRole("button", { name: "Delete draft" })).not.toBeInTheDocument();
    await user.click(within(billedDialog).getByRole("button", { name: "Close" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    setupPage([invoice], [{
      id: "payment-linked",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: 10,
      method: "cash",
      receivedAt: "2026-10-02",
    }]);
    rerender(<InvoicesPage />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const paymentDialog = screen.getByRole("dialog", { name: "Delete invoice 050/2026-27?" });
    expect(paymentDialog).toHaveTextContent("This invoice has payment history and cannot be deleted");
    expect(within(paymentDialog).queryByRole("button", { name: "Delete draft" })).not.toBeInTheDocument();
    expect(deleteInvoice).not.toHaveBeenCalled();
  });

  it("shows backend errors and prevents repeated confirmation while deletion is pending", async () => {
    const user = userEvent.setup();
    setupPage();
    let rejectDelete!: (reason: Error) => void;
    const deleteInvoice = vi.spyOn(activeDataProvider, "deleteInvoice").mockImplementation(
      () => new Promise<void>((_resolve, reject) => {
        rejectDelete = reject;
      }),
    );
    render(<InvoicesPage />);

    await user.click(screen.getByRole("button", { name: "Expand invoice 050/2026-27" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete invoice 050/2026-27?" });
    const confirm = within(dialog).getByRole("button", { name: "Delete draft" });
    await user.click(confirm);
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
    await user.click(confirm);
    expect(deleteInvoice).toHaveBeenCalledTimes(1);

    rejectDelete(new Error("Invoice has inventory history and cannot be deleted."));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Invoice has inventory history and cannot be deleted.",
    );
  });

  it("keeps bulk selection independent from row expansion", async () => {
    const user = userEvent.setup();
    setupPage();
    render(<InvoicesPage />);

    await user.click(screen.getByRole("checkbox", { name: "Select invoice 050/2026-27" }));
    expect(screen.getByText("1 invoice selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand invoice 050/2026-27" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Expand invoice 050/2026-27" }));
    expect(screen.getByRole("button", { name: "Collapse invoice 050/2026-27" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("1 invoice selected")).toBeInTheDocument();
  });
});
