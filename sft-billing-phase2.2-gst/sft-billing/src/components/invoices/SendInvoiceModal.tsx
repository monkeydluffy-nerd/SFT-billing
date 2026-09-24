import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { activeDataProvider } from "@/services";
import { useClients } from "@/hooks/useClients";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency } from "@/lib/formatters";
import { InvoiceDocumentRenderer } from "@/components/create-invoice/InvoiceDocumentRenderer";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";
import {
  buildInvoiceEmailBody,
  buildInvoiceEmailSubject,
  downloadInvoiceAndOpenGmail,
} from "@/services/gmailComposeService";
import type { Invoice } from "@/types";

interface SendInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSent: () => void;
}

/**
 * The Send_Invoice_Action confirmation modal — only ever shown for an
 * already-billed invoice (Requirement 1.7), on the Invoice Detail page or
 * from an Invoices_Page row. Sets `sentAt`, never touches `billedAt`.
 * Follows the same Confirm_Modal_Pattern used for Bill/Reminder.
 */
export function SendInvoiceModal({ open, onClose, invoice, onSent }: SendInvoiceModalProps) {
  const { data: clients } = useClients();
  const { data: business } = useBusinessProfile();
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const client = clients?.find((c) => c.id === invoice.clientId);
  const documentModel = buildInvoiceDocumentModel({ invoice, client, business });
  const { total } = computeInvoiceTotals(invoice);
  const isResend = Boolean(invoice.sentAt);

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    const now = new Date().toISOString();

    try {
      const composeResult = await downloadInvoiceAndOpenGmail({
        invoice,
        client,
        business,
        subject: buildInvoiceEmailSubject(invoice, business),
        body: buildInvoiceEmailBody(invoice, client, business),
      });
      if (!composeResult.composeOpened) {
        throw new Error(`Invoice file ${composeResult.fileName} was downloaded, but Gmail could not be opened. Allow pop-ups and try again.`);
      }

      await activeDataProvider.saveInvoice({ ...invoice, sentAt: now });
      const createdEvent = await activeDataProvider.addActivityEvent({
        type: "invoice_sent",
        occurredAt: now,
        summary: `Invoice ${invoice.number} ${isResend ? "resent" : "sent"} to ${getClientName(clients, invoice.clientId)}`,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        amount: total,
      });
      if (!createdEvent?.id) throw new Error("The invoice activity response was incomplete.");
      onSent();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't prepare the invoice email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed -left-[100000px] top-0 w-[794px]" aria-hidden="true">
        <InvoiceDocumentRenderer model={documentModel} />
      </div>
      <Modal
        open={open}
        onClose={onClose}
        title={isResend ? "Resend this invoice?" : "Send this invoice?"}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? "Sending…" : isResend ? "Resend invoice" : "Send invoice"}
            </Button>
          </>
        }
      >
        <p>
          This records invoice {invoice.number} ({formatCurrency(total)}) as sent for{" "}
          <span className="font-medium text-ink">{client?.name ?? "the selected client"}</span>. No email or external message will be sent automatically;
          Gmail opens for your review, and the generated invoice file is downloaded for manual attachment.
        </p>
        {errorMessage && <p role="alert" className="mt-3 rounded-md border border-overdue/20 bg-overdue-bg px-3 py-2 text-xs text-overdue">{errorMessage}</p>}
      </Modal>
    </>
  );
}
