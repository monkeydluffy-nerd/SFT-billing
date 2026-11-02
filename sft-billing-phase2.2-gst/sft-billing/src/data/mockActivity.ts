import type { ActivityEvent } from "@/types";
import { mockInvoices } from "./mockInvoices";
import { mockPayments } from "./mockPayments";
import { mockClients } from "./mockClients";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency } from "@/lib/formatters";

function clientName(clientId: string): string {
  return mockClients.find((c) => c.id === clientId)?.name ?? "Unknown client";
}

let eventCounter = 0;
function nextId(): string {
  eventCounter += 1;
  return `ev_${eventCounter}`;
}

const events: ActivityEvent[] = [];

for (const client of mockClients) {
  events.push({
    id: nextId(),
    type: "client_added",
    occurredAt: new Date().toISOString(),
    summary: `${client.name} added as a client`,
    clientId: client.id,
  });
}

for (const invoice of mockInvoices) {
  const name = clientName(invoice.clientId);
  const { total } = computeInvoiceTotals(invoice);

  events.push({
    id: nextId(),
    type: "invoice_created",
    occurredAt: invoice.issueDate,
    summary: `Invoice ${invoice.number} created for ${name}`,
    clientId: invoice.clientId,
    invoiceId: invoice.id,
    amount: total,
  });

  if (invoice.sentAt) {
    events.push({
      id: nextId(),
      type: "invoice_sent",
      occurredAt: invoice.sentAt,
      summary: `Invoice ${invoice.number} sent to ${name}`,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      amount: total,
    });
  }

  if (invoice.viewedAt) {
    events.push({
      id: nextId(),
      type: "invoice_viewed",
      occurredAt: invoice.viewedAt,
      summary: `${name} viewed invoice ${invoice.number}`,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
    });
  }

  const statusInfo = getInvoiceStatus(invoice);
  if (statusInfo.status === "overdue") {
    events.push({
      id: nextId(),
      type: "invoice_became_overdue",
      occurredAt: invoice.dueDate,
      summary: `Invoice ${invoice.number} became overdue`,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      amount: total,
    });
  }
}

for (const payment of mockPayments) {
  events.push({
    id: nextId(),
    type: "payment_received",
    occurredAt: payment.receivedAt,
    summary: `Payment received — ${formatCurrency(payment.amount)}`,
    clientId: payment.clientId,
    invoiceId: payment.invoiceId,
    paymentId: payment.id,
    amount: payment.amount,
  });
}

events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

export const mockActivity: ActivityEvent[] = events;
