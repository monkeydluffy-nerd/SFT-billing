import { TrendingUp, BarChart2, Users, DollarSign, AlertTriangle } from "lucide-react";
import { Invoice, Payment, Client } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { computeInvoiceTotals, getInvoiceStatus } from "@/lib/invoiceMath";
import { cn } from "@/lib/cn";

export interface ClientTrendData {
  clientId: string;
  clientName: string;
  // Current period
  invoicesCount: number;
  billedAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  // Comparable period
  prevInvoicesCount: number;
  prevBilledAmount: number;
  prevReceivedAmount: number;
  // Trends
  billedChangePct: number | null;
  receivedChangePct: number | null;
  invoicesChangePct: number | null;
  // Status
  hasOverdue: boolean;
  lastInvoiceDate: string | null;
  lastPaymentDate: string | null;
}

interface ClientTrendsProps {
  invoices: Invoice[];
  payments: Payment[];
  clients: Client[];
  asOf?: Date;
  currentStart: Date;
  currentEnd: Date;
  comparableStart: Date;
  comparableEnd: Date;
}

function computeClientTrends(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  asOf: Date,
  currentStart: Date,
  currentEnd: Date,
  comparableStart: Date,
  comparableEnd: Date
): ClientTrendData[] {
  const clientMap = new Map<string, ClientTrendData>();

  // Initialize all clients
  for (const client of clients) {
    clientMap.set(client.id, {
      clientId: client.id,
      clientName: client.name,
      invoicesCount: 0,
      billedAmount: 0,
      receivedAmount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      prevInvoicesCount: 0,
      prevBilledAmount: 0,
      prevReceivedAmount: 0,
      billedChangePct: null,
      receivedChangePct: null,
      invoicesChangePct: null,
      hasOverdue: false,
      lastInvoiceDate: null,
      lastPaymentDate: null,
    });
  }

  // Process invoices for current period
  for (const invoice of invoices) {
    if (invoice.isDraft) continue;
    const issueDate = new Date(invoice.issueDate);
    const { total } = computeInvoiceTotals(invoice);
    const statusInfo = getInvoiceStatus(invoice, asOf);

    const clientData = clientMap.get(invoice.clientId);
    if (!clientData) continue;

    // Update last invoice date
    if (!clientData.lastInvoiceDate || issueDate > new Date(clientData.lastInvoiceDate)) {
      clientData.lastInvoiceDate = invoice.issueDate;
    }

    const isCurrent = issueDate >= currentStart && issueDate < currentEnd;
    const isComparable = issueDate >= comparableStart && issueDate < comparableEnd;

    if (isCurrent) {
      clientData.invoicesCount++;
      clientData.billedAmount += total;
      if (statusInfo.status === "pending" || statusInfo.status === "overdue") {
        clientData.outstandingAmount += total;
      }
      if (statusInfo.status === "overdue") {
        clientData.overdueAmount += total;
        clientData.hasOverdue = true;
      }
    } else if (isComparable) {
      clientData.prevInvoicesCount++;
      clientData.prevBilledAmount += total;
    }
  }

  // Process payments for current period
  for (const payment of payments) {
    const receivedDate = new Date(payment.receivedAt);
    const clientData = clientMap.get(payment.clientId);
    if (!clientData) continue;

    // Update last payment date
    if (!clientData.lastPaymentDate || receivedDate > new Date(clientData.lastPaymentDate)) {
      clientData.lastPaymentDate = payment.receivedAt;
    }

    const isCurrent = receivedDate >= currentStart && receivedDate < currentEnd;
    const isComparable = receivedDate >= comparableStart && receivedDate < comparableEnd;

    if (isCurrent) {
      clientData.receivedAmount += payment.amount;
    } else if (isComparable) {
      clientData.prevReceivedAmount += payment.amount;
    }
  }

  // Calculate trends
  for (const data of clientMap.values()) {
    // Billed trend
    if (data.prevBilledAmount > 0) {
      data.billedChangePct = ((data.billedAmount - data.prevBilledAmount) / data.prevBilledAmount) * 100;
    } else if (data.billedAmount > 0) {
      data.billedChangePct = 100; // New client this period
    }

    // Received trend
    if (data.prevReceivedAmount > 0) {
      data.receivedChangePct = ((data.receivedAmount - data.prevReceivedAmount) / data.prevReceivedAmount) * 100;
    } else if (data.receivedAmount > 0) {
      data.receivedChangePct = 100;
    }

    // Invoices count trend
    if (data.prevInvoicesCount > 0) {
      data.invoicesChangePct = ((data.invoicesCount - data.prevInvoicesCount) / data.prevInvoicesCount) * 100;
    } else if (data.invoicesCount > 0) {
      data.invoicesChangePct = 100;
    }
  }

  // Convert to array and filter to clients with activity in either period
  return Array.from(clientMap.values())
    .filter(
      (d) =>
        d.invoicesCount > 0 ||
        d.billedAmount > 0 ||
        d.receivedAmount > 0 ||
        d.prevInvoicesCount > 0 ||
        d.prevBilledAmount > 0 ||
        d.prevReceivedAmount > 0
    )
    .sort((a, b) => {
      // Sort by: overdue first, then by billed amount descending
      if (a.hasOverdue && !b.hasOverdue) return -1;
      if (!a.hasOverdue && b.hasOverdue) return 1;
      return b.billedAmount - a.billedAmount;
    });
}

