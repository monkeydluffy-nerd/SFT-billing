/** Bank account details for receiving payment — lives on the Business Profile, never re-entered per invoice. */
export interface BankDetails {
  accountHolder: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  ifsc: string;
}

/**
 * The workspace's own identity — the "from" party on every invoice.
 * Editable in Workspace Settings (Phase 4); today it's a single mock
 * record read via getBusinessProfile(). Nothing invoice-specific lives
 * here — GST rates on an invoice are still per-invoice and editable,
 * this only supplies the starting default via `defaultGst`.
 */
export interface BusinessProfile {
  name: string;
  logoUrl?: string;
  address: string;
  email: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  bank?: BankDetails;
  /** Default declaration/certification text, editable per invoice via `Invoice.terms`. */
  declaration?: string;
  authorizedSignatory?: string;
  defaultGst?: { cgstRate: number; sgstRate: number };
}
