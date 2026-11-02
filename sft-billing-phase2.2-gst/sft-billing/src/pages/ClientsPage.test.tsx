import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ClientsPage } from "./ClientsPage";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import { getClientRollup } from "@/lib/invoiceMath";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice, Payment } from "@/types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Unit: Clients_Page column swap", () => {
  it("renders a 'Total Billed' rollup-derived value and no 'Since <date>' text", async () => {
    const client = mockClients[0];
    const invoice: Invoice = {
      id: "iv_1",
      number: "INV-1",
      clientId: client.id,
      issueDate: "2025-05-01T00:00:00.000Z",
      dueDate: "2025-05-20T00:00:00.000Z",
      items: [{ id: "li_1", description: "x", quantity: 1, unitPrice: 10000 }],
      gst: { cgstRate: 0.09, sgstRate: 0.09 },
      discount: 0,
      roundOff: 0,
      isDraft: false,
      billedAt: "2025-05-01T00:00:00.000Z",
    };
    const payments: Payment[] = [];

    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([invoice]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(payments);

    render(<ClientsPage />);

    const expectedTotal = getClientRollup(client.id, [invoice], payments).totalBilled;
    await waitFor(() =>
      expect(screen.getAllByText(formatCurrency(expectedTotal)).length).toBeGreaterThan(0),
    );

    expect(screen.queryByText(/Since \d/)).not.toBeInTheDocument();
  });
});

describe("Clients page actions and summary", () => {
  const client = mockClients[0];

  function mockPageData(
    clients = [client],
    invoices: Invoice[] = [],
    payments: Payment[] = [],
  ) {
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(clients);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue(invoices);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(payments);
  }

  it("keeps the summary metrics, client search, and row actions available", async () => {
    const secondClient = { ...client, id: "client-second", name: "Another Client" };
    mockPageData([client, secondClient]);

    render(<ClientsPage />);

    expect(await screen.findByText("Total clients")).toBeInTheDocument();
    expect(screen.getByText("Total billed")).toBeInTheDocument();
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add client" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Actions for ${client.name}` }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Search clients" }), {
      target: { value: "Another" },
    });
    expect(screen.getByText("Another Client")).toBeInTheDocument();
    expect(screen.queryByText(client.name)).not.toBeInTheDocument();
  });

  it("explains why a client with invoices cannot be deleted", async () => {
    const invoice: Invoice = {
      id: "protected-invoice",
      number: "001/2026-27",
      clientId: client.id,
      issueDate: "2026-01-01",
      dueDate: "2026-01-15",
      items: [{ id: "protected-item", description: "Item", quantity: 1, unitPrice: 100 }],
      gst: { cgstRate: 0.09, sgstRate: 0.09 },
      discount: 0,
      roundOff: 0,
      isDraft: false,
    };
    mockPageData([client], [invoice]);
    const deleteClient = vi.spyOn(activeDataProvider, "deleteClient");

    render(<ClientsPage />);

    fireEvent.click(await screen.findByRole("button", { name: `Actions for ${client.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete client" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "1 invoice(s). Billing records are protected, so this client cannot be deleted.",
    );
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(deleteClient).not.toHaveBeenCalled();
  });

  it("deletes an unlinked client, refreshes the list, and confirms success", async () => {
    const getClients = vi.spyOn(activeDataProvider, "getClients")
      .mockResolvedValueOnce([client])
      .mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    const deleteClient = vi.spyOn(activeDataProvider, "deleteClient").mockResolvedValue();

    render(<ClientsPage />);

    fireEvent.click(await screen.findByRole("button", { name: `Actions for ${client.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete client" })).getByRole("button", {
        name: /^Delete$/,
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Client deleted");
    await waitFor(() => expect(getClients).toHaveBeenCalledTimes(2));
    expect(deleteClient).toHaveBeenCalledWith(client.id);
  });

  it("shows deletion API failures without closing the confirmation dialog", async () => {
    mockPageData();
    vi.spyOn(activeDataProvider, "deleteClient").mockRejectedValue(
      new Error("This client has linked invoices or payments and cannot be deleted."),
    );

    render(<ClientsPage />);

    fireEvent.click(await screen.findByRole("button", { name: `Actions for ${client.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete client" })).getByRole("button", {
        name: /^Delete$/,
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Delete client" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This client has linked invoices or payments and cannot be deleted.",
    );
    expect(dialog).toBeInTheDocument();
  });
});
