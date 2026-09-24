import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { formatDate } from "@/lib/formatters";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";
import { generateInvoiceWorkbook } from "./invoiceExportService";

const invoice: Invoice = {
  id: "invoice-export-1",
  number: "INV-EXPORT-1",
  clientId: "client-export-1",
  issueDate: "2025-01-10T00:00:00.000Z",
  dueDate: "2025-01-25T00:00:00.000Z",
  items: [
    { id: "item-1", description: "Consulting", hsnCode: "9983", quantity: 2, unitPrice: 12850 },
    { id: "item-2", description: "Support", quantity: 1, unitPrice: 500 },
  ],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 100,
  roundOff: 0.25,
  terms: "Payment due within 15 days.",
  notes: "Thank you for your business.",
  supplierCode: "SUP-7",
  poNumber: "PO-42",
  poDate: "2025-01-09T00:00:00.000Z",
  transporter: "Fast Transport",
  isDraft: false,
};

const client: Client = {
  id: "client-export-1",
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

function workbookValues(sheet: ExcelJS.Worksheet): unknown[] {
  const values: unknown[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => values.push(cell.value));
  });
  return values;
}

function textValues(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string");
}

async function readExportedWorkbook(input: { invoice: Invoice; client: Client | undefined; business: BusinessProfile | undefined }) {
  const buffer = await generateInvoiceWorkbook(input);
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet("Invoice");
  if (!sheet) throw new Error("Invoice worksheet was not generated");
  return { values: workbookValues(sheet), text: textValues(workbookValues(sheet)) };
}

describe("invoiceExportService shared document output", () => {
  it("projects the shared model identity, mapped fields, totals, and words into the existing workbook entry point", async () => {
    const model = buildInvoiceDocumentModel({ invoice, client, business });
    const exported = await readExportedWorkbook({ invoice, client, business });

    expect(exported.text).toEqual(expect.arrayContaining([
      model.business.name,
      model.business.address,
      `${model.business.email}  ${model.labels.separator}  ${model.business.phone}`,
      `GSTIN: ${model.business.gstin}   PAN: ${model.business.pan}`,
      model.invoice.heading.toUpperCase(),
      model.invoice.number,
      model.customer.name,
      model.customer.billingAddress!,
      model.labels.orderDelivery.toUpperCase(),
      model.labels.supplierCode,
      model.orderDelivery!.supplierCode!,
      model.labels.poNumber,
      model.orderDelivery!.poNumber!,
      model.labels.poDate,
      formatDate(model.orderDelivery!.poDate!),
      model.labels.transporter,
      model.orderDelivery!.transporter!,
      model.items[0].description,
      model.totals.amountInWords,
      model.notes!,
      model.declaration!,
      model.bank!.accountNumber,
      model.authorizedSignatory!,
    ]));

    expect(exported.values).toEqual(expect.arrayContaining([
      model.items[0].taxableValue,
      model.totals.taxableValue,
      -model.totals.discount,
      model.totals.cgstAmount,
      model.totals.sgstAmount,
      model.totals.roundOff,
      model.totals.total,
    ]));
  });

  it("omits the order block and uses normalized model fallbacks when optional input is empty", async () => {
    const input = {
      invoice: {
        ...invoice,
        supplierCode: "   ",
        poNumber: undefined,
        poDate: undefined,
        transporter: undefined,
        terms: "   ",
        notes: "   ",
      },
      client: undefined,
      business: { ...business, declaration: "Default declaration" },
    };
    const model = buildInvoiceDocumentModel(input);
    const exported = await readExportedWorkbook(input);

    expect(model.orderDelivery).toBeUndefined();
    expect(exported.text).not.toContain(model.labels.orderDelivery.toUpperCase());
    expect(exported.text).not.toContain(model.labels.supplierCode);
    expect(exported.text).toContain(model.customer.name);
    expect(exported.text).toContain(model.declaration!);
    expect(exported.text).not.toContain("Unknown client");
    expect(exported.text).not.toContain("NOTES");
  });
});
