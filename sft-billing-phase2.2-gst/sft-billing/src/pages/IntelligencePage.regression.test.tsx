import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { IntelligencePage } from "./IntelligencePage";
import { activeDataProvider } from "@/services";
import { getComparablePeriodWindow } from "@/lib/periodComparison";
import type { Client, Invoice } from "@/types";

const intelligenceClient: Client = {
  id: "client-intelligence-regression",
  name: "Intelligence Regression Client",
  contactName: "Finance",
  email: "finance@example.com",
  billingAddress: "3 Intelligence Street",
  clientSince: "2026-01-01",
};

function makePaidInvoice(id: string, number: string, date: Date, amount: number): Invoice {
  return {
    id,
    number,
    clientId: intelligenceClient.id,
    issueDate: date.toISOString(),
    dueDate: new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()).toISOString(),
    items: [{ id: `${id}-line`, description: "Consulting", quantity: 1, unitPrice: amount }],
    gst: { cgstRate: 0, sgstRate: 0 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: date.toISOString(),
    paidAt: date.toISOString(),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Intelligence comparison and data-source regressions", () => {
  it("labels current and prior periods correctly and calculates the delta from current relative to prior", async () => {
    const asOf = new Date();
    const periods = getComparablePeriodWindow(asOf);
    const currentInvoice = makePaidInvoice(
      "invoice-intelligence-current",
      "INV-INTELLIGENCE-CURRENT",
      periods.currentStart,
      200,
    );
    const priorInvoice = makePaidInvoice(
      "invoice-intelligence-prior",
      "INV-INTELLIGENCE-PRIOR",
      periods.comparableStart,
      100,
    );
    const getInvoices = vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([currentInvoice, priorInvoice]);
    const getClients = vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([intelligenceClient]);
    const getPayments = vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);

    render(<IntelligencePage />);

    expect(await screen.findByText("Business pulse")).toBeInTheDocument();
    expect(getInvoices).toHaveBeenCalled();
    expect(getClients).toHaveBeenCalled();
    expect(getPayments).toHaveBeenCalled();

    const billedLabel = screen.getByText("Billed");
    const billedStat = billedLabel.parentElement;
    expect(billedStat).not.toBeNull();
    expect(billedStat as HTMLElement).toHaveTextContent(periods.currentLabel);
    expect(billedStat as HTMLElement).toHaveTextContent(`+100.0% vs ${periods.comparableLabel}`);

    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.queryByText("Collected")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });
});
