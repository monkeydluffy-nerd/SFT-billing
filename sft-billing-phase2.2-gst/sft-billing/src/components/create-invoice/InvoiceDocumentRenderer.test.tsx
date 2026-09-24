import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { InvoiceDocumentRenderer } from "./InvoiceDocumentRenderer";
import { buildInvoiceDocumentModel } from "./invoiceDocumentModel";

const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const invoice: Invoice = {
  id: "invoice-renderer-1",
  number: "INV-2001",
  clientId: "client-renderer-1",
  issueDate: "2025-01-10",
  dueDate: "2025-01-25",
  items: [{ id: "item-1", description: "Consulting", hsnCode: "9983", quantity: 2, unitPrice: 12850 }],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  terms: "Payment due within 15 days.",
  supplierCode: "SUP-7",
  poNumber: "PO-42",
  poDate: "2025-01-09",
  transporter: "Fast Transport",
  isDraft: false,
};

const client: Client = {
  id: "client-renderer-1",
  name: "Acme Corporation",
  contactName: "Priya Nair",
  email: "billing@example.com",
  billingAddress: "1 Main Street",
  gstin: "33AAAAA0000A1Z5",
  clientSince: "2024-01-01",
};

const business: BusinessProfile = {
  name: "SFT Billing Services",
  logoUrl: "https://example.com/logo.png",
  address: "14 Cathedral Road",
  email: "hello@example.com",
  phone: "+91 44 4567 8900",
  gstin: "33AACFS1234P1Z5",
  pan: "AACFS1234P",
  bank: {
    accountHolder: "SFT Billing Services",
    bankName: "HDFC Bank",
    branch: "Cathedral Road",
    accountNumber: "50200012345678",
    ifsc: "HDFC0000123",
  },
  declaration: "Business default declaration",
  authorizedSignatory: "Authorized Person",
};

describe("InvoiceDocumentRenderer", () => {
  it("renders the approved invoice design with all sections", () => {
    const model = buildInvoiceDocumentModel({ invoice, client, business });

    render(<InvoiceDocumentRenderer model={model} />);

    // Header / strip / ribbon
    expect(screen.getByText(/hello@example\.com/)).toBeInTheDocument();
    expect(screen.getByText("TAX INVOICE")).toBeInTheDocument();

    // Bill To
    expect(screen.getByText("BILL TO")).toBeInTheDocument();
    expect(screen.getByText("Acme Corporation")).toBeInTheDocument();

    // Invoice details
    expect(screen.getByText("INVOICE DETAILS")).toBeInTheDocument();
    expect(screen.getByText("Invoice No.")).toBeInTheDocument();
    expect(screen.getByText("INV-2001")).toBeInTheDocument();
    expect(screen.getByText("Supplier Code")).toBeInTheDocument();
    expect(screen.getByText("SUP-7")).toBeInTheDocument();
    expect(screen.getByText("P.O. No.")).toBeInTheDocument();
    expect(screen.getByText("PO-42")).toBeInTheDocument();
    expect(screen.getByText("Transporter")).toBeInTheDocument();

    // Items table
    expect(screen.getByText("S.No.")).toBeInTheDocument();
    expect(screen.getByText("Description of Goods")).toBeInTheDocument();
    expect(screen.getByText("HSN/SAC")).toBeInTheDocument();
    expect(screen.getByText("Qty")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Consulting")).toBeInTheDocument();
    expect(screen.getByText("9983")).toBeInTheDocument();

    // Totals
    expect(screen.getByText("Taxable Amount")).toBeInTheDocument();
    expect(screen.getByText("CGST @ 9%")).toBeInTheDocument();
    expect(screen.getByText("SGST @ 9%")).toBeInTheDocument();
    const grandTotalLabel = screen.getByText("Grand Total");
    expect(grandTotalLabel.parentElement?.textContent).toContain(`\u20B9 ${formatAmount(model.totals.total)}`);

    // Amount in words
    expect(screen.getByText("Amount in Words")).toBeInTheDocument();
    expect(screen.getByText(model.totals.amountInWords)).toBeInTheDocument();

    // Bank details
    expect(screen.getByText("Bank Details")).toBeInTheDocument();
    expect(screen.getByText("Account Name")).toBeInTheDocument();

    // Declaration + signature
    expect(screen.getByText("Declaration")).toBeInTheDocument();
    expect(screen.getByText(model.authorizedSignatory ?? model.labels.authorizedSignatory)).toBeInTheDocument();

    // Footer
    expect(screen.getByText("Forging a stronger tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Thank you for your business")).toBeInTheDocument();
  });

  it("renders the empty line-item state from the shared model", () => {
    const emptyModel = buildInvoiceDocumentModel({
      invoice: { ...invoice, items: [] },
      client,
      business,
    });

    render(<InvoiceDocumentRenderer model={emptyModel} />);

    expect(screen.getByText(emptyModel.labels.lineItemsEmpty)).toBeInTheDocument();
    expect(screen.queryByText(emptyModel.totals.amountInWords)).not.toBeInTheDocument();
  });

  it("omits the order and delivery rows when all optional values are empty", () => {
    const model = buildInvoiceDocumentModel({
      invoice: {
        ...invoice,
        supplierCode: undefined,
        poNumber: undefined,
        poDate: undefined,
        transporter: undefined,
      },
      client,
      business,
    });

    render(<InvoiceDocumentRenderer model={model} />);

    expect(screen.queryByText("Supplier Code")).not.toBeInTheDocument();
    expect(screen.queryByText("P.O. No.")).not.toBeInTheDocument();
  });
});
