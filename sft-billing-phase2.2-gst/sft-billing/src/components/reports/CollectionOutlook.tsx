import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Invoice, Payment, Client } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { computeInvoiceTotals, getInvoiceStatus } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { EmptyState } from "@/components/shared/EmptyState";

interface CollectionOutlookItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  dueDate: string;
  daysUntilDue: number;
  outstanding: number;
  status: "overdue" | "due-soon" | "pending";
  isOverdue: boolean;
  isDueSoon: boolean;
}

interface CollectionOutlookProps {
  invoices: Invoice[];
  payments: Payment[];
  clients: Client[];
  asOf?: Date;
}

// The calculation helper is intentionally exported for tests.
// eslint-disable-next-line react-refresh/only-export-components
export function getCollectionOutlookItems(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  asOf: Date = new Date()
): CollectionOutlookItem[] {
  const msPerDay = 1000 * 60 * 60 * 24;

  // Only consider non-draft, non-paid invoices
  const unpaidInvoices = invoices.filter((invoice) => {
    if (invoice.isDraft) return false;
    if (invoice.paidAt) return false;
    return true;
  });

  const items: CollectionOutlookItem[] = [];

  for (const invoice of unpaidInvoices) {
    const { total } = computeInvoiceTotals(invoice);
    const paid = payments
      .filter((p) => p.invoiceId === invoice.id)
      .reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, total - paid);

    // Skip fully paid invoices
    if (outstanding <= 0) continue;

    const invoiceStatus = getInvoiceStatus(invoice, asOf).status;
    const dueDateObj = new Date(invoice.dueDate);
    const daysUntilDue = Math.ceil((dueDateObj.getTime() - asOf.getTime()) / msPerDay);

    let status: CollectionOutlookItem["status"] = "pending";
    let isOverdue = false;
    let isDueSoon = false;

    if (invoiceStatus === "overdue") {
      status = "overdue";
      isOverdue = true;
    } else if (invoiceStatus === "pending") {
      if (daysUntilDue <= 7) {
        status = "due-soon";
        isDueSoon = true;
      } else {
        status = "pending";
      }
    }

    items.push({
      id: invoice.id,
      invoiceNumber: invoice.number,
      clientName: getClientName(clients, invoice.clientId),
      dueDate: invoice.dueDate,
      daysUntilDue,
      outstanding,
      status,
      isOverdue,
      isDueSoon,
    });
  }

  // Sort: overdue first (most overdue first), then due soon (soonest first), then pending (soonest due first)
  return items.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.isOverdue && b.isOverdue) return a.daysUntilDue - b.daysUntilDue; // Most overdue first
    if (a.isDueSoon && !b.isDueSoon) return -1;
    if (!a.isDueSoon && b.isDueSoon) return 1;
    if (a.isDueSoon && b.isDueSoon) return a.daysUntilDue - b.daysUntilDue; // Soonest due first
    return a.daysUntilDue - b.daysUntilDue; // Soonest due first
  });
}

