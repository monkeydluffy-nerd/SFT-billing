export type ActivityEventType =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_sent"
  | "invoice_viewed"
  | "invoice_paid"
  | "invoice_cancelled"
  | "invoice_became_overdue"
  | "payment_received"
  | "client_added"
  | "client_updated"
  | "note_added";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  occurredAt: string; // ISO datetime
  /** Plain-language summary, composed at creation time. */
  summary: string;
  clientId?: string;
  invoiceId?: string;
  paymentId?: string;
  amount?: number;
}
