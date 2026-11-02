import type { Client, Invoice, InvoiceLedgerStatusInfo, Payment } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { StatusChip } from "@/components/shared/StatusChip";
import { computeInvoiceTotals } from "@/lib/invoiceMath";

interface InvoiceSummaryProps {
  invoice: Invoice;
  client: Client | undefined;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  invoicePayments: Payment[];
}

export function InvoiceSummary({ invoice, client, ledgerInfo, invoicePayments }: InvoiceSummaryProps) {
  const invoiceTotals = computeInvoiceTotals(invoice);
  const paid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.max(0, invoiceTotals.total - paid);

  if (invoice.isDraft) {
    return (
      <section aria-label="Draft invoice details" className="space-y-6">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-5">
          <div>
            <StatusChip info={{ status: "draft", daysOverdue: 0, severity: null }} />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-medium text-ink-muted">Invoice total</p>
            <p className="font-tabular text-xl text-ink">{formatCurrency(invoiceTotals.total)}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-ink-muted">Invoice number</p>
            <p className="mt-1 font-mono text-sm text-ink">{invoice.number}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-ink-muted">Issue date</p>
            <p className="mt-1 text-sm text-ink">{formatDate(invoice.issueDate)}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-ink-muted">Due date</p>
            <p className="mt-1 text-sm text-ink">{formatDate(invoice.dueDate)}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-ink-muted">Client</p>
            <p className="mt-1 text-sm text-ink">{client?.name ?? "Unknown client"}</p>
          </div>
        </div>

        {invoice.poNumber && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-ink-muted">PO number</p>
            <p className="mt-1 font-mono text-sm text-ink">{invoice.poNumber}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Invoice summary and details" className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-5">
        <div>
          {ledgerInfo && <LedgerStatusChip info={ledgerInfo} />}
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-xs font-medium text-ink-muted">Invoice total</p>
              <p className="font-tabular text-lg font-semibold text-ink">{formatCurrency(invoiceTotals.total)}</p>
            </div>
            {paid > 0 && (
              <div className="text-right">
                <p className="text-xs font-medium text-ink-muted">Received</p>
                <p className="font-tabular text-lg font-semibold text-success">{formatCurrency(paid)}</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs font-medium text-ink-muted">Outstanding</p>
              <p className="font-tabular text-lg font-semibold text-ink">{formatCurrency(outstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-ink-muted">Invoice number</p>
          <p className="mt-1 font-mono text-sm text-ink">{invoice.number}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-ink-muted">Issue date</p>
          <p className="mt-1 text-sm text-ink">{formatDate(invoice.issueDate)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-ink-muted">Due date</p>
          <p className="mt-1 text-sm text-ink">{formatDate(invoice.dueDate)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-ink-muted">Client</p>
          <p className="mt-1 text-sm text-ink">{client?.name ?? "Unknown client"}</p>
        </div>
      </div>

      {(invoice.poNumber || invoice.poDate || invoice.transporter) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {invoice.poNumber && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-ink-muted">PO number</p>
              <p className="mt-1 font-mono text-sm text-ink">{invoice.poNumber}</p>
            </div>
          )}
          {invoice.poDate && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-ink-muted">PO date</p>
              <p className="mt-1 text-sm text-ink">{formatDate(invoice.poDate)}</p>
            </div>
          )}
          {invoice.transporter && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-ink-muted">Transporter</p>
              <p className="mt-1 text-sm text-ink">{invoice.transporter}</p>
            </div>
          )}
        </div>
      )}

      {invoice.notes && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-ink-muted">Notes</p>
          <p className="mt-1 text-sm text-ink whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </section>
  );
}