import type {
  BankDetails,
  BusinessProfile,
  Client,
  Invoice,
  InvoiceGst,
  InvoiceLineItem,
} from "@/types";
import { getInvoiceTotalsWithWords, type InvoiceTotals } from "@/lib/invoiceMath";

/**
 * Display labels shared by every invoice document consumer. Keeping these
 * values in the model prevents a renderer or export adapter from carrying a
 * second set of document labels (or accidentally reintroducing mojibake).
 */
export interface InvoiceDocumentLabels {
  invoiceHeading: string;
  billedTo: string;
  issued: string;
  due: string;
  supplierCode: string;
  poNumber: string;
  poDate: string;
  transporter: string;
  orderDelivery: string;
  description: string;
  hsn: string;
  quantity: string;
  rate: string;
  taxableValue: string;
  discount: string;
  cgst: string;
  sgst: string;
  roundOff: string;
  grandTotal: string;
  amountInWords: string;
  bankDetails: string;
  accountHolderName: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  ifscCode: string;
  notes: string;
  declaration: string;
  declarationCertification: string;
  paymentDetails: string;
  authorizedSignatory: string;
  emptyValue: string;
  minus: string;
  separator: string;
  currencySymbol: string;
  lineItemsEmpty: string;
}

export const INVOICE_DOCUMENT_LABELS: InvoiceDocumentLabels = {
  invoiceHeading: "Tax Invoice",
  billedTo: "Billed to",
  issued: "Issued",
  due: "Due",
  supplierCode: "Supplier code",
  poNumber: "P.O. No.",
  poDate: "P.O. Date",
  transporter: "Transporter",
  orderDelivery: "Order / delivery details",
  description: "Description",
  hsn: "HSN",
  quantity: "Qty",
  rate: "Rate",
  taxableValue: "Taxable value",
  discount: "Discount",
  cgst: "CGST",
  sgst: "SGST",
  roundOff: "Round off",
  grandTotal: "Grand total",
  notes: "Notes",
  declaration: "Declaration",
  paymentDetails: "Payment details",
  authorizedSignatory: "Authorized signatory",
  emptyValue: "—",
  minus: "−",
  separator: "·",
  currencySymbol: "₹",
  lineItemsEmpty: "Add line items to see them here",
  amountInWords: "Amount in words",
  bankDetails: "Bank details",
  accountHolderName: "Account holder name",
  bankName: "Bank name",
  branch: "Branch",
  accountNumber: "Current account number",
  ifscCode: "IFSC code",
  declarationCertification: "Declaration / certification",
};

const DEFAULT_DECLARATION = "We hereby certify that the above particulars are true and correct.";

export interface InvoiceDocumentBusiness {
  name: string;
  logoUrl?: string;
  address: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
}

export interface InvoiceDocumentIdentity {
  heading: string;
  number: string;
  issueDate: string;
  dueDate: string;
}

export interface InvoiceDocumentCustomer {
  name: string;
  email?: string;
  billingAddress?: string;
  gstin?: string;
}

export interface InvoiceDocumentOrderDelivery {
  supplierCode?: string;
  poNumber?: string;
  poDate?: string;
  transporter?: string;
}

export interface InvoiceDocumentLineItem {
  id: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  taxableValue: number;
}

export interface InvoiceDocumentTotals extends InvoiceTotals {
  /** Taxable value is derived from the shared totals result, not recalculated taxes. */
  taxableValue: number;
  amountInWords: string;
}

export interface InvoiceDocumentModel {
  labels: InvoiceDocumentLabels;
  business: InvoiceDocumentBusiness;
  invoice: InvoiceDocumentIdentity;
  customer: InvoiceDocumentCustomer;
  gst: InvoiceGst;
  items: InvoiceDocumentLineItem[];
  /** Omitted when supplier code, P.O. number, P.O. date, and transporter are all empty. */
  orderDelivery?: InvoiceDocumentOrderDelivery;
  totals: InvoiceDocumentTotals;
  notes?: string;
  /** Invoice-specific terms take precedence over the business default declaration. */
  declaration?: string;
  bank?: BankDetails;
  authorizedSignatory?: string;
}

export interface InvoiceDocumentModelInput {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
}

function normalizeRequired(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeBank(bank: BankDetails | undefined): BankDetails | undefined {
  if (!bank) return undefined;

  return {
    accountHolder: bank.accountHolder.trim(),
    bankName: bank.bankName.trim(),
    branch: bank.branch.trim(),
    accountNumber: bank.accountNumber.trim(),
    ifsc: bank.ifsc.trim(),
  };
}

function normalizeLineItem(item: InvoiceLineItem): InvoiceDocumentLineItem | undefined {
  const description = normalizeOptional(item.description);
  if (!description) return undefined;

  return {
    id: item.id,
    description,
    hsnCode: normalizeOptional(item.hsnCode),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxableValue: item.quantity * item.unitPrice,
  };
}

/**
 * Builds the normalized, renderer-ready invoice document model.
 *
 * This adapter deliberately delegates all invoice totals and amount-in-words
 * work to getInvoiceTotalsWithWords. It does not model IGST and does not
 * mutate the invoice, client, or business profile passed by the caller.
 */
export function buildInvoiceDocumentModel({
  invoice,
  client,
  business,
}: InvoiceDocumentModelInput): InvoiceDocumentModel {
  const totalsWithWords = getInvoiceTotalsWithWords(invoice);
  const items = invoice.items.map(normalizeLineItem).filter((item): item is InvoiceDocumentLineItem => Boolean(item));

  const supplierCode = normalizeOptional(invoice.supplierCode);
  const poNumber = normalizeOptional(invoice.poNumber);
  const poDate = normalizeOptional(invoice.poDate);
  const transporter = normalizeOptional(invoice.transporter);
  const hasOrderDelivery = Boolean(supplierCode || poNumber || poDate || transporter);

  const orderDelivery = hasOrderDelivery
    ? { supplierCode, poNumber, poDate, transporter }
    : undefined;

  const totals: InvoiceDocumentTotals = {
    ...totalsWithWords,
    taxableValue: Math.max(0, totalsWithWords.subtotal - totalsWithWords.discount),
  };

  return {
    labels: INVOICE_DOCUMENT_LABELS,
    business: {
      name: normalizeRequired(business?.name, "Your Company"),
      logoUrl: normalizeOptional(business?.logoUrl),
      address: normalizeRequired(business?.address, ""),
      email: normalizeOptional(business?.email),
      phone: normalizeOptional(business?.phone),
      gstin: normalizeOptional(business?.gstin),
      pan: normalizeOptional(business?.pan),
    },
    invoice: {
      heading: INVOICE_DOCUMENT_LABELS.invoiceHeading,
      number: normalizeRequired(invoice.number, INVOICE_DOCUMENT_LABELS.emptyValue),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    },
    customer: {
      name: normalizeRequired(client?.name, "Select a client"),
      email: normalizeOptional(client?.email),
      billingAddress: normalizeOptional(client?.billingAddress),
      gstin: normalizeOptional(client?.gstin),
    },
    gst: {
      cgstRate: invoice.gst.cgstRate,
      sgstRate: invoice.gst.sgstRate,
    },
    items,
    orderDelivery,
    totals,
    notes: normalizeOptional(invoice.notes),
    declaration: normalizeOptional(invoice.terms) ?? normalizeOptional(business?.declaration) ?? DEFAULT_DECLARATION,
    bank: normalizeBank(business?.bank),
    authorizedSignatory: normalizeOptional(business?.authorizedSignatory),
  };
}
