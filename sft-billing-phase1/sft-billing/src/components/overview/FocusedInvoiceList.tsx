import { Inbox } from "lucide-react";
import type { Client, Invoice, InvoiceStatus } from "@/types";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusChip } from "@/components/shared/StatusChip";
import { EmptyState } from "@/components/shared/EmptyState";

interface FocusedInvoiceListProps {
  status: InvoiceStatus;
  invoices: Invoice[];
  clients: Client[] | undefined;
}

const STATUS_COPY: Record<InvoiceStatus, string> = {
  paid: "Paid invoices",
  pending: "Pending invoices",
  overdue: "Overdue invoices",
  draft: "Draft invoices",
};

export function FocusedInvoiceList({ status, invoices, clients }: FocusedInvoiceListProps) {
  const filtered = invoices
    .filter((invoice) => getInvoiceStatus(invoice).status === status)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div>
      <p className="mb-4 text-sm font-medium text-ink">
        {STATUS_COPY[status]} <span className="text-ink-faint">({filtered.length})</span>
      </p>
      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title={`No ${status} invoices right now`} />
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
                const info = getInvoiceStatus(invoice);
                const { total } = computeInvoiceTotals(invoice);
                return (
                  <tr key={invoice.id} className="transition-colors duration-micro hover:bg-canvas">
                    <td className="px-4 py-3 font-medium text-ink">{invoice.number}</td>
                    <td className="px-4 py-3 text-ink-muted">{getClientName(clients, invoice.clientId)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(invoice.dueDate)}</td>
                    <td className="font-tabular px-4 py-3 text-right text-ink">{formatCurrency(total)}</td>
                    <td className="px-4 py-3">
                      <StatusChip info={info} />
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
