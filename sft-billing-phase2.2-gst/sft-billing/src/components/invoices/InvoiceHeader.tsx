import type { Client, Invoice, InvoiceLedgerStatusInfo } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { StatusChip } from "@/components/shared/StatusChip";

interface InvoiceHeaderProps {
  invoice: Invoice;
  client: Client | undefined;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  invoiceTotals: { total: number };
}

export function InvoiceHeader({ invoice, client, ledgerInfo, invoiceTotals }: InvoiceHeaderProps) {
  const isDraft = invoice.isDraft;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-ink truncate">{invoice.number}</h1>
        <p className="mt-1 text-sm text-ink-muted truncate">
          {client?.name ?? "Unknown client"}
        </p>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
        <div className="flex flex-wrap items-center gap-2">
          {isDraft ? (
            <StatusChip info={{ status: "draft", daysOverdue: 0, severity: null }} />
          ) : (
            ledgerInfo && <LedgerStatusChip info={ledgerInfo} />
          )}
        </div>

        <div className="text-right">
          <p className="text-xs font-medium text-ink-muted">Invoice total</p>
          <p className="font-tabular text-2xl font-semibold text-ink">
            {formatCurrency(invoiceTotals.total)}
          </p>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-ink-muted">Due date</p>
          <p className="font-tabular text-sm text-ink">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>
    </div>
  );
}