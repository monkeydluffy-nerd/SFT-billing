export interface Client {
  id: string;
  name: string;
  contactName?: string;
  email: string | null;
  phone?: string | null;
  billingAddress: string;
  /** GSTIN of the client's business — shown on the invoice as the customer's GSTIN, optional (not every client is GST-registered). */
  gstin?: string;
  pan?: string | null;
  notes?: string;
}
