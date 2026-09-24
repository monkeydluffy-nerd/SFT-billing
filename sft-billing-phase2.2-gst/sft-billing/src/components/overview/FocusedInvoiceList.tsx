import { Inbox } from "lucide-react";
import type { Client, Invoice, InvoiceStatus, Payment } from "@/types";
import { getInvoiceStatus, getInvoiceLedgerStatus, getInvoiceWorkflowStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusChip } from "@/components/shared/StatusChip";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePayments } from "@/hooks/usePayments";

interface FocusedInvoiceListProps {
  status: InvoiceStatus;
  invoices: Invoice[];
  clients: Client[] | undefined;
}

const STATUS_COPY: Record<InvoiceStatus, string> = {
  paid: "Received invoices",
  pending: "Outstanding invoices",
  overdue: "Overdue invoices",
  draft: "Draft invoices",
};

function matchesWorkflowFilter(invoice: Invoice, status: InvoiceStatus, payments: Payment[]): boolean {
  const workflowStatus = getInvoiceWorkflowStatus(invoice, payments).status;
  if (status === "pending") return workflowStatus === "outstanding";
  if (status === "paid") return workflowStatus === "received";
  return workflowStatus === status;
}

export function FocusedInvoiceList({ status, invoices, clients }: FocusedInvoiceListProps) {
  const { data: payments } = usePayments();
  const filtered = invoices
    .filter((invoice) => matchesWorkflowFilter(invoice, status, payments ?? []))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const statusLabel = STATUS_COPY[status];

  return (
    <div>
      <p className="mb-4 text-sm font-medium text-ink">
        {statusLabel} <span className="text-ink-faint">({filtered.length})</span>
      </p>
      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title={`No ${statusLabel.toLowerCase()} right now`} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas text-left text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Due date</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((invoice) => {
                const { total } = computeInvoiceTotals(invoice);
                const invoicePayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
                const ledgerInfo = invoice.isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);
                return (
                  <tr key={invoice.id} className="transition-colors duration-micro hover:bg-canvas">
                    <td className="px-4 py-3 font-medium text-ink">
                      <InvoiceNumberLink invoice={invoice} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{getClientName(clients, invoice.clientId)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(invoice.dueDate)}</td>
                    <td className="font-tabular px-4 py-3 text-right text-ink">
                      {invoice.isDraft ? "—" : formatCurrency(total)}
                    </td>
                    <td className="px-4 py-3">
                      {invoice.isDraft ? (
                        <StatusChip info={getInvoiceStatus(invoice)} />
                      ) : ledgerInfo ? (
                        <LedgerStatusChip info={ledgerInfo} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
