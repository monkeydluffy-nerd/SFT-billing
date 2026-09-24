import { describe, expect, it } from "vitest";
import { amountInWords } from "@/lib/amountInWords";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { buildInvoiceDocumentModel } from "./invoiceDocumentModel";

const invoice: Invoice = {
  id: "invoice-1",
  number: "INV-1001",
  clientId: "client-1",
  issueDate: "2025-01-10",
  dueDate: "2025-01-25",
  items: [
    { id: "item-1", description: "Consulting", hsnCode: "9983", quantity: 2, unitPrice: 12850 },
    { id: "item-empty", description: "  ", quantity: 1, unitPrice: 0 }
  ],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 1,
  terms: "Invoice-specific terms",
  supplierCode: "SUP-7",
  poNumber: "PO-42",
  poDate: "2025-01-09",
  transporter: "Fast Transport",
  isDraft: false,
};

const client: Client = {
  id: "client-1",
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

describe("buildInvoiceDocumentModel", () => {
  it("projects canonical identity, supported tax values, and final amount-in-words", () => {
    const model = buildInvoiceDocumentModel({ invoice, client, business });

    expect(model.business).toMatchObject({
      name: business.name,
      logoUrl: business.logoUrl,
      address: business.address,
      email: business.email,
      gstin: business.gstin,
      pan: business.pan,
    });
    expect(model.invoice).toEqual({
      heading: "Tax Invoice",
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    });
    expect(model.customer).toEqual({
      name: client.name,
      email: client.email,
      billingAddress: client.billingAddress,
      gstin: client.gstin,
    });
    expect(model.gst).toEqual(invoice.gst);
    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({ description: "Consulting", taxableValue: 25700 });
    expect(model.totals.cgstAmount).toBe(2313);
    expect(model.totals.sgstAmount).toBe(2313);
    expect(model.totals.roundOff).toBe(invoice.roundOff);
    expect(model.totals.total).toBe(30327);
    expect(model.totals.amountInWords).toBe(amountInWords(model.totals.total));
    expect(model.declaration).toBe(invoice.terms);
    expect(model.bank).toEqual(business.bank);
    expect(model.authorizedSignatory).toBe(business.authorizedSignatory);
    expect("igst" in model).toBe(false);
  });

  it("omits the complete order/delivery section when all optional values are empty", () => {
    const emptyOrderInvoice: Invoice = {
      ...invoice,
      supplierCode: "  ",
      poNumber: "",
      poDate: undefined,
      transporter: "   ",
    };

    const model = buildInvoiceDocumentModel({ invoice: emptyOrderInvoice, client, business });

    expect(model.orderDelivery).toBeUndefined();
  });

  it("keeps each order/delivery value under its matching normalized field", () => {
    const model = buildInvoiceDocumentModel({ invoice, client, business });

    expect(model.orderDelivery).toEqual({
      supplierCode: invoice.supplierCode,
      poNumber: invoice.poNumber,
      poDate: invoice.poDate,
      transporter: invoice.transporter,
    });
    expect(model.labels).toMatchObject({
      supplierCode: "Supplier code",
      poNumber: "P.O. No.",
      poDate: "P.O. Date",
      transporter: "Transporter",
      separator: "·",
      minus: "−",
      emptyValue: "—",
      currencySymbol: "₹",
    });
    expect(Object.values(model.labels).some((label) => /[\u00c2\u00c3\u00e2]/u.test(label))).toBe(false);
  });

  it("uses the business declaration only when an invoice has no specific terms", () => {
    const model = buildInvoiceDocumentModel({ invoice: { ...invoice, terms: "   " }, client, business });

    expect(model.declaration).toBe(business.declaration);
  });
});
