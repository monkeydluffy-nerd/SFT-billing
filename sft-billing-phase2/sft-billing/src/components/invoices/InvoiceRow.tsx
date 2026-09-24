import { ChevronDown, Send, CheckCircle2, Copy, Download, Pencil } from "lucide-react";
import type { Client, Invoice } from "@/types";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusChip } from "@/components/shared/StatusChip";
import { MiniTimeline } from "./MiniTimeline";
import { cn } from "@/lib/cn";

interface InvoiceRowProps {
  invoice: Invoice;
  clients: Client[] | undefined;
  isSelected: boolean;
  onToggleSelect: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSendReminder: () => void;
  onMarkPaid: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  busy?: boolean;
}

export function InvoiceRow({
  invoice,
  clients,
  isSelected,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  onSendReminder,
  onMarkPaid,
  onDuplicate,
  onEdit,
  busy,
}: InvoiceRowProps) {
  const info = getInvoiceStatus(invoice);
  const { total } = computeInvoiceTotals(invoice);
  const clientName = getClientName(clients, invoice.clientId);
  const canRemind = info.status === "pending" || info.status === "overdue";
  const canMarkPaid = info.status !== "paid" && info.status !== "draft";

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
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-4 text-left"
          aria-expanded={isExpanded}
        >
          <span className="w-24 shrink-0 font-medium text-ink">{invoice.number}</span>
          <span className="flex-1 truncate text-ink-muted">{clientName}</span>
          <span className="w-28 shrink-0 text-ink-muted">{formatDate(invoice.dueDate)}</span>
          <span className="font-tabular w-28 shrink-0 text-right text-ink">{formatCurrency(total)}</span>
          <span className="w-36 shrink-0">
            <StatusChip info={info} />
          </span>
          <ChevronDown
            size={16}
            className={cn("shrink-0 text-ink-faint transition-transform duration-micro", isExpanded && "rotate-180")}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-border bg-canvas px-4 py-4">
          <div className="mb-4 max-w-md">
            <MiniTimeline invoice={invoice} info={info} />
          </div>
          <div className="flex flex-wrap gap-2">
            {info.status === "draft" && (
              <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-micro hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil size={12} /> Continue editing
              </button>
            )}
            <button
              type="button"
              disabled={!canRemind || busy}
              onClick={onSendReminder}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={12} /> Send reminder
            </button>
            <button
              type="button"
              disabled={!canMarkPaid || busy}
              onClick={onMarkPaid}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 size={12} /> Mark paid
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={12} /> Duplicate
            </button>
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
