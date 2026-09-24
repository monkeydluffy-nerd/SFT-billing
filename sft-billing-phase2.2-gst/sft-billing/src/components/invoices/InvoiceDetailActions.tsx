import { useState } from "react";
import { Pencil, Send, BellRing, IndianRupee } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { SendInvoiceModal } from "./SendInvoiceModal";
import { SendReminderModal } from "./SendReminderModal";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { useClients } from "@/hooks/useClients";
import type { Invoice, InvoiceLedgerStatusInfo } from "@/types";

interface InvoiceDetailActionsProps {
  invoice: Invoice;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  onContinueEditing: () => void;
  onSent: () => void;
  onReminderSent: () => void;
  onPaymentRecorded: () => void;
}

/**
 * The status-gated action set for the Invoice_Detail_Page (Requirement
 * 5.6/5.7): a Draft_Invoice gets only "Continue editing"; a
 * Billed_Invoice always gets Send/Resend, plus Send reminder when
 * Outstanding/Overdue and Record payment when not Received.
 */
export function InvoiceDetailActions({
  invoice,
  ledgerInfo,
  onContinueEditing,
  onSent,
  onReminderSent,
  onPaymentRecorded,
}: InvoiceDetailActionsProps) {
  const { data: clients } = useClients();
  const [sendOpen, setSendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  if (invoice.isDraft) {
    return (
      <Button onClick={onContinueEditing}>
        <Pencil size={14} /> Continue editing
      </Button>
    );
  }

  const canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
  const canRecordPayment = ledgerInfo?.status !== "received";

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setSendOpen(true)}>
        <Send size={14} /> {invoice.sentAt ? "Resend invoice" : "Send invoice"}
      </Button>
      {canRemind && (
        <Button variant="secondary" onClick={() => setReminderOpen(true)}>
          <BellRing size={14} /> Send reminder
        </Button>
      )}
      {canRecordPayment && (
        <Button variant="secondary" onClick={() => setRecordOpen(true)}>
          <IndianRupee size={14} /> Record payment
        </Button>
      )}

      <SendInvoiceModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        invoice={invoice}
        onSent={() => {
          setSendOpen(false);
          onSent();
        }}
      />
      <SendReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        invoice={invoice}
        onSent={() => {
          setReminderOpen(false);
          onReminderSent();
        }}
      />
      <RecordPaymentModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        invoices={[invoice]}
        clients={clients}
        onRecorded={() => {
          setRecordOpen(false);
          onPaymentRecorded();
        }}
      />
    </div>
  );
}
