import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { activeDataProvider } from "@/services";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { getClientName } from "@/lib/clientLookup";
import { formatDate, formatCurrency } from "@/lib/formatters";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import {
  buildReminderEmailSubject,
  downloadInvoiceAndOpenGmail,
} from "@/services/gmailComposeService";
import type { Invoice } from "@/types";

interface SendReminderModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSent: () => void;
}

/**
 * The Send_Reminder_Action confirmation modal — review/edit/confirm/
 * cancel, then prepare a user-controlled Gmail compose flow and record one
 * activity event after the API confirms the action. It never sends email
 * automatically.
 */
export function SendReminderModal({ open, onClose, invoice, onSent }: SendReminderModalProps) {
  const { data: clients } = useClients();
  const { data: payments } = usePayments();
  const { data: business } = useBusinessProfile();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const client = clients?.find((candidate) => candidate.id === invoice.clientId);
  const { total } = computeInvoiceTotals(invoice);
  const paid = (payments ?? [])
    .filter((payment) => payment.invoiceId === invoice.id)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = Math.max(0, total - paid);

  useEffect(() => {
    if (open) {
      setMessage(
        `Dear ${client?.contactName?.trim() || client?.name?.trim() || "Customer"},\n\nThis is a reminder for invoice ${invoice.number}. The outstanding amount is ${formatCurrency(outstanding, true)} and the due date is ${formatDate(invoice.dueDate)}. Please let us know if you have any questions.\n\nRegards,\n${business?.name?.trim() || "SFT Billing"}`,
      );
      setErrorMessage(null);
    }
  }, [open, invoice.id, invoice.number, invoice.dueDate, client?.contactName, client?.name, outstanding, business?.name]);

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    const occurredAt = new Date().toISOString();

    try {
      const composeResult = await downloadInvoiceAndOpenGmail({
        invoice,
        client,
        business,
        subject: buildReminderEmailSubject(invoice, business),
        body: message,
      });
      if (!composeResult.composeOpened) {
        throw new Error(`Invoice file ${composeResult.fileName} was downloaded, but Gmail could not be opened. Allow pop-ups and try again.`);
      }

      const createdEvent = await activeDataProvider.addActivityEvent({
        type: "invoice_reminder_sent",
        occurredAt,
        summary: `Reminder sent for invoice ${invoice.number} to ${getClientName(clients, invoice.clientId)}`,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        amount: outstanding,
      });
      if (!createdEvent?.id) throw new Error("The reminder activity response was incomplete.");
      onSent();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't prepare the reminder email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a reminder?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Sending…" : "Send reminder"}
          </Button>
        </>
      }
    >
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-border-strong"
      />
      <p>
        Review and edit the message before continuing. No email is actually sent automatically; Gmail opens for your review, and the generated invoice file is downloaded for manual attachment.
      </p>
      {errorMessage && <p role="alert" className="mt-3 rounded-md border border-overdue/20 bg-overdue-bg px-3 py-2 text-xs text-overdue">{errorMessage}</p>}
    </Modal>
  );
}
