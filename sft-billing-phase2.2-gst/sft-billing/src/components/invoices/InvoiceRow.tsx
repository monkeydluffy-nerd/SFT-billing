import { ChevronDown, Send, CheckCircle2, Download, Pencil, Eye, BellRing, IndianRupee } from "lucide-react";
import type { Client, Invoice, Payment } from "@/types";
import { getInvoiceStatus, getInvoiceLedgerStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusChip } from "@/components/shared/StatusChip";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { MiniTimeline } from "./MiniTimeline";
import { cn } from "@/lib/cn";

interface InvoiceRowProps {
  invoice: Invoice;
  clients: Client[] | undefined;
  payments: Payment[] | undefined;
  isSelected: boolean;
  onToggleSelect: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSendReminder: () => void;
  onSendInvoice: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onView: () => void;
  busy?: boolean;
}

export function InvoiceRow({
  invoice,
  clients,
  payments,
  isSelected,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  onSendReminder,
  onSendInvoice,
  onRecordPayment,
  onEdit,
  onView,
  busy,
}: InvoiceRowProps) {
  const isDraft = invoice.isDraft;
  const info = isDraft ? getInvoiceStatus(invoice) : null;
  const invoicePayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
  const ledgerInfo = isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);
  const { total } = computeInvoiceTotals(invoice);
  const clientName = getClientName(clients, invoice.clientId);
  const canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
  const canRecordPayment = ledgerInfo?.status !== "received";
  const latestPayment = [...invoicePayments].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  )[0];

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3 transition-colors duration-micro hover:bg-canvas">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 shrink-0 rounded border-border-strong text-accent accent-accent"
          aria-label={`Select invoice ${invoice.number}`}
        />
        <div className="flex flex-1 items-center gap-4 text-left">
          <span className="w-24 shrink-0">
            <InvoiceNumberLink invoice={invoice} />
          </span>
          <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center gap-4 text-left" aria-expanded={isExpanded}>
            <span className="flex-1 truncate text-ink-muted">{clientName}</span>
            <span className="w-28 shrink-0 text-ink-muted">{formatDate(invoice.dueDate)}</span>
            <span className="font-tabular w-28 shrink-0 text-right text-ink">{formatCurrency(total)}</span>
            <span className="w-36 shrink-0">
              {isDraft ? <StatusChip info={info!} /> : ledgerInfo && <LedgerStatusChip info={ledgerInfo} />}
            </span>
            <ChevronDown
              size={16}
              className={cn("shrink-0 text-ink-faint transition-transform duration-micro", isExpanded && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border bg-canvas px-4 py-4">
          <div className="mb-4 max-w-md">
            <MiniTimeline
              invoice={invoice}
              info={isDraft ? info! : ledgerInfo!}
              finalDate={isDraft ? undefined : latestPayment?.receivedAt}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-micro hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 size={12} /> Bill invoice
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onView}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye size={12} /> View
                </button>
                {!invoice.sentAt && (
                  <button
                    type="button"
                    onClick={onSendInvoice}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send size={12} /> Send invoice
                  </button>
                )}
                {canRemind && (
                  <button
                    type="button"
                    onClick={onSendReminder}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <BellRing size={12} /> Send reminder
                  </button>
                )}
                {canRecordPayment && (
                  <button
                    type="button"
                    onClick={onRecordPayment}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <IndianRupee size={12} /> Record payment
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              disabled
              title="PDF export — Phase 4"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-faint opacity-50"
            >
              <Download size={12} /> Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
