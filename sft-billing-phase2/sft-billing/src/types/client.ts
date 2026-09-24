export interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone?: string;
  billingAddress: string;
  /** ISO date the client relationship began. */
  clientSince: string;
  notes?: string;
}
