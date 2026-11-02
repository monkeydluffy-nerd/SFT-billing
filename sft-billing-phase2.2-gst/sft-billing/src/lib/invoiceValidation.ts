import type { Invoice } from "@/types";

export interface InvoiceValidation {
  clientId?: string;
  items?: string;
  itemErrors: Record<string, string | undefined>;
}

/**
 * Returns per-field messages only for what's actually wrong — an empty
 * result means the invoice is ready to send. Called on every change so
 * errors surface next to the field the instant they're invalid, not in a
 * single block after the user tries to submit (blueprint §4.3).
 */
export function validateInvoiceDraft(invoice: Pick<Invoice, "clientId" | "items">): InvoiceValidation {
  const itemErrors: Record<string, string | undefined> = {};

  for (const item of invoice.items) {
    if (!item.description.trim()) {
      itemErrors[item.id] = "Add a description";
    } else if (item.quantity <= 0) {
      itemErrors[item.id] = "Quantity must be more than 0";
    } else if (item.unitPrice < 0) {
      itemErrors[item.id] = "Unit price can't be negative";
    }
  }

  const hasUsableItem = invoice.items.some((item) => item.description.trim() && item.quantity > 0);

  return {
    clientId: invoice.clientId ? undefined : "Select a client",
    items: hasUsableItem ? undefined : "Add at least one line item",
    itemErrors,
  };
}

export function isDraftReadyToSend(validation: InvoiceValidation): boolean {
  return !validation.clientId && !validation.items && Object.values(validation.itemErrors).every((e) => !e);
}
