import { useState } from "react";
import { Send, BellRing, IndianRupee, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { ExportDropdown } from "./ExportDropdown";
import { SendInvoiceModal } from "./SendInvoiceModal";
import { SendReminderModal } from "./SendReminderModal";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { useClients } from "@/hooks/useClients";
import type { Invoice, InvoiceLedgerStatusInfo } from "@/types";

interface ActionToolbarProps {
  invoice: Invoice;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  onContinueEditing: () => void;
  onSent: () => void;
  onReminderSent: () => void;
  onPaymentRecorded: () => void;
  onExpandPreview: () => void;
  isPreviewExpanded: boolean;
}

export function ActionToolbar({
  invoice,
  ledgerInfo,
  onContinueEditing,
  onSent,
  onReminderSent,
  onPaymentRecorded,
  onExpandPreview,
  isPreviewExpanded,
}: ActionToolbarProps) {
  const { data: clients } = useClients();
  const [sendOpen, setSendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  if (invoice.isDraft) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onContinueEditing}>
          Continue editing
        </Button>
        <Button variant="ghost" size="sm" onClick={onExpandPreview} aria-label={isPreviewExpanded ? "Collapse preview" : "Expand preview"}>
          {isPreviewExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </Button>
      </div>
    );
  }

  const canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
  const canRecordPayment = ledgerInfo?.status !== "received";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportDropdown invoice={invoice} />
      <Button onClick={() => setSendOpen(true)}>
        <Send size={14} />
        <span className="hidden sm:inline">{invoice.sentAt ? "Resend invoice" : "Send invoice"}</span>
      </Button>
      {canRemind && (
        <Button variant="secondary" onClick={() => setReminderOpen(true)}>
          <BellRing size={14} />
          <span className="hidden sm:inline">Send reminder</span>
        </Button>
      )}
      {canRecordPayment && (
        <Button variant="secondary" onClick={() => setRecordOpen(true)}>
          <IndianRupee size={14} />
          <span className="hidden sm:inline">Record payment</span>
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onExpandPreview} aria-label={isPreviewExpanded ? "Collapse preview" : "Expand preview"}>
        {isPreviewExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </Button>

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