function getTrendColor(changePct: number | null) {
  if (changePct === null || changePct === 0) return "text-ink-muted";
  if (changePct > 0) return "text-success";
  return "text-overdue";
}

export function ClientTrends({
  invoices,
  payments,
  clients,
  asOf = new Date(),
  currentStart,
  currentEnd,
  comparableStart,
  comparableEnd,
}: ClientTrendsProps) {
  const trends = computeClientTrends(
    invoices,
    payments,
    clients,
    asOf,
    currentStart,
    currentEnd,
    comparableStart,
    comparableEnd
  );

  if (trends.length === 0) {
    return (
      <section className="space-y-4" aria-label="Client Trends">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Client Trends</p>
          <span className="text-xs text-ink-muted">Period comparison</span>
        </div>
        <div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-lg">
          <BarChart2 className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink-muted">No client activity in this period</p>
            <p className="text-xs text-ink-faint">Select a wider date range to see trends.</p>
          </div>
        </div>
      </section>
    );
  }

  const activeClients = trends.filter((t) => t.invoicesCount > 0 || t.billedAmount > 0 || t.receivedAmount > 0).length;
  const totalBilled = trends.reduce((sum, t) => sum + t.billedAmount, 0);
  const totalReceived = trends.reduce((sum, t) => sum + t.receivedAmount, 0);
  const totalOutstanding = trends.reduce((sum, t) => sum + t.outstandingAmount, 0);
  const clientsWithOverdue = trends.filter((t) => t.hasOverdue).length;

  return (
    <section className="space-y-4" aria-label="Client Trends">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Client Trends</p>
        <span className="text-xs text-ink-muted">Period vs comparable period</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <Users className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Active Clients</p>
            <p className="font-tabular text-lg font-medium text-ink">{activeClients}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <DollarSign className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Billed This Period</p>
            <p className="font-tabular text-lg font-medium text-ink">{formatCurrency(totalBilled)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <TrendingUp className="h-5 w-5 text-success shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Received This Period</p>
            <p className="font-tabular text-lg font-medium text-success">{formatCurrency(totalReceived)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-caution-bg border border-caution/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-caution shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-caution">Outstanding</p>
            <p className="font-tabular text-lg font-medium text-caution">{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs text-ink-muted">{clientsWithOverdue} client{clientsWithOverdue === 1 ? "" : "s"} overdue</p>
          </div>
        </div>
      </div>

      {/* Client Trends Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[840px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[200px] min-w-[140px]">Client</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[60px] text-right">Invoices</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Billed</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Payments</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Outstanding</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px] text-right">Overdue</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px]">Last Invoice</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px]">Last Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trends.map((client) => (
              <tr key={client.clientId} className={cn("transition-colors duration-micro hover:bg-canvas", client.hasOverdue && "bg-overdue-bg/20")}>
                <td className="px-4 py-2 font-medium text-ink truncate w-[200px] min-w-[140px]">
                  {client.clientName}
                  {client.hasOverdue && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-overdue-bg text-overdue rounded">OVERDUE</span>}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink-muted w-[60px] whitespace-nowrap">
                  {client.invoicesCount} {client.invoicesChangePct !== null && (
                    <span className={cn("ml-1 text-[10px]", getTrendColor(client.invoicesChangePct))}>
                      ({client.invoicesChangePct > 0 ? "+" : ""}{client.invoicesChangePct.toFixed(0)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink w-[120px] whitespace-nowrap">
                  {formatCurrency(client.billedAmount)} {client.billedChangePct !== null && (
                    <span className={cn("ml-1 text-[10px]", getTrendColor(client.billedChangePct))}>
                      ({client.billedChangePct > 0 ? "+" : ""}{client.billedChangePct.toFixed(1)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-success w-[120px] whitespace-nowrap">
                  {formatCurrency(client.receivedAmount)} {client.receivedChangePct !== null && (
                    <span className={cn("ml-1 text-[10px]", getTrendColor(client.receivedChangePct))}>
                      ({client.receivedChangePct > 0 ? "+" : ""}{client.receivedChangePct.toFixed(1)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink w-[120px] whitespace-nowrap">
                  {formatCurrency(client.outstandingAmount)}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-overdue w-[100px] whitespace-nowrap">
                  {formatCurrency(client.overdueAmount)}
                </td>
                <td className="px-4 py-2 text-ink-muted w-[100px] whitespace-nowrap">
                  {client.lastInvoiceDate ? formatDate(client.lastInvoiceDate) : "—"}
                </td>
                <td className="px-4 py-2 text-ink-muted w-[100px] whitespace-nowrap">
                  {client.lastPaymentDate ? formatDate(client.lastPaymentDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The calculation helper is intentionally exported for tests and report reuse.
// eslint-disable-next-line react-refresh/only-export-components
export { computeClientTrends };