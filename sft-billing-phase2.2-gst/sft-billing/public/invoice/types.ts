/** Domain types for the tax invoice. Shared by the UI, the FastAPI
 *  contract (mirror this shape in a Pydantic model) and the ExcelJS
 *  export, so all three stay in sync. */

export interface Seller {
  name: string;
  nameSuffix: string;
  legalName: string;
  tagline: string;
  address: string[];
  phone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
  /** URL or data: URI. Omit to fall back to the text lockup. */
  logo?: string;
}

export interface Buyer {
  name: string;
  address: string[];
  gstin: string;
  state: string;
}

export interface MetaRow {
  label: string;
  value: string;
}

export interface TaxRates {
  cgstRate: number;
  sgstRate: number;
}

export interface LineItemInput {
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface LineItem extends LineItemInput {
  serial: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  amount: number;
}

export interface BankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
}

export interface FooterText {
  left: string;
  right: string;
}

export interface Totals {
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  subTotal: number;
  roundOff: number;
  grandTotal: number;
}

/** Raw payload — what your API / form supplies. */
export interface RawInvoice {
  seller: Seller;
  buyer: Buyer;
  meta: MetaRow[];
  tax: TaxRates;
  items: LineItemInput[];
  bank: BankDetails;
  declaration: string;
  footer: FooterText;
}

/** Fully computed, render-ready invoice — output of buildInvoice(). */
export interface Invoice extends Omit<RawInvoice, 'items'> {
  items: LineItem[];
  totals: Totals;
  amountInWords: string;
}

export interface InvoiceLabels {
  title: string;
  billTo: string;
  invoiceDetails: string;
  bankDetails: string;
  amountInWords: string;
  declaration: string;
  signatory: string;
  taxableAmount: string;
  roundOff: string;
  grandTotal: string;
  serial: string;
  description: string;
  hsn: string;
  qty: string;
  unit: string;
  rate: string;
  taxableValue: string;
  amount: string;
}
