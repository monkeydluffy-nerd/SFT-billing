import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ClientsPage } from "./ClientsPage";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import { getClientRollup } from "@/lib/invoiceMath";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice, Payment } from "@/types";

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
    await waitFor(() => expect(screen.getByText(formatCurrency(expectedTotal))).toBeInTheDocument());

    expect(screen.queryByText(/Since \d/)).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
