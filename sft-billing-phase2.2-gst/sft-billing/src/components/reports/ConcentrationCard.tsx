import { AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import type { Client, Invoice, Payment } from "@/types";
import { computeInvoiceTotals, getInvoiceStatus } from "@/lib/invoiceMath";

interface ConcentrationCardProps {
  invoices: Invoice[];
  payments: Payment[];
  clients: Client[];
  asOf?: Date;
}

export function ConcentrationCard({
  invoices,
  payments,
  clients,
  asOf = new Date(),
}: ConcentrationCardProps) {
  // Calculate outstanding by client
  const clientOutstanding = new Map<string, number>();
  let totalOutstanding = 0;

  for (const invoice of invoices) {
    if (invoice.isDraft) continue;
    const status = getInvoiceStatus(invoice, asOf).status;
    if (status === "pending" || status === "overdue") {
      const paid = payments
        .filter((p) => p.invoiceId === invoice.id)
        .reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, computeInvoiceTotals(invoice).total - paid);
      if (outstanding > 0) {
        const current = clientOutstanding.get(invoice.clientId) || 0;
        clientOutstanding.set(invoice.clientId, current + outstanding);
        totalOutstanding += outstanding;
      }
    }
  }

  if (totalOutstanding === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success-bg border border-success/30 rounded-lg">
        <div className="flex-shrink-0 p-2 bg-success-bg/50 rounded-lg">
          <span className="text-2xl">✓</span>
        </div>
        <div>
          <p className="font-medium text-success">No concentration risk</p>
          <p className="text-sm text-ink-muted">Outstanding is well distributed across clients</p>
        </div>
      </div>
    );
  }

  // Find top client
  let topClientId: string | null = null;
  let topAmount = 0;
  for (const [clientId, amount] of clientOutstanding.entries()) {
    if (amount > topAmount) {
      topAmount = amount;
      topClientId = clientId;
    }
  }

  if (!topClientId || topAmount === 0) {
    return null;
  }

  const topClient = clients.find((c) => c.id === topClientId);
  const clientName = topClient?.name ?? "Unknown client";
  const percentage = (topAmount / totalOutstanding) * 100;

  const isHighRisk = percentage >= 40;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border",
        isHighRisk
          ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-caution-bg dark:border-caution/30 dark:text-caution"
          : "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-success-bg dark:border-success/30 dark:text-success"
      )}
      role={isHighRisk ? "alert" : undefined}
    >
      <div className="flex-shrink-0 p-2 rounded-lg">
        {isHighRisk ? (
          <span className="p-2 bg-amber-100 rounded-lg dark:bg-caution-bg"><AlertTriangle className="h-5 w-5 text-amber-600 dark:text-caution" /></span>
        ) : (
          <span className="p-2 bg-emerald-100 rounded-lg dark:bg-success-bg"><TrendingUp className="h-5 w-5 text-emerald-600 dark:text-success" /></span>
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">
          {isHighRisk ? "Concentration risk: " : "Well distributed: "}
          <span className="font-semibold">{clientName}</span> accounts for{" "}
          <span className="font-semibold">{percentage.toFixed(0)}%</span> of total outstanding
        </p>
        <p className="mt-1 text-sm">
          <span className="font-tabular font-medium">{formatCurrency(topAmount)}</span> of{" "}
          <span className="font-tabular">{formatCurrency(totalOutstanding)}</span> outstanding
        </p>
        {isHighRisk && (
          <p className="mt-2 text-xs text-amber-700 dark:text-caution">
            Consider diversifying client base or prioritizing collection from this client.
          </p>
        )}
      </div>
    </div>
  );
}