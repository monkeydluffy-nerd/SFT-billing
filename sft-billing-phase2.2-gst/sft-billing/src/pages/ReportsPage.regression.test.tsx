import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReportsPage } from "./ReportsPage";
import { activeDataProvider } from "@/services";
import type { Client, Invoice, Payment } from "@/types";

const reportClient: Client = {
  id: "client-reports-regression-a",
  name: "Reports Regression A",
  contactName: "Accounts A",
  email: "accounts-a@example.com",
  billingAddress: "1 Reports Street",
};

const secondReportClient: Client = {
  id: "client-reports-regression-b",
  name: "Reports Regression B",
  contactName: "Accounts B",
  email: "accounts-b@example.com",
  billingAddress: "2 Reports Street",
};

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-reports-regression-default",
    number: "INV-REPORTS-REGRESSION",
    clientId: reportClient.id,
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    items: [{ id: "line-reports-regression", description: "Consulting", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0, sgstRate: 0 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockReportData(invoices: Invoice[], clients: Client[], payments: Payment[] = []) {
  const getInvoices = vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue(invoices);
  const getClients = vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(clients);
  const getPayments = vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue(payments);
  return { getInvoices, getClients, getPayments };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Reports targeted terminology and filter regressions", () => {
  it("uses Outstanding and Received for targeted wording while preserving the untargeted Paid label", async () => {
    const outstandingInvoice = makeInvoice({
      id: "invoice-reports-outstanding",
      number: "INV-REPORTS-OUTSTANDING",
    });
    const paidInvoice = makeInvoice({
      id: "invoice-reports-paid",
      number: "INV-REPORTS-PAID",
      paidAt: new Date().toISOString(),
    });
    mockReportData([outstandingInvoice, paidInvoice], [reportClient]);

    render(<ReportsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Invoices" }));

    const outstandingLink = await screen.findByRole("button", { name: "Open invoice INV-REPORTS-OUTSTANDING" });
    const outstandingRow = outstandingLink.closest("tr");
    expect(outstandingRow).not.toBeNull();
    expect(within(outstandingRow as HTMLElement).getByText("Outstanding")).toBeInTheDocument();

    const paidLink = screen.getByRole("button", { name: "Open invoice INV-REPORTS-PAID" });
    const paidRow = paidLink.closest("tr");
    expect(paidRow).not.toBeNull();
    expect(within(paidRow as HTMLElement).getByText("Paid")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Revenue" }));
    expect((await screen.findAllByText("Received")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Collected")).not.toBeInTheDocument();
  });

  it("keeps Reports provider data and applies the existing client and status filters", async () => {
    const clientAPending = makeInvoice({
      id: "invoice-reports-filter-a",
      number: "INV-REPORTS-FILTER-A",
      clientId: reportClient.id,
    });
    const clientBPending = makeInvoice({
      id: "invoice-reports-filter-b-pending",
      number: "INV-REPORTS-FILTER-B-PENDING",
      clientId: secondReportClient.id,
    });
    const clientBPaid = makeInvoice({
      id: "invoice-reports-filter-b-paid",
      number: "INV-REPORTS-FILTER-B-PAID",
      clientId: secondReportClient.id,
      paidAt: new Date().toISOString(),
    });
    const spies = mockReportData([clientAPending, clientBPending, clientBPaid], [reportClient, secondReportClient]);

    render(<ReportsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Invoices" }));

    expect(await screen.findByRole("button", { name: "Open invoice INV-REPORTS-FILTER-A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open invoice INV-REPORTS-FILTER-B-PENDING" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open invoice INV-REPORTS-FILTER-B-PAID" })).toBeInTheDocument();
    expect(spies.getInvoices).toHaveBeenCalled();
    expect(spies.getClients).toHaveBeenCalled();
    expect(spies.getPayments).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Filter by client" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Filter by client" })).getByRole("option", { name: secondReportClient.name }));
    expect(screen.queryByRole("button", { name: "Open invoice INV-REPORTS-FILTER-A" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open invoice INV-REPORTS-FILTER-B-PENDING" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open invoice INV-REPORTS-FILTER-B-PAID" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filter by status" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Filter by status" })).getByRole("option", { name: "Outstanding" }));
    expect(screen.getByRole("button", { name: "Open invoice INV-REPORTS-FILTER-B-PENDING" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open invoice INV-REPORTS-FILTER-B-PAID" })).not.toBeInTheDocument();
  });
});
