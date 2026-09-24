export interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone?: string;
  billingAddress: string;
  /** GSTIN of the client's business — shown on the invoice as the customer's GSTIN, optional (not every client is GST-registered). */
  gstin?: string;
  /** ISO date the client relationship began. */
  clientSince: string;
  notes?: string;
}
