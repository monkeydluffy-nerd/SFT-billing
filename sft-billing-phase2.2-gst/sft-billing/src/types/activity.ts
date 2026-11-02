export type ActivityEventType =
  | "invoice_created"
  | "invoice_sent"
  | "invoice_viewed"
  | "invoice_became_overdue"
  | "invoice_reminder_sent"
  | "invoice_marked_paid"
  | "payment_received"
  | "client_added"
  | "note_added";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  occurredAt: string; // ISO datetime
  /** Plain-language, already composed — see lib/activityCopy.ts for how these are generated from source records. */
  summary: string;
  clientId?: string;
  invoiceId?: string;
  paymentId?: string;
  amount?: number;
}
