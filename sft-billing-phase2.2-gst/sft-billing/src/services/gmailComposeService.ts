import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { downloadInvoicePdf } from "./invoicePdfService";

export interface GmailComposeInput {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
  subject: string;
  body: string;
}

export interface GmailComposeResult {
  fileName: string;
  composeOpened: boolean;
}

function businessName(business: BusinessProfile | undefined): string {
  return business?.name?.trim() || "SFT Billing";
}

function customerName(client: Client | undefined): string {
  return client?.name?.trim() || "Customer";
}

function openPopup(url: string, keepReference = false): Window | null {
  try {
    if (typeof window === "undefined" || typeof window.open !== "function") return null;
    const popup = window.open(url, "_blank", keepReference ? "" : "noopener,noreferrer");
    if (popup && keepReference) popup.opener = null;
    return popup;
  } catch {
    return null;
  }
}

function openComposeUrl(url: string): boolean {
  const popup = openPopup(url);
  if (popup) return true;

  // A normal link is the browser-safe fallback when a popup is blocked. It
  // still leaves Gmail and the generated file under the user's control.
  try {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    return false;
  }
}

function composeUrl(input: GmailComposeInput): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    su: input.subject,
    body: input.body,
  });
  if (input.client?.email?.trim()) params.set("to", input.client.email.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function buildInvoiceEmailSubject(invoice: Invoice, business: BusinessProfile | undefined): string {
  return `Invoice ${invoice.number} from ${businessName(business)}`;
}

export function buildInvoiceEmailBody(invoice: Invoice, client: Client | undefined, business: BusinessProfile | undefined): string {
  const { total } = computeInvoiceTotals(invoice);
  const dueLine = invoice.dueDate ? `Due date: ${formatDate(invoice.dueDate)}\n` : "";
  return [
    `Dear ${client?.contactName?.trim() || customerName(client)},`,
    "",
    `Please find the invoice details below for ${customerName(client)}.`,
    `Invoice number: ${invoice.number}`,
    `Invoice amount: ${formatCurrency(total, true)}`,
    dueLine.trimEnd(),
    "",
    `Regards,`,
    businessName(business),
  ].filter((line) => line.length > 0).join("\n");
}

export function buildReminderEmailSubject(invoice: Invoice, business: BusinessProfile | undefined): string {
  return `Reminder: Invoice ${invoice.number} outstanding — ${businessName(business)}`;
}

/**
 * Generates a PDF invoice as a local browser download and
 * opens a Gmail compose window with editable fields. Gmail web URLs cannot
 * attach a local file, so the downloaded PDF remains available for the
 * user to attach manually before pressing Gmail's Send button.
 */
export async function downloadInvoiceAndOpenGmail(input: GmailComposeInput): Promise<GmailComposeResult> {
  // Keep the click-created tab available while the invoice PDF is generated.
  const blankCompose = openPopup("about:blank", true);
  let fileName: string;

  try {
    fileName = await downloadInvoicePdf({ invoice: input.invoice, client: input.client, business: input.business });
  } catch (error) {
    try {
      blankCompose?.close();
    } catch {
      // Ignore a browser close failure and preserve the generation error.
    }
    throw error;
  }

  const url = composeUrl(input);
  if (blankCompose && !blankCompose.closed) {
    try {
      blankCompose.location.href = url;
      return { fileName, composeOpened: true };
    } catch {
      // Fall through to the regular compose-opening fallback.
    }
  }

  return { fileName, composeOpened: openComposeUrl(url) };
}