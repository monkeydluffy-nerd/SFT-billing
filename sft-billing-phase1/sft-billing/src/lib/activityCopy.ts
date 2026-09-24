import type { ActivityEventType } from "@/types";

/**
 * Generates human-readable activity event summaries.
 * These strings appear in the Overview feed, Invoice timeline, and Client activity.
 */
export function activitySummary(
  type: ActivityEventType,
  context: {
    invoiceNumber?: string;
    clientName?: string;
    amount?: string;
    paymentMethod?: string;
  }
): string {
  const { invoiceNumber, clientName, amount, paymentMethod } = context;

  switch (type) {
    case "invoice_created":
      return invoiceNumber && clientName
        ? `Invoice ${invoiceNumber} created for ${clientName}`
        : invoiceNumber
        ? `Invoice ${invoiceNumber} created`
        : "Invoice created";

    case "invoice_updated":
      return invoiceNumber
        ? `Invoice ${invoiceNumber} updated`
        : "Invoice updated";

    case "invoice_sent":
      return invoiceNumber && clientName
        ? `Invoice ${invoiceNumber} sent to ${clientName}`
        : invoiceNumber
        ? `Invoice ${invoiceNumber} marked as sent`
        : "Invoice marked as sent";

    case "invoice_viewed":
      return invoiceNumber
        ? `Invoice ${invoiceNumber} viewed by client`
        : "Invoice viewed";

    case "invoice_paid":
      return invoiceNumber && amount
        ? `Invoice ${invoiceNumber} paid — ${amount} received`
        : invoiceNumber
        ? `Invoice ${invoiceNumber} marked as paid`
        : "Invoice paid";

    case "invoice_cancelled":
      return invoiceNumber
        ? `Invoice ${invoiceNumber} cancelled`
        : "Invoice cancelled";

    case "invoice_became_overdue":
      return invoiceNumber
        ? `Invoice ${invoiceNumber} is now overdue`
        : "Invoice became overdue";

    case "payment_received":
      return amount && clientName
        ? `Payment of ${amount} received from ${clientName}${paymentMethod ? ` via ${paymentMethod}` : ""}`
        : amount
        ? `Payment of ${amount} recorded`
        : "Payment recorded";

    case "client_added":
      return clientName ? `Client ${clientName} added` : "New client added";

    case "client_updated":
      return clientName ? `Client ${clientName} updated` : "Client updated";

    case "note_added":
      return invoiceNumber
        ? `Note added to invoice ${invoiceNumber}`
        : "Note added";

    default:
      return "Activity recorded";
  }
}
