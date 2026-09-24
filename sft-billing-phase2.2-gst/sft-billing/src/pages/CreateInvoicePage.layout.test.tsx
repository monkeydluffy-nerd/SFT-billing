import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateInvoicePage } from "./CreateInvoicePage";
import { activeDataProvider } from "@/services";
import { mockBusinessProfile } from "@/data/mockBusinessProfile";
import { mockClients } from "@/data/mockClients";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import type { Invoice } from "@/types";

const draftInvoice: Invoice = {
  id: "iv_layout",
  number: "INV-LAYOUT",
  clientId: "cl_acme",
  issueDate: "2025-05-01T00:00:00.000Z",
  dueDate: "2025-05-20T00:00:00.000Z",
  items: [{ id: "li_layout", description: "Consulting", quantity: 1, unitPrice: 1000 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: true,
};

describe("CreateInvoicePage layout", () => {
  beforeEach(() => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([draftInvoice]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
    vi.spyOn(activeDataProvider, "getProducts").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue(mockBusinessProfile);
    useWorkspaceStore.setState({
      currentPage: "create-invoice",
      invoiceDraftPrefill: { invoiceId: draftInvoice.id },
      selectedClientId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves page scrolling to the outer main and keeps document controls in normal flow", async () => {
    const { container } = render(
      <main className="flex-1 overflow-y-auto">
        <CreateInvoicePage />
      </main>,
    );

    await screen.findByRole("button", { name: /Round to nearest/ });

    const main = container.querySelector("main");
    const page = main?.querySelector(":scope > div.min-h-full");
    const content = page?.querySelector(":scope > div.grid");
    const footer = page && Array.from(page.children).find((child) => child.classList.contains("border-t"));

    expect(main).toHaveClass("overflow-y-auto");
    expect(page).not.toBeNull();
    expect(page?.querySelectorAll(".overflow-y-auto")).toHaveLength(0);
    expect(content).not.toHaveClass("overflow-y-auto");
    expect(content).not.toHaveClass("flex-1");
    expect(footer).toBeDefined();
    expect(footer).not.toHaveClass("sticky", "fixed");

    expect(screen.getByRole("button", { name: /Round to nearest/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save as draft/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bill invoice/ })).toBeInTheDocument();
    expect(screen.getByText("Grand Total")).toBeInTheDocument();
  });
});