export function CollectionOutlook({ invoices, payments, clients, asOf }: CollectionOutlookProps) {
  const items = getCollectionOutlookItems(invoices, payments, clients, asOf);

  const overdueItems = items.filter(i => i.isOverdue);
  const dueSoonItems = items.filter(i => i.isDueSoon && !i.isOverdue);
  const pendingItems = items.filter(i => !i.isOverdue && !i.isDueSoon);

  const totalOverdue = items.filter(i => i.isOverdue).reduce((sum, i) => sum + i.outstanding, 0);
  const totalDueSoon = items.filter(i => i.isDueSoon && !i.isOverdue).reduce((sum, i) => sum + i.outstanding, 0);
  const totalPending = items.filter(i => !i.isOverdue && !i.isDueSoon).reduce((sum, i) => sum + i.outstanding, 0);
  const totalOutstanding = items.reduce((sum, i) => sum + i.outstanding, 0);

  if (items.length === 0) {
    return (
      <section className="space-y-4" aria-label="Collection Outlook">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Collection Outlook</p>
          <span className="text-xs text-ink-muted">Based on saved invoice and payment data</span>
        </div>
        <EmptyState
          icon={CheckCircle2}
          title="No outstanding invoices"
          description="All billed invoices are fully paid. No collection action needed."
        />
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Collection Outlook">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Collection Outlook</p>
        <span className="text-xs text-ink-muted">Based on saved invoice and payment data</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 p-3 bg-overdue-bg border border-overdue/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-overdue shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Overdue</p>
            <p className="font-tabular text-lg font-medium text-overdue">{formatCurrency(totalOverdue)}</p>
            <p className="text-xs text-ink-muted">{overdueItems.length} invoice{overdueItems.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-caution-bg border border-caution/30 rounded-lg">
          <Clock className="h-5 w-5 text-caution shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Due within 7 days</p>
            <p className="font-tabular text-lg font-medium text-caution">{formatCurrency(totalDueSoon)}</p>
            <p className="text-xs text-ink-muted">{dueSoonItems.length} invoice{dueSoonItems.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-success-bg border border-success/30 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Pending (due later)</p>
            <p className="font-tabular text-lg font-medium text-success">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-ink-muted">{pendingItems.length} invoice{pendingItems.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      {/* Total outstanding */}
      <div className="flex items-center justify-between text-sm px-3 py-2 bg-surface border border-border rounded-lg">
        <span className="font-medium text-ink">Total Outstanding</span>
        <span className="font-tabular font-medium text-ink">{formatCurrency(totalOutstanding)}</span>
      </div>

      {/* Overdue invoices */}
      {overdueItems.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-overdue">Overdue ({overdueItems.length})</p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[130px]">Invoice</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[200px] min-w-[140px]">Client</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px]">Due Date</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px] text-right">Days Overdue</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdueItems.map((item) => (
                  <tr key={item.id} className="transition-colors duration-micro hover:bg-canvas">
                    <td className="px-4 py-2 font-medium text-accent w-[130px]">
                      <span className="font-medium text-accent">{item.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted truncate">{item.clientName}</td>
                    <td className="px-4 py-2 text-ink-muted whitespace-nowrap">{formatDate(item.dueDate)}</td>
                    <td className="px-4 py-2 text-right font-medium text-overdue w-[100px] whitespace-nowrap">
                      {Math.abs(item.daysUntilDue)} day{item.daysUntilDue === -1 ? "" : "s"} overdue
                    </td>
                    <td className="px-4 py-2 text-right font-tabular text-overdue w-[120px] whitespace-nowrap">
                      {formatCurrency(item.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Due soon invoices */}
      {dueSoonItems.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-caution">Due within 7 days ({dueSoonItems.length})</p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[130px]">Invoice</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[200px] min-w-[140px]">Client</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px]">Due Date</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px] text-right">Due In</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dueSoonItems.map((item) => (
                  <tr key={item.id} className="transition-colors duration-micro hover:bg-canvas">
                    <td className="px-4 py-2 font-medium text-accent w-[130px]">
                      <span className="font-medium text-accent">{item.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted truncate">{item.clientName}</td>
                    <td className="px-4 py-2 text-ink-muted whitespace-nowrap">{formatDate(item.dueDate)}</td>
                    <td className="px-4 py-2 text-right font-medium text-caution w-[100px] whitespace-nowrap">
                      {item.daysUntilDue === 0 ? "Today" : item.daysUntilDue === 1 ? "1 day" : `${item.daysUntilDue} days`}
                    </td>
                    <td className="px-4 py-2 text-right font-tabular text-caution w-[120px] whitespace-nowrap">
                      {formatCurrency(item.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pending invoices (due later) */}
      {pendingItems.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-ink-muted">Due later ({pendingItems.length})</p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[130px]">Invoice</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[200px] min-w-[140px]">Client</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px]">Due Date</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingItems.map((item) => (
                  <tr key={item.id} className="transition-colors duration-micro hover:bg-canvas">
                    <td className="px-4 py-2 font-medium text-accent w-[130px]">
                      <span className="font-medium text-accent">{item.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted truncate">{item.clientName}</td>
                    <td className="px-4 py-2 text-ink-muted whitespace-nowrap">{formatDate(item.dueDate)}</td>
                    <td className="px-4 py-2 text-right font-tabular text-ink w-[120px] whitespace-nowrap">
                      {formatCurrency(item.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Total summary */}
      <div className="flex items-center justify-between text-sm px-3 py-2 bg-surface border border-border rounded-lg">
        <span className="font-medium text-ink">Total Outstanding</span>
        <span className="font-tabular font-medium text-ink">{formatCurrency(totalOutstanding)}</span>
      </div>
    </section>
  );
}